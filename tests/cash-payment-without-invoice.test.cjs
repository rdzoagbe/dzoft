const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const at=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('cash or other verified payments can be recorded without an invoice number',()=>{
 const js=at('assets/project-tracking.js');
 assert.match(js,/value="unbilled"/);
 assert.match(js,/record_project_payment_unbilled/);
 assert.match(js,/p_amount:Number\(el\.amount\.value\)/);
 assert.match(js,/p_notify:el\.notify\.checked/);
 assert.match(js,/noInvoice\?'':/);
 assert.match(js,/Facture à établir/);
 new vm.Script(js,{filename:'assets/project-tracking.js'});
});

test('existing numbered-invoice payment path is retained',()=>{
 const js=at('assets/project-tracking.js');
 assert.match(js,/record_project_payment'/);
 assert.match(js,/record_project_payment_unbilled':'record_project_payment/);
 assert.match(js,/p_new_invoice/);
 assert.match(js,/Amount exceeds invoice balance/);
});

test('later invoice assignment does not record or notify a second payment',()=>{
 const js=at('assets/project-tracking.js');
 const sql=at('supabase/migrations/20261113214500_verified_payment_without_invoice.sql');
 assert.match(js,/link_project_receipt_invoice/);
 assert.match(sql,/update public\.project_receipts set invoice_id=p_invoice/);
 assert.match(sql,/The money is ALREADY counted/);
 const linking=sql.slice(sql.indexOf('create or replace function private.link_project_receipt_invoice'));
 assert.doesNotMatch(linking,/insert into public\.project_receipts/);
 assert.doesNotMatch(linking,/private\.queue_project_event/);
 assert.match(sql,/invoice_id is not null/);
 assert.match(sql,/from public,anon/);
 assert.match(sql,/Owner access required/);
});

test('production data remains intact; migration only relaxes the link, adds guarded RPCs',()=>{
 const sql=at('supabase/migrations/20261113214500_verified_payment_without_invoice.sql');
 assert.match(sql,/alter column invoice_id drop not null/);
 assert.doesNotMatch(sql,/drop\s+table|truncate\s+|delete\s+from\s+public\./i);
 assert.match(sql,/public\.is_owner\(\)/);
 assert.match(sql,/create or replace function public\.record_project_payment_unbilled/);
 assert.match(sql,/create or replace function public\.link_project_receipt_invoice/);
 const admin=at('admin/suivi.html'),client=at('espace/index.html');
 assert.match(admin,/project-tracking\.js\?v=20261113-cash/);
 assert.match(client,/project-tracking\.js\?v=20261113-cash/);
});
