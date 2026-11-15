const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function app(){
 const sandbox={window:{},URL,Blob,Uint8Array};
 vm.runInNewContext(read('assets/vendor/qrcode-generator.js'),sandbox);
 sandbox.window.qrcode=sandbox.qrcode;
 vm.runInNewContext(read('assets/invoice-pdf.js'),sandbox);
 vm.runInNewContext(read('assets/invoice-preview.js'),sandbox);
 return sandbox.window;
}
function data(total=500){
 return {
   quote:{numero:'D-TEST-101',accepted_terms:'v2026-11',accepted_data:{f:{
     myaddr:'12 rue Demo, Bondy, France',cname:'Customer Demo',caddr:'7 Rue Test, Paris, France',
     desc:'Service numerique',novat:true,pay:'Virement'
   }}},
   receipt:{amount:350,received_on:'2026-11-14',method:'transfer'},
   invoice:{num:'F-2026-0007',issuedOn:'2026-11-15',n:"Facture d'acompte",amt:total,label:"Facture d'acompte"},
   payment:{holder:'DZOFT Business',bank:'Test Bank',iban:'FR7612345678901234567890123',bic:'TESTFRPP',
     link:'https://example.com/checkout/secure',note:'Please mention your invoice number.'}
 };
}

test('PDF includes real offline payment-link QR and transfer instructions only if money remains due',async()=>{
 const win=app(),pdf=win.DzoftInvoicePdf.build(data());
 const raw=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.match(raw,/^%PDF-1.4/);
 assert.match(raw,/MOYENS DE R.GLEMENT/);
 assert.match(raw,/FR7612345678901234567890123/);
 assert.match(raw,/DZOFT Business/);
 assert.match(raw,/https:\/\/example\.com\/checkout\/secure/);
 assert.match(raw,/R.f.rence de paiement : F-2026-0007/);
 const drawn=(raw.match(/ re f/g)||[]).length;
 assert.ok(drawn>50,'Expected actual PDF QR matrix modules, not just a QR caption');
 assert.match(raw,/startxref\n\d+\n%%EOF/);
});

test('Paid invoices never request another payment even when bank settings exist',async()=>{
 const win=app(),pdf=win.DzoftInvoicePdf.build(data(350));
 const raw=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.match(raw,/FACTURE R.GL.E/);
 assert.doesNotMatch(raw,/MOYENS DE R.GLEMENT|FR7612345678901234567890123|https:\/\/example\.com\/checkout/);
 assert.equal((raw.match(/ re f/g)||[]).length,0,'No checkout QR if invoice is settled');
});

test('Print preview has accessible QR, banking details and a clear balance only for unpaid amounts',()=>{
 const win=app();let printed='';
 const fake={document:{open(){},write(value){printed=value},close(){}},focus(){}};
 win.open=()=>fake;
 const args=data();
 win.DzoftInvoicePreview.open(args);
 assert.match(printed,/Comment régler le solde/);
 assert.match(printed,/class="pay-qr"/);
 assert.match(printed,/<svg[^>]*role="img"/);
 assert.match(printed,/https:\/\/example\.com\/checkout\/secure/);
 assert.match(printed,/FR7612345678901234567890123/);
 assert.match(printed,/Vérifiez le montant et précisez la référence/);
 printed='';
 win.DzoftInvoicePreview.open(data(350));
 assert.match(printed,/Facture acquittée/);
 assert.doesNotMatch(printed,/class="pay-qr"|FR7612345678901234567890123/);
});

test('Unsafe payment links never become QR destinations',()=>{
 const win=app();let printed='';
 const fake={document:{open(){},write(value){printed=value},close(){}},focus(){}};
 win.open=()=>fake;
 const args=data();args.payment.link='javascript:alert(1)';
 win.DzoftInvoicePreview.open(args);
 assert.doesNotMatch(printed,/javascript:alert|class="pay-qr"/);
 const q=read('assets/invoice-pdf.js');
 assert.match(q,/u\.protocol==='https:'/);
});

test('existing payment settings are used only by owner invoice creation; no billing mutations or external QR calls',()=>{
 const tracking=read('assets/project-tracking.js'),admin=read('admin/suivi.html');
 assert.match(tracking,/sb\.select\('settings','select=payment&id=eq\.1'\)/);
 assert.match(tracking,/DzoftInvoicePdf\.build\(\{quote:q,receipt:receipt,invoice:inv,payment:payment\}\)/);
 assert.match(tracking,/popup=global\.open\('about:blank','_blank'\)/);
 assert.match(admin,/vendor\/qrcode-generator\.js\?v=20261115-offline/);
 assert.match(admin,/invoice-pdf\.js\?v=20261115-pay-template/);
 assert.match(admin,/invoice-preview\.js\?v=20261115-pay-template/);
 assert.doesNotMatch(read('assets/invoice-preview.js'),/sb\.update|sb\.rpc|fetch\(/);
 new vm.Script(tracking);
});
