const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function boot(quote){
 const calls=[],root={closest(){return {open:false,addEventListener(){}};}};
 const sb={session(){return {access_token:'synthetic'};},rpc(name,payload){
   calls.push({name,payload});return Promise.resolve({id:'synthetic-task',...payload});
 }};
 const ctx={location:{search:'?q='+quote},URLSearchParams,
  window:{RDsb:sb},document:{getElementById(id){return id==='jr-tasks-slot'?root:null;},addEventListener(){},documentElement:{lang:'fr'}},
  console};
 vm.runInNewContext(read('admin/work-items.js'),ctx);
 return {ui:ctx.window.DzoftWorkItems,calls};
}

test('only generic fixed GitHub categories and date can be saved, with no raw commit or AI metadata',async()=>{
 const {ui,calls}=boot('c8a50cee-3856-4539-98a3-f5df201dbff0');
 await ui.addFromGithub('2026-11-13','qr');
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'save_project_work_item');
 const p=calls[0].payload;
 assert.equal(p.p_title,'GitHub · QR codes et accès aux lieux (à examiner)');
 assert.equal(p.p_source_date,'2026-11-13');
 assert.equal(p.p_source_group,'qr');
 assert.equal(p.p_status,'todo');
 assert.equal(p.p_quote,'c8a50cee-3856-4539-98a3-f5df201dbff0');
 assert.equal('p_commit' in p,false);
 assert.equal('p_author' in p,false);
 assert.doesNotMatch(JSON.stringify(p),/session|co.authored|claude|anthropic|chatgpt|commit.sha|github.com\/commit/i);
 await assert.rejects(()=>ui.addFromGithub('2026-11-13','malicious-metadata'));
 await assert.rejects(()=>ui.addFromGithub('not-a-date','qr'));
 assert.equal(calls.length,1);
});
test('GitHub import cannot accidentally link to another client project',async()=>{
 const {ui,calls}=boot('a36fe804-d77e-40f1-988a-fake00000000');
 await assert.rejects(()=>ui.addFromGithub('2026-11-13','qr'));
 assert.equal(calls.length,0);
});
test('client sharing requires completion plus a separate owner confirmation; source import never publishes',()=>{
 const js=read('admin/work-items.js');
 assert.match(js,/if\(item\.status==='done'\)/);
 assert.match(js,/if\(!summary\|\|!confirm\(/);
 assert.match(js,/publish_project_work_item/);
 assert.match(js,/client_email_status/);
 assert.doesNotMatch(js,/service_role|GITHUB_TOKEN|ANTHROPIC|OPENAI_API_KEY/);
 assert.match(read('admin/github-journal.js'),/DzoftWorkItems\.addFromGithub\(dateKey,groupKey\)/);
 const html=read('admin/suivi.html');
 assert.match(html,/id="jr-tasks-slot"/);
 assert.match(html,/work-items\.js\?v=/);
 assert.match(html,/Le client ne voit jamais ce journal\./);
 new vm.Script(js);
 new vm.Script(read('admin/github-journal.js'));
});
test('project task SQL uses owner-only RPCs, RLS, fixed provenance and atomic one-email publication',()=>{
 const sql=read('supabase/migrations/20261113235000_project_work_items.sql');
 assert.match(sql,/alter table public\.project_work_items enable row level security/);
 assert.match(sql,/revoke all on public\.project_work_items from public,anon,authenticated/);
 assert.match(sql,/auth\.uid\(\) is null or not public\.is_owner\(\)/);
 assert.match(sql,/p_quote <> 'c8a50cee-3856-4539-98a3-f5df201dbff0'/);
 assert.match(sql,/project_work_items_unique_source unique\(quote_id,source_date,source_group\)/);
 assert.match(sql,/if item\.status<>'done' then/);
 assert.match(sql,/perform private\.publish_project_updates/);
 assert.match(sql,/if item\.published_batch=p_batch then/);
 assert.doesNotMatch(sql,/truncate|delete\s+from\s+public\.quotes|update\s+public\.quotes/i);
 const client=read('espace/index.html');
 assert.doesNotMatch(client,/project_work_items|list_project_work_items/);
});
