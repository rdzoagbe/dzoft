const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function build(extra={}){
 const win={};
 vm.runInNewContext(read('assets/invoice-pdf.js'),{window:win,Blob,Uint8Array,URL});
 const data={
  quote:{
   numero:'D-TEST-MULTIPAGE',accepted_terms:'v2026-11',
   accepted_data:{f:{
    myaddr:'12 rue Demo, 93140 Bondy, France',
    cname:'Client Exemple',caddr:'7 rue Demo, Paris, France',
    novat:true,pay:'Virement bancaire selon conditions contractuelles',
    desc:'Apercu du perimetre technique. '.repeat(320)+'FINAL_SCOPE_SENTINEL'
   }}
  },
  receipt:{amount:350,received_on:'2026-11-14',method:'transfer'},
  invoice:{num:'F-2026-0001',amt:350,issuedOn:'2026-11-14',n:'Facture d acompte'}
 };
 if(extra.payment)data.payment=extra.payment;
 return win.DzoftInvoicePdf.build(data);
}

function inspect(raw){
 const start=raw.match(/startxref\n(\d+)\n%%EOF/);
 assert.ok(start,'startxref must be present');
 const xrefOffset=Number(start[1]);
 assert.equal(raw.slice(xrefOffset,xrefOffset+5),'xref\n');
 const tail=raw.slice(xrefOffset);
 const match=tail.match(/^xref\n0 (\d+)\n/);
 assert.ok(match);
 const objectCount=Number(match[1]);
 const index=tail.slice(match[0].length).split('\n').slice(0,objectCount);
 assert.equal(index.length,objectCount);
 assert.equal(index[0].slice(0,10),'0000000000');
 for(let id=1;id<objectCount;id++){
  const offset=Number(index[id].slice(0,10));
  assert.equal(raw.slice(offset,offset+(String(id).length+6)),id+' 0 obj',
   'Object '+id+' must begin at its byte xref offset');
 }
 return objectCount;
}

test('long scope remains intact across numbered A4 PDF continuation pages',async()=>{
 const pdf=build();
 const raw=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.equal(pdf.type,'application/pdf');
 assert.match(raw,/\/Type \/Pages \/Kids \[ [^\]]+ \] \/Count [2-9]/);
 const match=raw.match(/\/Type \/Pages \/Kids \[ ([^\]]+) \] \/Count (\d+)/);
 const pages=Number(match[2]);
 assert.ok(pages>=2&&pages<=20,'Expected more than one page and bounded output');
 assert.equal(inspect(raw),7+(pages-1)*2,'Each additional page needs a page object and content stream');
 assert.match(raw,/F-2026-0001/);
 assert.match(raw,/D-TEST-MULTIPAGE/);
 assert.match(raw,/FINAL_SCOPE_SENTINEL/);
 assert.match(raw,/PRIX CONVENU ET CHANGEMENTS/);
 assert.match(raw,/FACTURE R.GL.E/);
 assert.match(raw,/Page 1 sur /);
 assert.match(raw,/SUITE/);
 assert.match(raw,new RegExp('Page '+pages+' sur '+pages));
 assert.doesNotMatch(raw,/MOYENS DE R.GLEMENT|Paiement en ligne/);
});

test('payment QR is included rather than silently dropped when the previous page runs out of space',async()=>{
 const win={};
 const sandbox={window:win,Blob,Uint8Array,URL};
 vm.runInNewContext(read('assets/vendor/qrcode-generator.js'),sandbox);
 win.qrcode=sandbox.qrcode;
 vm.runInNewContext(read('assets/invoice-pdf.js'),sandbox);
 const data={
  quote:{numero:'D-TEST-MULTI-QR',accepted_terms:'v2026-11',accepted_data:{f:{
   myaddr:'93 rue Exemple, Paris, France',cname:'Client Test',
   caddr:'65 rue Test, Lille, France',novat:true,
   desc:'Implementation et tests. '.repeat(290)
  }}},
  receipt:{amount:350,received_on:'2026-11-14',method:'transfer'},
  invoice:{num:'F-2026-0002',amt:450,issuedOn:'2026-11-14',n:'Facture de prestation'},
  payment:{holder:'DZOFT',iban:'FR7612345678901234567890123',link:'https://example.com/pay'}
 };
 const pdf=win.DzoftInvoicePdf.build(data);
 const raw=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.ok(inspect(raw)>6);
 assert.match(raw,/https:\/\/example.com\/pay/);
 assert.match(raw,/FR7612345678901234567890123/);
 assert.ok((raw.match(/ re f/g)||[]).length>50,'PDF QR matrix must be generated');
 assert.match(raw,/MOYENS DE R.GLEMENT/);
});

test('invoice PDF generator is loaded with a refreshed version and archiving still uses existing numbered invoice',()=>{
 const html=read('admin/suivi.html');
 assert.match(html,/invoice-pdf\.js\?v=20261115-pay-template&multi=20261115/);
 const tracking=read('assets/project-tracking.js');
 assert.match(tracking,/function archiveInvoice\(q,sb,receipt,inv\)/);
 assert.match(tracking,/DzoftInvoicePdf\.build\(\{quote:q,receipt:receipt,invoice:inv,payment:payment\}\)/);
 assert.match(tracking,/attach_generated_invoice_pdf/);
 assert.doesNotMatch(read('assets/invoice-pdf.js'),/sb\.rpc|sb\.update|fetch\(/);
});
