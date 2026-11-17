const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const finder=read('admin/case-finder.js');
const ui=read('admin/simplified-ui.js');
const styles=read('admin/workspace-flow.css');
const main=read('admin/index.html');
const project=read('admin/project-workspace.js');
const follow=read('admin/suivi.html');

test('all existing private-workspace destinations remain available',()=>{
 for(const section of ['dossiers','finance','inbox','dash','settings','trash'])
   assert.match(main,new RegExp("'"+section+"'"));
 assert.match(ui,/var folder=nav\('dossiers'/);
 assert.match(ui,/var finance=nav\('finance'/);
 assert.match(ui,/workspace-trash-link/);
 assert.match(ui,/#\/corbeille/);
 assert.match(main,/case-finder\.js\?v=/);
 assert.match(main,/workspace-flow\.css\?v=/);
 assert.match(follow,/workspace-flow\.css\?v=/);
 assert.match(follow,/project-workspace\.js\?v=(?:20261115-update4|20261117-onepage)/);
});

test('search across four already rendered datasets, without calls or caching',()=>{
 for(const route of ['demandes','clients','devis','projets'])
   assert.match(finder,new RegExp("slug:'"+route+"'"));
 assert.match(finder,/field\.addEventListener\('input',render\)/);
 assert.match(finder,/found\.slice\(0,24\)/);
 assert.match(finder,/b\.dataset\.group/);
 assert.match(finder,/field\.value\.trim\(\)\.toLocaleLowerCase\(\)/);
 assert.match(finder,/title\.textContent=/);
 assert.match(finder,/description\.textContent=/);
 assert.match(finder,/location\.hash='#\/'\+GROUPS\[group\]\.slug/);
 assert.match(finder,/e\.key==='Escape'/);
 assert.doesNotMatch(finder,/innerHTML\s*=|fetch\(|sb\.rpc|sb\.select|localStorage|sessionStorage|XMLHttpRequest/);
 new vm.Script(finder,{filename:'admin/case-finder.js'});
});

test('project quick actions open existing details without duplicating business logic',()=>{
 // 17 Nov 2026: actions only (record a payment, publish an update, message, add extra work); the tabs are the places.
 for(const action of ['payment','progress','message','extra']){
   assert.match(project,new RegExp('data-workspace-action="'+action+'"'));
 }
 assert.match(project,/target==='documents'\?'c-docs'/);
 assert.match(project,/target==='history'\?'c-activity'/);
 assert.match(project,/if\(x\.tagName==='DETAILS'\)x\.open=true/);
 assert.match(project,/element\.scrollIntoView/);
 assert.doesNotMatch(project,/sb\.rpc\(|sb\.update\(|localStorage|sessionStorage/);
 new vm.Script(project,{filename:'admin/project-workspace.js'});
});

test('responsive styles keep 5 quick actions and details accessible',()=>{
 assert.match(styles,/\.dzoft-case-results/);
 assert.match(styles,/\.workspace-actions/);
 assert.match(styles,/@media\(max-width:800px\)/);
 assert.match(styles,/focus-visible/);
 assert.match(styles,/dzoft-case-finder\[hidden\]/);
 assert.match(styles,/workspace-trash-link/);
 assert.match(styles,/#app \.side \.tab\[data-tab=trash\]/);
 assert.doesNotMatch(styles,/display:none!important.*c-inv|visibility:hidden.*c-steps/);
});
