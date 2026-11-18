// 17 Nov 2026: the price list moves to the Catalogue page; dashboard quick buttons open forms inside the chosen project.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const changes=read('assets/change-requests.js'),dash=read('admin/dashboard-v3.js'),index=read('admin/index.html'),
 panels=read('admin/workspace-panels-v7.js'),tracking=read('assets/project-tracking.js'),tabs=read('admin/project-workspace-tabs.js');

test('price list is edited only on the Catalogue page, and the project calculator still reads it',()=>{
 new vm.Script(changes);
 assert.match(changes,/api\.prices=bindPrices/);
 const owner=changes.slice(changes.indexOf('function bindOwner('),changes.indexOf('function readPriceSettings('));
 assert.doesNotMatch(owner,/priceList\(/,'no editable list inside a project');
 assert.doesNotMatch(owner,/data-tier-save|data-default-save|data-block-save|data-block-remove/);
 assert.match(owner,/href="\.\/#\/catalogue"/,'the project links to the Catalogue page');
 assert.match(owner,/select=price_blocks,default_line_price,price_tiers/,'the calculator still loads the prices');
 const prices=changes.slice(changes.indexOf('function bindPrices('));
 assert.match(prices,/price_tiers:next/);assert.match(prices,/default_line_price:dp/);assert.match(prices,/price_blocks:next\.slice\(0,200\)/);
 assert.match(panels,/id="dzoft-prices" data-no-translate/);
 assert.match(panels,/window\.DzoftChanges\.prices\(box,\{sb:window\.RDsb,en:en\(\)\}\)/);
 assert.match(index,/change-requests\.js\?v=2026111[78]-(?:prices|freeprice|since|neutral|sincedate|draft|range|cancel|review|editdraft)/);
});

test('quick buttons only navigate: they never write, and they open the existing forms',()=>{
 new vm.Script(dash);
 const quick=dash.slice(dash.indexOf('var QUICK='),dash.indexOf('translateQuick();\ndocument'));
 assert.doesNotMatch(quick,/\.rpc\(|\.update\(|\.insert\(|\.remove\(/,'no data is written from the dashboard');
 assert.match(quick,/suivi\.html\?q="\+encodeURIComponent\(id\)\+"#billing\/pay"/);
 assert.match(quick,/suivi\.html\?q="\+encodeURIComponent\(id\)\+"#billing\/new-extra"/);
 assert.match(quick,/suivi\.html\?q="\+encodeURIComponent\(id\)\+"#work\/publish"/);
 assert.match(quick,/d\.returnValue==="go"/,'Cancel opens nothing');
 for(const k of ['pay','publish'])assert.match(index,new RegExp('data-quick="'+k+'"'));
 // Extras start from « + Nouveau devis ou supplément » only: no second dashboard button doing the same thing.
 assert.doesNotMatch(index,/data-quick="extra"/);
 assert.match(index,/id="sd-new-extra-choice"/);
 assert.match(tabs,/'billing\/pay':\{pane:'billing'/);assert.match(tabs,/'work\/publish':\{pane:'work'/);
 assert.match(tracking,/function openFromHash\(box,pub\)/);
 assert.match(tracking,/openFromHash\(box,pub\);/);
 // Opening a form never submits it: publishing still needs « Publier et notifier », a payment still needs its confirmation.
 const open=tracking.slice(tracking.indexOf('function openFromHash('),tracking.indexOf('function archiveInvoice('));
 assert.doesNotMatch(open,/\.click\(\)|submit|rpc\(/);
 assert.match(tabs,/'billing\/new-extra':\{extra:true\}/);
 assert.match(tabs,/if\(deep&&deep\.extra\)\{newExtra\(\);return;\}/);
});
