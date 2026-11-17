// 17 Nov 2026: Documents = contract (signed quote + accepted CGV), signed extra work, invoices, payment receipts.
// The PDFs are drawn from records only: nothing is written or sent, and a receipt never replaces an invoice.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('assets/dzoft-documents.js');
function load(){const ctx={window:{},document:{},Blob,URL,setTimeout,Uint8Array};ctx.window=ctx;vm.runInNewContext(src,ctx);return ctx.DzoftDocuments;}
const latin=async b=>Buffer.from(await b.arrayBuffer()).toString('latin1');
const q={numero:'D-T-1',accepted_at:'2026-11-03T10:12:00Z',accepted_name:'Test Client',accepted_method:'email',accepted_target:'t•••@example.invalid',accepted_terms:'v2026-11',accepted_total:1000,
 accepted_data:{f:{num:'D-T-1',cname:'Test Client',caddr:'1 rue Test',deppct:30},lines:[{l:'Site',q:1,u:'forfait',p:1000},{l:'Option',q:1,p:50,o:1}]},
 data:{f:{num:'CHANGED',cname:'Changed'},lines:[{l:'Changed after signing',q:1,p:9999}]},
 invoices:[{id:'i1',num:'F-2026-0001',n:'Acompte',amt:300}]};
test('signed quote PDF uses the version frozen at signature and shows the signature record',async()=>{
 const D=load(),pdf=await latin(D.signedQuote(q));
 assert.match(pdf,/^%PDF-1\.4/);
 assert.match(pdf,/Devis sign\xe9 n\xb0 D-T-1/);
 assert.doesNotMatch(pdf,/Changed after signing|9 999/);
 assert.match(pdf,/Sign\xe9 \xe9lectroniquement le/);
 assert.match(pdf,/Test Client/);
 assert.match(pdf,/version 2026-11/);
 assert.match(pdf,/1 000,00 \x80/,'euro sign in WinAnsi');
 assert.throws(()=>D.signedQuote(Object.assign({},q,{accepted_at:null})),/pas encore sign/);
});
test('signed extra work PDF only for a signed proposal',async()=>{
 const D=load(),r={status:'approved',proposal_number:'D-T-1-C1',title:'Ajout',lines:[{label:'Page',qty:1,price:120}],extra_price:120,decided_at:'2026-11-15T09:00:00Z',decision_name:'Test Client',decision_method:'email',decision_target:'t•••'};
 const pdf=await latin(D.signedChange(r,q));
 assert.match(pdf,/Compl\xe9ment au devis n\xb0 D-T-1-C1/);
 assert.match(pdf,/prix du devis d\x92origine reste inchang\xe9/);
 assert.throws(()=>D.signedChange(Object.assign({},r,{status:'proposed'}),q),/pas sign/);
});
test('payment receipt names its invoice and says it does not replace it',async()=>{
 const D=load(),all=[{id:'r1',invoice_id:'i1',amount:300,received_on:'2026-11-04',method:'transfer',reference:'VIR 1'}];
 const pdf=await latin(D.paymentReceipt(all[0],q,all));
 assert.match(pdf,/Re\xe7u de paiement/);
 assert.match(pdf,/Facture n\xb0 F-2026-0001/);
 assert.match(pdf,/Il ne remplace pas la facture n\xb0 F-2026-0001/);
 assert.match(pdf,/Reste \xe0 payer sur cette facture/);
 assert.throws(()=>D.paymentReceipt({amount:0},q,[]),/incomplet/);
});
test('documents never write or send anything, and pages show official documents first',()=>{
 assert.doesNotMatch(src,/fetch\(|XMLHttpRequest|\.rpc\(|\.update\(|\.insert\(|localStorage/);
 const portal=read('espace/index.html'),admin=read('admin/project-finance.js');
 assert.match(portal,/dzoft-documents\.js\?v=/);assert.match(read('admin/projet.html'),/dzoft-documents\.js\?v=/);
 assert.match(portal,/signed\.map\(officialDocs\)[\s\S]*Fichiers du projet · [\s\S]*Fichiers que vous m’avez envoyés/);
 assert.match(portal,/call\('list_change_requests', \{ p_quote: id \}\)/);
 assert.match(portal,/portal_project_tracking/);
 // In the admin, « réglée » comes from recorded payments only.
 assert.match(admin,/function receiptTotal\(invoiceId\)/);
 assert.match(admin,/return officialDocuments\(\)\+/);
});
test('no blank template among the client documents; the admin Documents page leads to each project tab',()=>{
 const portal=read('espace/index.html'),panels=read('admin/workspace-panels-v7.js');
 assert.doesNotMatch(portal,/Toujours disponibles|fiche-de-remise-client\.pdf/);
 assert.match(panels,/documents:documentsByProject/);
 assert.match(panels,/'projet\.html\?q='\+encodeURIComponent\(p\.id\)\+'#documents'/);
});
