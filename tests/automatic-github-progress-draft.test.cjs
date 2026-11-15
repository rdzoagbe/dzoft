const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('new GitHub activity prepares a PRIVATE and idempotent draft, never a client notification',()=>{
 const sql=read('supabase/migrations/20261114220000_auto_github_progress_drafts.sql');
 assert.match(sql,/progress_auto_draft jsonb/);
 assert.match(sql,/dzoft_progress_auto_insert/);
 assert.match(sql,/referencing new table as new_github_items for each statement/i);
 assert.match(sql,/owner_refresh_github_progress_draft/);
 assert.match(sql,/private\.dzoft_refresh_github_progress_draft/);
 assert.match(sql,/if q\.progress_auto_draft->>'source_hash' = fingerprint/);
 assert.match(sql,/q\.progress_auto_draft->>'published_hash'/);
 assert.match(sql,/'status','working'/);
 assert.doesNotMatch(sql,/'status','tested'|'status','built'/);
 assert.match(sql,/from public\.project_work_items w/);
 assert.match(sql,/source_group is not null/);
 assert.match(sql,/revoke all on function/);
 assert.match(sql,/auth\.uid\(\) is null or not public\.is_owner\(\)/);
 const section=sql.split('create or replace function public.owner_publish_github_progress_draft')[0];
 assert.doesNotMatch(section,/private\.publish_project_updates|queue_project_event|sendTransacEmail|insert into public\.project_updates/);
});

test('auto publication is owner-approved, single-batch, deduplicated and atomic',()=>{
 const sql=read('supabase/migrations/20261114220000_auto_github_progress_drafts.sql');
 const section=sql.split('create or replace function public.owner_publish_github_progress_draft')[1];
 assert.match(section,/auth\.uid\(\) is null or not public\.is_owner\(\)/);
 assert.match(section,/published_hash'=p_hash/);
 assert.match(section,/private\.publish_project_updates\(p_quote,p_batch,p_items\)/);
 assert.match(section,/jsonb_build_object\('published_hash',p_hash,'published_batch',p_batch::text/);
 assert.match(section,/This GitHub draft was already published/);
});

test('project refresh imports only date/category data and pre-fills only private owner form',()=>{
 const html=read('admin/suivi.html'),tracking=read('assets/project-tracking.js'),journal=read('admin/github-journal.js');
 assert.match(html,/project-tracking\.js\?v=(?:20261114-github-auto|20261115-pay-template|20261115-clean3|20261115-verified-receipts2)/);
 assert.match(html,/github-journal\.js\?v=20261114-github-auto/);
 assert.match(tracking,/owner_refresh_github_progress_draft/);
 assert.match(tracking,/owner_publish_github_progress_draft/);
 assert.match(tracking,/DzoftGithubJournal\.refresh/);
 assert.match(tracking,/activeAutoHash/);
 assert.match(tracking,/rows\.dataset\.edited==='true'/);
 assert.match(tracking,/draft\.length&&!viaAuto/);
 assert.match(journal,/DzoftGithubJournal=\{refresh:/);
 assert.match(journal,/DzoftTracking\.refreshGithubDraft/);
 assert.match(journal,/DzoftWorkItems\.syncFromGithub\(summary\)/);
 assert.doesNotMatch(read('espace/index.html'),/progress_auto_draft|owner_refresh_github_progress_draft|DzoftGithubJournal/);
 assert.match(read('admin/suivi.html'),/done: false, d: ''/);
 new vm.Script(tracking,{filename:'assets/project-tracking.js'});
 new vm.Script(journal,{filename:'admin/github-journal.js'});
});

test('manual journal draft preserved and milestones saved before marking suggestions consumed',()=>{
 const src=read('admin/suivi.html');
 assert.match(src,/var button = \$\('st-proposed-add'\), previous = Q\.steps\.slice\(\)/);
 assert.match(src,/sb\.update\('quotes', QID, \{ steps: previous\.concat\(added\) \}\)/);
 assert.match(src,/done: false, d: ''/);
 assert.match(src,/return clearProposedSteps\(\)\.catch/);
 assert.match(src,/Q\.progress_draft = next;/);
 const tracking=read('assets/project-tracking.js');
 assert.match(tracking,/if\(draft\.length&&!viaAuto\)/);
 assert.match(tracking,/return sb\.update\('quotes',q\.id,\{progress_draft:next\}\)\.then/);
});
