const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('client-sent and pending payments remain separate from received-money ledger',()=>{
 const sql=read('supabase/migrations/20261113230000_project_payment_statuses.sql');
 const create=sql.slice(sql.indexOf('create or replace function private.create_project_payment_status('),sql.indexOf('create or replace function public.create_project_payment_status('));
 assert.doesNotMatch(create,/insert into public\.project_receipts/i);
 assert.doesNotMatch(create,/queue_project_event/i);
 assert.match(sql,/status in \('pending','sent_by_client'\)/);
 assert.match(sql,/private\.record_project_payment_unbilled/);
 assert.match(sql,/if x.status='received' then return private\.project_tracking/);
 assert.match(sql,/if x.status='cancelled' then raise exception/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.project_payment_statuses from public,anon,authenticated/);
 assert.match(sql,/auth\.uid\(\) is null or not public\.is_owner\(\)/);
 assert.match(sql,/existing project_receipts, clients, quotes and invoice records stay untouched/);
 assert.doesNotMatch(sql,/drop table|truncate|delete from public\./i);
});

test('invoice is optional; notification only triggered on receipt confirmation',()=>{
 const js=read('assets/project-tracking.js');
 assert.match(js,/Revolut invoice optional/);
 assert.match(js,/create_project_payment_status/);
 assert.match(js,/update_project_payment_status/);
 assert.match(js,/confirm_project_payment_status/);
 assert.match(js,/p_notify:shouldNotify/);
 const create=js.slice(js.indexOf("var data={p_quote:q.id,p_id:key,p_amount:Number(create.elements.amount.value)"),
 js.indexOf("box.querySelectorAll('form[data-status-id]')"));
 assert.doesNotMatch(create,/p_notify/);
 assert.match(js,/paymentStatuses\(d,true\)/);
 assert.match(js,/paymentStatuses\(d,false\)/);
 assert.match(js,/details\.tracking-editor:not\(\.tracking-report-editor\) > form/);
 new vm.Script(js,{filename:'assets/project-tracking.js'});
});

test('live project and client portal load fresh payment-state assets',()=>{
 for(const p of ['admin/suivi.html','espace/index.html']){
  assert.match(read(p),/project-tracking\.js\?v=20261113-payment-audit/);
  assert.match(read(p),/project-tracking\.css\?v=20261113-payment-audit/);
 }
});
