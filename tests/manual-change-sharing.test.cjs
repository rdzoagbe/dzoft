const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=read('assets/change-requests.js'),sql=read('supabase/migrations/20261118214500_manual_change_proposal_sharing.sql');
test('one-click proposal sending is removed from owner UI',()=>{
 assert.doesNotMatch(ui,/owner_send_change_proposal/);
 assert.doesNotMatch(ui,/sb\.fn\('process-notification-outbox'/);
 assert.match(ui,/if\(b\.dataset\.changeSend\)/);
 assert.match(ui,/openManualShare\(proposal\)/);
 assert.match(ui,/Préparer une explication dans Outlook \/ WhatsApp/);
 assert.match(ui,/Partagée · signature attendue/);
 new vm.Script(ui);
});
test('message is editable and only external Outlook or WhatsApp opens on button click',()=>{
 const begin=ui.indexOf('function openManualShare(proposal){'),end=ui.indexOf("root.addEventListener('click'",begin);
 const body=ui.slice(begin,end);
 assert.ok(begin>0&&end>begin);
 for(const marker of ['data-share-email','data-share-subject','data-share-body','data-share-outlook','data-share-wa','data-share-confirm','data-share-checked','data-share-close'])
  assert.ok(body.includes(marker),marker);
 assert.match(body,/outlook\.live\.com\/mail\/0\/deeplink\/compose/);
 assert.match(body,/https:\/\/wa\.me\//);
 assert.match(body,/clientEmail/);
 assert.match(body,/clientPhone/);
 assert.match(body,/Aucun supplément ne sera facturé sans votre accord/);
 assert.doesNotMatch(body,/process-notification-outbox|owner_send_change_proposal|queue_project_event/);
});
test('manual-sharing RPC is server-enforced owner-only and never queues client email',()=>{
 assert.match(sql,/auth\.uid\(\) is null or not coalesce\(public\.is_owner\(\),false\)/);
 assert.match(sql,/p_version is null or c\.proposal_version is distinct from p_version/);
 assert.match(sql,/c\.sent_at is not null/);
 assert.match(sql,/accepted_at is not null/);
 assert.match(sql,/update public\.dzoft_change_requests[\s\S]*?set sent_at=now\(\)/);
 const body=sql.slice(sql.indexOf('create or replace function public.owner_mark_change_shared_manually'),sql.indexOf('end \$fn\$;')+9);
 assert.doesNotMatch(body,/queue_project_event|email_outbox|http_|sendTransacEmail|process-notification-outbox|invoice/);
 assert.match(sql,/revoke execute on function public\.owner_send_change_proposal\(uuid\)/);
 assert.match(sql,/grant execute on function public\.owner_mark_change_shared_manually\(uuid,integer\)/);
});
test('legacy sent history is preserved, new manual sharing has an auditable event',()=>{
 assert.match(sql,/insert into public\.dzoft_change_events/);
 assert.match(sql,/delivery_verification','not_available'/);
 assert.doesNotMatch(sql,/delete from|truncate |update public\.email_outbox/i);
 const project=read('admin/suivi.html');
 assert.match(project,/clientEmail:\(C&&C\.email\)/);
 assert.match(project,/change-requests\.js\?v=20261118-manual-review/);
});
