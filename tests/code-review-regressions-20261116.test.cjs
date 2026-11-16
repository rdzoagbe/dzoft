const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const project=read('admin/project-finance.js');
const nav=read('admin/workspace-nav-v6.js');
const chrome=read('admin/unified-app-shell.js');
const home=read('admin/index.html');
const pages=read('admin/workspace-panels-v7.js');

test('only canonical v6 navigation owns sidebar routes',()=>{
 assert.match(nav,/nav\.replaceChildren\(\)/);
 assert.match(chrome,/shared chrome: brand and breadcrumbs only/);
 assert.doesNotMatch(chrome,/dzoft-global-overview|dzoft-project-nav|dzoft-mobile-project|nav\.replaceChildren/);
 assert.match(chrome,/href='#\/tableau-de-bord'/);
});
test('project financial rerenders do not overwrite v6 section hash links',()=>{
 assert.match(project,/if\(!window\.DzoftNavigationV6\)/);
 for(const id of ['pf-side-dashboard','pf-side-project','pf-side-invoices','pf-side-journal','pf-side-documents'])
   assert.ok(project.includes('"'+id+'"'),id);
 assert.match(project,/setHref\("pf-side-project","#overview"\)/);
 assert.match(project,/setHref\("pf-side-journal","#journal"\)/);
 assert.match(project,/setHref\("pf-side-invoices","#invoices"\)/);
 assert.match(project,/window\.DzoftNavigationV6\.refresh\(\)/);
});
test('project switcher requires a complete UUID before any navigation',()=>{
 assert.match(project,/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}/);
 assert.doesNotMatch(project,/\{27,\}/);
});
test('new owner data cannot temporarily expose old private journal or documents',()=>{
 const begin=home.indexOf("data.unread=data.messages.filter");
 const done=home.indexOf("if(['journal','documents','catalogue'].includes(location.hash.split('/').pop()))loadRichPanels();",begin);
 const block=home.slice(begin,done);
 assert.ok(block.indexOf('richRequest++')>=0);
 assert.ok(block.indexOf('loadingDetails()')>=0);
 assert.ok(block.indexOf('richRequest++')<block.indexOf('render();'));
 assert.ok(block.indexOf('loadingDetails()')<block.indexOf('render();'));
 assert.match(home,/if\(token!==richRequest\)return/);
});
test('invoice register handles real issuedOn date and never assumes payment',()=>{
 assert.match(pages,/i\.issuedOn\|\|i\.date/);
 assert.match(pages,/i\.amt/);
 assert.match(pages,/Issuance does not prove payment/);
 assert.doesNotMatch(pages,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
