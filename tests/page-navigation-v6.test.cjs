const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const admin=file('admin/index.html');
const project=file('admin/projet.html');
const nav=file('admin/workspace-nav-v6.js');
const panels=file('admin/workspace-panels-v6.js');
const projectLogic=file('admin/project-finance.js');
const routes=['tableau-de-bord','clients','projets','devis','factures','paiements','journal','documents','catalogue','rapports','parametres'];

test('one canonical page-by-page navigation list supports all expected screenshot destinations',()=>{
 routes.forEach(slug=>assert.ok(nav.includes("slug:'"+slug+"'"),'missing '+slug));
 assert.match(nav,/nav\.replaceChildren\(\)/);
 assert.match(nav,/aria-current/);
 assert.doesNotMatch(nav,/location\.replace\(/);
 assert.match(admin,/workspace-nav-v6\.js/);
 assert.match(project,/workspace-nav-v6\.js/);
});
test('every global page has a registered controller and visible view region',()=>{
 for(const slug of ['factures','journal','documents','catalogue','rapports'])
   assert.ok(admin.includes("'"+slug+"'"),'unregistered route: '+slug);
 for(const view of ['invoices','journal','documents','catalogue','reports'])
   assert.ok(panels.includes("'"+view+"'"),'missing page panel: '+view);
 assert.match(admin,/\['dash','dossiers','inbox','finance','settings','trash','invoices','journal','documents','catalogue','reports'\]/);
 assert.match(panels,/window\.DzoftWorkspacePanelsV6/);
});
test('project navigation remains context aware and matches project section tabs',()=>{
 for(const panel of ['overview','quotes','invoices','payments','journal','documents']){
  assert.ok(nav.includes("projectPanel:'"+panel+"'"),'missing project panel '+panel);
  assert.ok(project.includes('data-panel="'+panel+'"'),'missing tab '+panel);
 }
 assert.match(nav,/encodeURIComponent\(id\)/);
 assert.match(projectLogic,/DzoftNavigationV6\.refresh/);
 assert.match(nav,/pf-side-invoices/);
 assert.match(nav,/pf-side-journal/);
 assert.match(nav,/pf-side-documents/);
});
test('new reports are read-only, validated and explicitly incomplete if tracking missing',()=>{
 assert.match(panels,/trackings\[p\.id\]/);
 assert.match(panels,/available===projects\.length/);
 assert.match(panels,/partial totals are not presented as final/i);
 assert.match(panels,/valid\.test\(id\)/);
 assert.doesNotMatch(panels,/\.insert\(|\.update\(|\.delete\(|\.rpc\(|localStorage|sessionStorage/);
});
test('the dashboard never silently selects the only accepted client project',()=>{
 assert.doesNotMatch(admin,/&&routeToPrimaryWorkspace\(\)/);
 assert.match(admin,/Never redirect the whole app into the last accepted client project/);
});

test('operational pages render existing record data rather than only project links',()=>{
 const current=file('admin/workspace-panels-v7.js');
 assert.match(admin,/workspace-panels-v7\.js/);
 assert.match(current,/q\.invoices/);
 assert.match(current,/detailed\('journal'\)/);
 assert.match(current,/detailed\('docs'\)/);
 assert.match(current,/accepted_data\|\|q\.data/);
 assert.match(current,/setDetails/);
 assert.match(current,/trackingReady/);
 assert.match(admin,/loadRichPanels/);
 assert.match(admin,/select=id,numero,client_id,accepted_at,journal,docs,data,accepted_data/);
 assert.doesNotMatch(current,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
