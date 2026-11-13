const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('payment corrections are owner-only, audited, and never create a new receipt or send mail',()=>{
 const sql=read('supabase/migrations/20261113235900_payment_correction_and_email_status.sql');
 const correction=sql.slice(sql.indexOf('create or replace function private.correct_project_receipt_method'),sql.indexOf('create or replace function public.correct_project_receipt_method'));
 assert.match(correction,/auth.uid\(\) is null or not public\.is_owner\(\)/);
 assert.match(correction,/select \* into r from public\.project_receipts/);
 assert.match(correction,/update public\.project_receipts set method=p_method/);
 assert.match(correction,/insert into public\.project_receipt_method_audit/);
 assert.doesNotMatch(correction,/insert into public\.project_receipts/);
 assert.doesNotMatch(correction,/queue_project_event|email_outbox/);
 assert.match(sql,/alter table public\.project_receipt_method_audit enable row level security/);
 assert.match(sql,/revoke all on public\.project_receipt_method_audit from public,anon,authenticated/);
 assert.doesNotMatch(sql,/drop table|truncate|delete\s+from\s+public\./i);
});

test('financial totals and notification statuses are separate from pending reports',()=>{
 const html=read('admin/index.html');
 assert.match(html,/pendingTotal=valid\.reduce/);
 assert.match(html,/c.status==='pending'\|\|c.status==='sent_by_client'/);
 assert.match(html,/reported \/ pending|Reported \/ pending/);
 assert.match(html,/not received/);
 const sql=read('supabase/migrations/20261113235900_payment_correction_and_email_status.sql');
 assert.match(sql,/o.recipient_role='client'/);
 assert.match(sql,/o.status='sent'/);
 assert.match(sql,/o.status='failed'/);
 assert.match(sql,/count\(o.id\)>0 then 'queued'/);
 assert.match(sql,/else 'not_queued'/);
});

test('admin displays truthful email outcomes and auditable corrections, client receives no audit controls',()=>{
 const js=read('assets/project-tracking.js');
 assert.match(js,/project_payment_admin_meta/);
 assert.match(js,/correct_project_receipt_method/);
 assert.match(js,/Receipt|receipt/i);
 assert.match(js,/not proof of delivery/);
 assert.match(js,/No client email recorded/);
 assert.match(js,/A private audit trail is kept/);
 assert.match(js,/receipts\(d,true\)/);
 assert.match(js,/receipts\(d,false\)/);
 assert.match(js,/No email is sent/);
 new vm.Script(js,{filename:'assets/project-tracking.js'});
});

test('revised assets load on both admin and client pages; core routing remains available',()=>{
 for(const p of ['admin/suivi.html','espace/index.html']){
  assert.match(read(p),/project-tracking\.js\?v=20261113-payment-audit/);
  assert.match(read(p),/project-tracking\.css\?v=20261113-payment-audit/);
 }
 assert.match(read('admin/project-workspace.js'),/Manage payments/);
 assert.match(read('admin/index.html'),/simplified-ui\.css\?v=20261113-finance-clarity/);
});
