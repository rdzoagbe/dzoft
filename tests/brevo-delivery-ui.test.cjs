const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function load(){
 const global={};
 vm.runInNewContext(get('assets/delivery-status.js'),{window:global});
 return global.DzoftDelivery.describe;
}
test('Brevo accepted is not falsely labelled delivered',()=>{
 const describe=load();
 const status=describe({status:'sent',delivery_status:'unconfirmed'});
 assert.equal(status.label,'Accepted by Brevo');
 assert.match(status.detail,/not yet verified/i);
 assert.notEqual(status.tone,'success');
});
test('brevo lifecycle labels distinguish delivered, opened tracking, bounce, and blocked',()=>{
 const describe=load();
 assert.equal(describe({status:'sent',delivery_status:'delivered'}).label,'Delivered');
 assert.equal(describe({status:'sent',delivery_status:'opened'}).label,'Opened (tracked)');
 assert.match(describe({status:'sent',delivery_status:'opened'}).detail,/does not prove/i);
 for(const name of ['hard_bounce','blocked','invalid','error','spam']){
  assert.equal(describe({status:'sent',delivery_status:name}).tone,'error');
 }
 assert.equal(describe({status:'sent',delivery_status:'deferred'}).tone,'warning');
 assert.equal(describe({status:'sent',delivery_status:'soft_bounce'}).tone,'warning');
 assert.equal(describe({status:'failed',delivery_status:'delivered'}).label,'Sending failed');
});
test('private owner views use per-recipient delivery states, not a shared email sent flag',()=>{
 const admin=get('admin/index.html');
 const project=get('admin/suivi.html');
 for(const html of [admin,project]){
  assert.match(html,/assets\/delivery-status\.js\?v=/);
  assert.match(html,/delivery_status,delivery_event_at,delivered_at,opened_at,bounced_at/);
  assert.match(html,/DzoftDelivery\.describe\(job\)/);
 }
 assert.match(admin,/brevo_delivery_monitor/);
 assert.match(admin,/Delivery not yet verified|delivery may still be unverified/i);
 const client=get('espace/index.html');
 assert.doesNotMatch(client,/brevo_delivery_monitor|delivery_status|DzoftDelivery/);
});
test('webhook authenticates sender before parsing and only writes event state via guarded RPC',()=>{
 const fn=get('supabase/functions/brevo-delivery-events/index.ts');
 assert.match(fn,/verify_brevo_delivery_token/);
 assert.match(fn,/X-DZOFT-Delivery-Token/);
 assert.match(fn,/if\(!validToken\(token\)\)return result\(401/);
 assert.match(fn,/record_brevo_delivery_event/);
 assert.match(fn,/p_message_id:id,p_recipient:email,p_event:kind,p_occurred_at:when/);
 assert.match(fn,/X-DZOFT-Setup-Token/);
 assert.match(fn,/brevo_delivery_setup_credential/);
 assert.match(fn,/brevo_delivery_candidates/);
 assert.match(fn,/mark_brevo_delivery_setup/);
 assert.match(fn,/https:\/\/api\.brevo\.com\/v3/);
 assert.doesNotMatch(fn,/console\.log|console\.error|publish_project_updates|process-notification-outbox|p_success|sendTransacEmail/);
});
test('SQL protects deliverability from external spoofing and preserves the accepted/sent status',()=>{
 const sql=get('supabase/migrations/20261114170000_brevo_delivery_tracking.sql');
 assert.match(sql,/vault\.create_secret/);
 assert.match(sql,/record_brevo_delivery_event/);
 assert.match(sql,/normalized_email/);
 assert.match(sql,/normalized_id/);
 assert.match(sql,/and o\.status='sent'/);
 assert.match(sql,/on conflict do nothing/);
 assert.match(sql,/from public,anon,authenticated/);
 assert.match(sql,/to service_role/);
 assert.match(sql,/auth\.uid\(\) is null or not public\.is_owner\(\)/);
 assert.doesNotMatch(sql,/update public\.project_receipts|update public\.quotes|insert into public\.email_outbox|publish_project_updates/i);
 const rollback=get('tests/brevo-delivery-lifecycle.sql');
 assert.match(rollback,/^begin;/m);assert.match(rollback,/rollback;\s*$/);
});


test('hourly Brevo reconciliation is service-only and never sends email',()=>{
 const worker=get('supabase/functions/brevo-delivery-events/index.ts');
 const migration=get('supabase/migrations/20261114170500_brevo_delivery_polling.sql');
 const schedule=get('supabase/migrations/20261114171000_brevo_delivery_schedule.sql');
 assert.match(worker,/brevo_delivery_recent_candidates/);
 assert.match(worker,/verify_brevo_delivery_token/);
 assert.match(worker,/mark_brevo_delivery_polling/);
 assert.match(worker,/path\.endsWith\("\/reconcile"\)/);
 assert.match(worker,/messageId:c\.message_id,email:c\.email/);
 assert.match(worker,/normalizeId\(messageId\(e\)\)/);
 assert.match(migration,/from public\.email_outbox/);
 assert.match(migration,/now\(\)-interval '14 days'/);
 assert.match(migration,/from public,anon,authenticated/);
 assert.match(migration,/to service_role/);
 assert.match(schedule,/dzoft_brevo_delivery_reconcile/);
 assert.match(schedule,/vault\.decrypted_secrets/);
 assert.match(schedule,/brevo-delivery-events\/reconcile/);
 assert.doesNotMatch(schedule,/BREVO_API_KEY|service_role|sender|recipient|\bemail_outbox\b/);
});
