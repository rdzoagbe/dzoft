const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('each owner-side unbilled receipt offers a direct invoice action',()=>{
 const src=read('assets/project-tracking.js');
 assert.match(src,/function invoiceArchiveAction/);
 assert.match(src,/btn\.dataset\.openReceiptLink/);
 assert.match(src,/det\.open=true/);
 assert.match(src,/form\.elements\.issued\.required=fresh/);
 assert.match(src,/if\(fresh&&!form\.elements\.issued\.checked\)/);
 assert.match(src,/link_project_receipt_invoice/);
 assert.match(src,/The payment was not counted twice|duplicate payment/);
 new vm.Script(src,{filename:'assets/project-tracking.js'});
});

test('invoice PDF preparation does not create receipts, send mail, or mutate the database',()=>{
 const preview=read('assets/invoice-preview.js');
 const main=read('assets/project-tracking.js');
 assert.match(main,/DzoftInvoicePreview\.open/);
 assert.match(preview,/window\.print\(\)/);
 assert.match(preview,/quote\.accepted_data\|\|quote\.data/);
 assert.match(preview,/receipt\.received_on/);
 assert.match(preview,/f\.novat/);
 assert.match(preview,/myaddr/);
 assert.match(preview,/caddr/);
 assert.match(preview,/SIRET/);
 assert.doesNotMatch(preview,/sb\.rpc|sb\.update|\.fetch\(|fetch\(|process-notification-outbox|record_project_payment|localStorage|sessionStorage/);
 new vm.Script(preview,{filename:'assets/invoice-preview.js'});
});

test('invoice print UI is limited to the signed-in admin and not included in client portal',()=>{
 const admin=read('admin/suivi.html'),client=read('espace/index.html'),css=read('assets/project-tracking.css');
 assert.match(admin,/invoice-preview\.js\?v=(?:20261114|20261115)/);
 assert.doesNotMatch(client,/invoice-preview\.js/);
 assert.match(admin,/project-tracking\.js\?v=(?:20261114-(?:auto-number|archive|github-auto)|20261115-pay-template|20261115-verified-receipts2)/);
 assert.match(css,/tracking-issue-btn/);
 assert.match(css,/tracking-invoice-actions/);
});
