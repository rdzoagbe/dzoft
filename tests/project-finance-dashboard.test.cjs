const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('admin/projet.html'), js=read('admin/project-finance.js'), css=read('admin/project-finance.css');
const admin=read('admin/index.html');

test('project dashboard is reachable from existing client and projects navigation',()=>{
 assert.match(admin,/function openFollow\(id\)\{/);
 assert.match(admin,/q&&q\.accepted_at\?'projet\.html\?q=':'suivi\.html\?q='/);
 assert.match(admin,/q\.accepted_at \? 'projet\.html\?q=' : 'suivi\.html\?q='/);
 assert.match(html,/project-finance\.js\?v=/);
 assert.match(html,/project-finance\.css\?v=/);
 assert.match(html,/href="\.\/#\/dossiers"/);
 assert.match(html,/id="pf-tabs"/);
 for(const tab of ['overview','quotes','invoices','payments','extras','activity'])
   assert.match(html,new RegExp('data-panel="'+tab+'"'));
});

test('desktop layout and mobile installed PWA access are responsive and navigable',()=>{
 assert.match(css,/grid-template-columns:238px minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:1050px\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:385px\)/);
 assert.match(css,/\.pf-shell\.pf-menu-open \.pf-sidebar/);
 assert.match(js,/aria-expanded/);
 assert.match(html,/aria-controls="pf-sidebar"/);
 assert.match(html,/role="tablist"/);
 assert.match(html,/role="tab"/);
 assert.match(html,/<dialog class="pf-dialog"/);
 assert.match(css,/:focus-visible/);
});

test('financial figures use accepted contract, server receipts, and client-approved extras only',()=>{
 assert.match(js,/sb\.rpc\("project_tracking",\{p_quote:id\},true\)/);
 assert.match(js,/sb\.rpc\("owner_list_change_requests",\{p_quote:id\},true\)/);
 assert.match(js,/var acceptedStates=\["approved","in_progress","completed"\]/);
 assert.match(js,/r\.decided_at&&amount\(r\.extra_price\)!==null/);
 assert.match(js,/records\.filter\(isApproved\)\.reduce/);
 assert.match(js,/q\.accepted_total/);
 assert.match(js,/amount\(t\.received\)/);
 assert.match(js,/status==="proposed"/);
 assert.doesNotMatch(js,/\.paid\s*\?\s*tr\(/);
 assert.match(html,/Les propositions non acceptées n'augmentent ni le contrat/);
});

test('extra work is delegated to audited existing workflow; no direct invoice or client mutation',()=>{
 assert.match(js,/DzoftChanges\.owner\(root,/);
 assert.match(js,/onInvoice:function\(\)\{dialog\.close\(\);location\.href=projectUrl\("billing"\)/);
 assert.match(html,/Aucune nouvelle facture n'est émise par cette fenêtre/);
 assert.doesNotMatch(js,/sb\.(?:insert|update|remove)\(/);
 assert.doesNotMatch(js,/sb\.rpc\("(?:owner_create_change_proposal|owner_propose_change|issue_accepted_invoice|record_project_receipt)"/);
 assert.match(js,/if\(!sb\|\|!sb\.session\(\)\|\|!validId\)/);
 assert.match(js,/sb\.rpc\("is_owner",\{\},true\)/);
 assert.match(js,/window\.addEventListener\("pagehide",conceal\)/);
 assert.match(js,/\$\("pf-logout"\)\.addEventListener\("click"/);
 assert.match(html,/id="pf-logout"/);
 assert.match(html,/name="referrer" content="no-referrer"/);
});

test('client-supplied text is encoded before DOM injection',()=>{
 assert.match(js,/var esc=function\(v\)/);
 assert.match(js,/esc\(r\.title/);
 assert.match(js,/esc\(text\)/);
 assert.match(js,/esc\(r\.number\)/);
 assert.match(js,/esc\(x\.method/);
 assert.match(js,/textContent=value/);
});

test('Admin routes and MFA return whitelist include the new project workflow',()=>{
 const quote=read('admin/devis.html');
 const detail=read('admin/suivi.html');
 const tabs=read('admin/project-workspace-tabs.js');
 assert.match(admin,/\(\?:devis\|suivi\|projet\)/);
 assert.match(quote,/q\.accepted_at \? 'projet\.html\?q=' : 'suivi\.html\?q='/);
 assert.match(detail,/id="suivi-back"/);
 assert.match(detail,/Q\.accepted_at \? 'projet\.html\?q='/);
 assert.match(js,/projectUrl\("work\/c-journal"\)/);
 assert.match(js,/projectUrl\("work\/c-docs"\)/);
 assert.match(js,/projectUrl\("billing"\)/);
 assert.match(tabs,/'work\/c-docs':\{pane:'work',target:'c-docs'\}/);
 assert.match(tabs,/'work\/c-journal':\{pane:'work',target:'c-journal'\}/);
 assert.match(tabs,/'billing\/c-inv':\{pane:'billing',target:'c-inv'\}/);
 assert.match(js,/function mfaExpired\(\)/);
 assert.match(js,/encodeURIComponent\("projet\.html\?q="\+id\)/);
 assert.doesNotMatch(html,/Devis & chiffrage/);
});
