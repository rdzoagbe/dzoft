const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('the invoice link and payment-entry forms cannot be confused after one receipt',()=>{
 const code=read('assets/project-tracking.js');
 assert.match(code,/function invoiceLinkForms\(d,q,paidOn\)/);
 assert.match(code,/var fm=box\.querySelector\('details\.tracking-editor > form'\)/,
  'payment form must be explicitly scoped because invoice-link forms appear first');
 assert.match(code,/news=fm\.querySelector\('\.tracking-new'\)/,
  'invoice detail fields belong to the selected payment form');
 assert.match(code,/msg=box\.querySelector\(':scope > \[role="status"\]'\)/,
  'receipt status must not write into the older invoice-link form');
 assert.doesNotMatch(code,/var fm=box\.querySelector\('form'\)/);
 assert.doesNotMatch(code,/news=box\.querySelector\('\.tracking-new'\)/);
 new vm.Script(code,{filename:'assets/project-tracking.js'});
});
test('cash deposit remains ledger-based and nothing is automatically re-entered',()=>{
 const code=read('assets/project-tracking.js');
 assert.match(code,/record_project_payment_unbilled/);
 assert.match(code,/link_project_receipt_invoice/);
 assert.match(code,/Previously saved payments are preserved/);
 assert.match(code,/setTimeout\(reload,1200\)/);
 for(const p of ['admin/suivi.html','espace/index.html']){
  assert.match(read(p),/project-tracking\.js\?v=20261113-cash-panel-fix/);
 }
});
