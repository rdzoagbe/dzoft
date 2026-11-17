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
// 17 Nov 2026: seven entries; a project's invoices, payments, journal and documents live in the project page.
const routes=['tableau-de-bord','clients','devis','projets','comptabilite','messages','parametres'];

test('one canonical navigation list with seven entries',()=>{
 routes.forEach(slug=>assert.ok(nav.includes("slug:'"+slug+"'"),'missing '+slug));
 assert.equal((nav.match(/\{slug:'/g)||[]).length,7);
 for(const old of ["slug:'factures'","slug:'paiements'","slug:'journal'","slug:'documents'","slug:'catalogue'","slug:'rapports'"])
  assert.ok(!nav.includes(old),'old entry still in the menu: '+old);
 assert.match(nav,/nav\.replaceChildren\(\)/);
 assert.match(nav,/aria-current/);
 assert.doesNotMatch(nav,/location\.replace\(/);
 assert.match(admin,/workspace-nav-v6\.js/);
 assert.match(project,/workspace-nav-v6\.js/);
});
test('old addresses still lead somewhere useful',()=>{
 assert.match(admin,/var OLD_ROUTES = \{paiements:'comptabilite',factures:'comptabilite',rapports:'tableau-de-bord',journal:'projets',documents:'projets'\}/);
 assert.match(admin,/if\(OLD_ROUTES\[h\]\)\{location\.replace\('#\/'\+OLD_ROUTES\[h\]\);return;\}/);
 assert.match(nav,/catalogue:'devis',factures:'comptabilite',paiements:'comptabilite',journal:'projets',documents:'projets'/);
 // Catalogue opens from the Devis page.
 assert.match(admin,/id="b-qcatalogue" href="#\/catalogue"/);
});
test('inside a project the menu marks Projets and the project page keeps its own tabs',()=>{
 assert.match(nav,/var selected=isProject\?'projets':\(ALIAS\[current\]\|\|current\)/);
 assert.doesNotMatch(nav,/ce projet|projectPanel/);
 for(const panel of ['overview','quotes','invoices','payments','journal','documents'])
  assert.ok(project.includes('data-panel="'+panel+'"'),'missing tab '+panel);
 assert.match(projectLogic,/DzoftNavigationV6\.refresh/);
});
test('Comptabilité holds the receipts book, the balances and the invoice register',()=>{
 const current=file('admin/workspace-panels-v7.js');
 assert.match(admin,/finance:'comptabilite'/);
 assert.match(admin,/function receiptsBook\(valid,en\)/);
 assert.match(admin,/Code de commerce, art\. L123-28/);
 assert.match(admin,/bookRows\.sort\(function\(a,b\)\{return a\.date<b\.date\?-1/);
 assert.match(admin,/livre-des-recettes-'\+bookYear\+'\.csv'/);
 assert.match(admin,/var register=\$\('v-invoices'\);if\(register\)register\.hidden=v!=='finance';/);
 assert.match(current,/el\('v-finance'\)\.appendChild\(section\)/);
 // The book only reads verified tracking; it never writes.
 const book=admin.slice(admin.indexOf('function receiptsBook'),admin.indexOf('var financeGeneration'));
 assert.doesNotMatch(book,/sb\.(?:rpc|insert|update|remove)\(/);
});
test('the dashboard never silently selects the only accepted client project',()=>{
 assert.doesNotMatch(admin,/&&routeToPrimaryWorkspace\(\)/);
 assert.match(admin,/Never redirect the whole app into the last accepted client project/);
});

test('operational pages render existing record data rather than only project links',()=>{
 const current=file('admin/workspace-panels-v7.js');
 assert.match(admin,/workspace-panels-v7\.js/);
 assert.match(current,/q\.invoices/);
 assert.match(current,/accepted_data\|\|q\.data/);
 assert.match(current,/setDetails/);
 assert.match(admin,/loadRichPanels/);
 assert.match(admin,/select=id,numero,client_id,accepted_at,journal,docs,data,accepted_data/);
 assert.doesNotMatch(current,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
