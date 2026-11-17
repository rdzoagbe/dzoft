// 17 Nov 2026 (light version of « one project page »): same menu everywhere; each summary on « Dossier client »
// opens the real tool on « Outils du projet »; clear names. Navigation only: nothing is written.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const nav=read('admin/editor-navigation.js'),v6=read('admin/workspace-nav-v6.js'),finance=read('admin/project-finance.js'),project=read('admin/projet.html');
test('the project tools page and the quote editor use the dashboard menu names and order',()=>{
 new vm.Script(nav);
 const labels=[...nav.matchAll(/fr:'([^']+)',en:/g)].map(m=>m[1]);
 const v6labels=[...v6.matchAll(/fr:'([^']+)',en:'[^']+',glyph/g)].map(m=>m[1]);
 assert.deepStrictEqual(labels,v6labels);
 assert.match(nav,/active:!quotePage/,'« Projets » is current on the project tools page');
 assert.doesNotMatch(nav,/\bsb\.(?:update|insert|remove|rpc)\(/);
});
test('each summary tab offers its real tool; overview and extras keep their own buttons',()=>{
 new vm.Script(finance);
 for(const [k,h] of [['invoices','#billing/c-inv'],['payments','#billing/pay'],['journal','#work/c-journal'],['documents','#work/c-docs'],['activity','#messages']])
  assert.match(finance,new RegExp(k+':\\["suivi\\.html\\?q=","'+h.replace(/[/#]/g,m=>'\\'+m)+'"'));
 assert.match(finance,/quotes:\["devis\.html\?q=",""/);
 assert.doesNotMatch(finance,/TOOLS=\{[^}]*overview:/);
 assert.match(project,/id="pf-panel-tool" href="#" hidden/);
 assert.match(project,/Outils du projet ↗/);
 assert.match(read('admin/suivi.html'),/'← Dossier client'/);
});
