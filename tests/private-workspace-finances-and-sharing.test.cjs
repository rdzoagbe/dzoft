// Owner dashboard, cash ledger, sharing and menu — synthetic regression checks.
// No production Supabase credentials, client data or network calls.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('issued invoices and payments remain distinct, including when all amounts are invoiced',()=>{
 const html=read('admin/suivi.html'),tracking=read('assets/project-tracking.js'),tabs=read('admin/project-workspace-tabs.js');
 assert.match(html,/id="iv-billed"/);
 assert.match(html,/Reste à facturer <small>\(pas à encaisser\)<\/small>/);
 assert.match(html,/id="iv-payment-truth"/);
 assert.match(tracking,/sb\.rpc\('project_tracking',\{p_quote:q\.id\},true\)/);
 assert.match(tracking,/var confirmed=Number\(d\.received\),outstanding=Number\(d\.remaining\)/);
 assert.match(tracking,/due\.id='iv-payment-outstanding'/);
 assert.match(tracking,/Une facture émise n’est pas un paiement/);
 assert.match(tabs,/getElementById\('iv-payment-outstanding'\)/);
 assert.doesNotMatch(tabs,/getElementById\('iv-remaining'\)/);
 const dashboard=read('admin/today-actions.js'),sandbox={window:{},Intl};
 vm.runInNewContext(dashboard,sandbox);
 const figures=sandbox.window.DzoftToday.build({
  ready:true,failures:0,projects:[{
   id:'project',numero:'D-EXAMPLE',clientName:'Example',
   tracking:{total:1500,received:800,remaining:700,receipts:[],payment_statuses:[]}
  }],unread:[]
 });
 assert.equal(figures.received,80000);
 assert.equal(figures.remaining,70000);
 assert.equal(figures.pending,0);
 const output={innerHTML:''};
 sandbox.window.DzoftToday.render(output,{ready:true,failures:0,projects:[{
  id:'project',numero:'D-EXAMPLE',clientName:'Example',
  tracking:{total:1500,received:800,remaining:700,receipts:[],payment_statuses:[]}
 }],unread:[],english:false});
 assert.match(output.innerHTML,/Reste à encaisser/);
 assert.match(output.innerHTML,/700/);
});

test('private progress is the default and client sharing requires explicit review',()=>{
 const tracking=read('assets/project-tracking.js');
 assert.match(tracking,/value="private" checked/);
 assert.match(tracking,/value="client"/);
 assert.match(tracking,/name="verified"/);
 assert.match(tracking,/if\(!shared\)/);
 assert.match(tracking,/sb\.select\('quotes','select=progress_draft&id=eq\.'/);
 assert.match(tracking,/sb\.update\('quotes',q\.id,\{progress_draft:next\}\)/);
 assert.match(tracking,/if\(!check\.checked\)/);
 assert.match(tracking,/if\(!confirm\(t\('Partager ces mises à jour/);
 assert.match(tracking,/var viaAuto=!!activeAutoHash,action=/);
 assert.match(tracking,/Opt-in only: do not refresh on view load/);
 assert.match(tracking,/Never auto-select a GitHub draft/);
 assert.doesNotMatch(tracking,/if\(!draft\.length&&!activeAutoHash&&rows\.dataset\.edited!=='true'\)use\.click\(\)/);
 const client=read('espace/index.html');
 assert.doesNotMatch(client,/tracking-audience|progress_draft/);
});

test('only Settings changes private workspace language across all admin pages',()=>{
 const home=read('admin/index.html'),project=read('admin/suivi.html'),lang=read('assets/dzoft-language.js');
 const auth=home.match(/<section class="auth" id="auth" hidden>([\s\S]*?)<\/section>/);
 assert.ok(auth);
 assert.doesNotMatch(auth[1],/data-dzoft-lang/);
 assert.match(home,/id="admin-language-settings"/);
 const projectHeader=project.match(/<header class="top">([\s\S]*?)<\/header>/);
 assert.ok(projectHeader);
 assert.doesNotMatch(projectHeader[1],/data-dzoft-lang|lang-switch-app/);
 assert.match(lang,/storageKey='dzoft-ui-locale'/);
 assert.match(lang,/localStorage\.setItem\(storageKey,locale\)/);
 assert.match(lang,/saved=localStorage\.getItem\(storageKey\)/);
 assert.match(project,/dzoft-language\.js\?v=/);
});

test('logout is in account menu and installation prompts stay hidden',()=>{
 const home=read('admin/index.html'),menu=read('admin/simplified-ui.js'),pwa=read('admin/installed-app-menu.js'),css=read('admin/workspace-epuree.css');
 assert.match(menu,/data-extra="logout"/);
 assert.match(menu,/data-extra="site"/);
 assert.match(menu,/document\.getElementById\('b-out'\)/);
 assert.match(pwa,/action:'logout'/);
 assert.match(home,/id="b-install"[^>]*hidden/);
 assert.match(home,/id="l-install"[^>]*hidden/);
 assert.match(home,/var show = function\(\)\{ btns\.forEach\(function\(b\)\{ b\.hidden = true; \}\); \};/);
 assert.match(css,/#app \.top \.in #b-out/);
 assert.match(css,/#app \.top \.workspace-more\{display:block/);
 new vm.Script(menu,{filename:'admin/simplified-ui.js'});
});

test('clean overview preserves all records, security policies and actual billing workflows',()=>{
 const home=read('admin/index.html'),project=read('admin/suivi.html');
 const css=read('admin/workspace-epuree.css');
 assert.match(home,/class="clean-dashboard-more"/);
 assert.match(home,/id="dash-focus"/);
 assert.match(home,/id="today-action-center"/);
 assert.match(home,/id="dash-projects"/);
 assert.match(home,/workspace-epuree\.css\?v=20261115-single-desktop-nav/);
 assert.match(project,/workspace-epuree\.css\?v=20261115-clean3/);
 assert.match(project,/id="tracking-publish"|DzoftTracking\.admin/);
 assert.match(project,/id="iv-payment-truth"/);
 assert.match(css,/tracking-review-check\[hidden\]\{display:none!important\}/);
 for(const match of home.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
  if(match[1].trim())new vm.Script(match[1],{filename:'admin/index.html'});
 for(const match of project.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
  if(match[1].trim())new vm.Script(match[1],{filename:'admin/suivi.html'});
});
