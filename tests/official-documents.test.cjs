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
 const portal=read('espace/index.html'),admin=read('admin/project-summary.js');
 assert.match(portal,/dzoft-documents\.js\?v=/);assert.match(read('admin/suivi.html'),/dzoft-documents\.js\?v=/);
 assert.match(portal,/signed\.map\(officialDocs\)[\s\S]*Fichiers du projet · [\s\S]*Fichiers que vous m’avez envoyés/);
 assert.match(portal,/call\('list_change_requests', \{ p_quote: id \}\)/);
 assert.match(portal,/portal_project_tracking/);
 // In the admin, « réglée » comes from recorded payments only.
 assert.match(admin,/function paidFor\(invoiceId\)/);
 // The project page's Documents tab starts with the official documents.
 assert.match(read('admin/project-workspace-tabs.js'),/docsPane\.appendChild\(official\);[\s\S]*\['c-docs','c-files'\]/);
});
test('no blank template among the client documents; documents live in each project, not in a global page',()=>{
 const portal=read('espace/index.html'),panels=read('admin/workspace-panels-v7.js'),admin=read('admin/index.html');
 assert.doesNotMatch(portal,/Toujours disponibles|fiche-de-remise-client\.pdf/);
 // 17 Nov 2026: the global Documents page is gone; its old address opens Projets.
 assert.doesNotMatch(panels,/documentsByProject|\['documents',/);
 assert.match(admin,/documents:'projets'/);
});

test('signed quote PDF lists what the quote does not include, only when the signed version had the list',async()=>{
 const D=load();
 const withList=JSON.parse(JSON.stringify(q));
 withList.accepted_data.f.excl='La publication sur les stores\n\n  Le paiement en ligne  ';
 const pdf=await latin(D.signedQuote(withList));
 assert.match(pdf,/CE DEVIS NE COMPREND PAS/);
 assert.match(pdf,/- La publication sur les stores/);
 assert.match(pdf,/- Le paiement en ligne/);
 // A list typed in the editor after signature must not appear on the signed document.
 const later=JSON.parse(JSON.stringify(q));
 later.data.f.excl='Ajouté après la signature';
 assert.doesNotMatch(await latin(D.signedQuote(later)),/CE DEVIS NE COMPREND PAS|Ajout/);
});

test('quote editor and client view carry the « Ce devis ne comprend pas » list',()=>{
 const admin=fs.readFileSync(path.join(__dirname,'..','admin/devis.html'),'utf8');
 const portal=fs.readFileSync(path.join(__dirname,'..','espace/index.html'),'utf8');
 assert.match(admin,/id="excl" data-k="excl"/);
 assert.match(admin,/EXCL_PRESETS = \[/);
 assert.match(admin,/\.blk\.excl-empty\{display:none!important\}/,'an empty list is not printed');
 // The package buttons must not take over the new buttons.
 assert.match(admin,/querySelectorAll\('\.add\[data-preset\]'\)/);
 assert.match(portal,/<h4>Ce devis ne comprend pas<\/h4><ul class="excl">/);
 assert.match(portal,/'<li>' \+ esc\(l\) \+ '<\/li>'/,'client text is escaped');
});
