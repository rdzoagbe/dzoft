const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const project=read('admin/projet.html');
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
// 17 Nov 2026: projet.html only redirects to the one project page; it no longer renders any data or menu.
test('the old project address redirects only a complete project id',()=>{
 assert.match(project,/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/);
 assert.doesNotMatch(project,/\{27,\}/);
 assert.match(project,/location\.replace\('\.\/#\/projets'\)/);
});
test('new owner data cannot temporarily expose old private journal or documents',()=>{
 const begin=home.indexOf("data.unread=data.messages.filter");
 const done=home.indexOf("if(location.hash.split('/').pop()==='catalogue')loadRichPanels();",begin);
 assert.ok(done>begin);
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
