const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function prepareWeekly(){
 const root={closest(){return {open:false,addEventListener(){}}}};
 const win={RDsb:{session(){return {synthetic:true};},rpc(){throw Error('No remote calls expected');}}};
 const ctx={window:win,document:{
  getElementById(id){return id==='jr-weekly-slot'?root:null;},
  addEventListener(){},documentElement:{lang:'fr'}},
  location:{search:'?q=c8a50cee-3856-4539-98a3-f5df201dbff0'},
  URLSearchParams,Date,console};
 vm.runInNewContext(read('admin/weekly-review.js'),ctx);
 return win.DzoftWeeklyReview;
}
test('weekly review counts categories without copying AI text or raw commit metadata',()=>{
 const w=prepareWeekly();
 const today=new Date().toISOString().slice(0,10);
 const output=w.summary([
  {source_date:today,source_group:'qr',status:'review',title:'Claude-Session secret abc',published_at:null},
  {source_date:today,source_group:'interface',status:'working',title:'RAW Co-Authored-By Claude',published_at:null},
  {source_date:today,source_group:'securite',status:'done',title:'private link https://claude.ai',published_at:'2026-11-13T13:00:00Z'},
  {source_date:'2025-01-01',source_group:'qr',status:'review',title:'old'},
  {source_date:today,source_group:'ai_model_name',status:'done',title:'should not appear'}
 ]);
 assert.equal(output.total,3);
 assert.equal(output.counts.review,1);
 assert.equal(output.counts.working,1);
 assert.equal(output.counts.done,1);
 assert.equal(output.counts.published,1);
 assert.match(output.text,/Internal weekly progress review/);
 assert.doesNotMatch(output.text,/Claude|Co-Authored|secret|claude\.ai|private link|RAW|ai_model_name/);
});
test('Edge worker rejects unauthenticated cron invocations and sends only date/group to RPC',()=>{
 const worker=read('supabase/functions/sync-rodney-github/index.ts');
 assert.match(worker,/Deno\.serve\(/);
 assert.match(worker,/X-DZOFT-Cron-Secret/);
 assert.match(worker,/verify_rodney_sync_token/);
 assert.match(worker,/background_import_rodney_groups/);
 assert.match(worker,/if \(verified !== true\) return response\(401/);
 assert.match(worker,/result\.push\(\{date,group:label\}\)/);
 assert.match(worker,/const unique = date \+ "\\|" \+ label/);
 assert.doesNotMatch(worker,/console\.log|console\.error|GITHUB_TOKEN|post_project_updates|publish_project_updates|process-notification-outbox/);
 const sql=read('supabase/migrations/20261113235920_rodney_background_sync.sql');
 assert.match(sql,/revoke all on function/);
 assert.match(sql,/to service_role;/);
 assert.match(sql,/vault\.create_secret/);
 assert.match(sql,/on conflict on constraint project_work_items_unique_source do nothing/);
 assert.match(sql,/status,category,source_date,source_group,created_by/);
 assert.match(sql,/Raw metadata rejected/);
 assert.doesNotMatch(sql,/publish_project_updates|queue_project_event|insert\s+into\s+public\.email_outbox/i);
});
test('weeklies remain private and present on admin only',()=>{
 const admin=read('admin/suivi.html');
 const client=read('espace/index.html');
 assert.match(admin,/id="jr-weekly-slot"/);
 assert.match(admin,/weekly-review\.js\?v=/);
 assert.doesNotMatch(client,/jr-weekly-slot|rodney_sync_overview|background_import_rodney_groups/);
 new vm.Script(read('admin/weekly-review.js'));
});
