const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('one admin workspace preserves all existing routes behind four primary destinations',()=>{
 const html=read('admin/index.html'),ui=read('admin/simplified-ui.js');
 assert.match(html,/dossiers:'dossiers'/);
 assert.match(html,/finance:'paiements'/);
 for(const slug of ["leads:'demandes'","clients:'clients'","quotes:'devis'","projects:'projets'","inbox:'messages'","settings:'parametres'","trash:'corbeille'"])
  assert.ok(html.includes(slug),'route preserved: '+slug);
 assert.match(ui,/dossiers\.appendChild\(node\)/);
 assert.match(ui,/input\.dispatchEvent\(new Event\('input'/);
 assert.match(html,/if\(v==='finance'\)renderFinance\(\)/);
});

test('finance figures are sourced from confirmed server receipts, never from UI guesses',()=>{
 const html=read('admin/index.html');
 assert.match(html,/sb\.rpc\('project_tracking',\{p_quote:q\.id\},true\)/);
 assert.match(html,/r\.summary\.received/);
 assert.match(html,/r\.summary\.remaining/);
 assert.match(html,/Some project balances are unavailable/);
 assert.doesNotMatch(read('admin/simplified-ui.js'),/localStorage\./);
});

test('one project workspace reuses existing payment, progress and messaging components',()=>{
 const ui=read('admin/project-workspace.js'),page=read('admin/suivi.html'),tracking=read('assets/project-tracking.js');
 for(const id of ['c-steps','c-inv','c-msg','c-note','c-docs','c-files','c-journal','c-care','c-share','c-acc','c-env','c-activity','c-rv'])
  assert.ok(ui.includes("'"+id+"'"),'section kept: '+id);
 assert.match(ui,/DzoftPlacePaymentSteps/);
 assert.match(ui,/workspace-action="payment"/);
 assert.match(tracking,/record_project_payment/);
 assert.match(tracking,/publish_project_updates/);
 assert.match(page,/DzoftTracking\.admin\(Q, sb, load\)/);
});

test('client portal keeps secondary pages available and authenticated',()=>{
 const html=read('espace/index.html');
 assert.match(html,/primaryNav = \['accueil','projets','devis','messages','documents'\]/);
 assert.match(html,/client-more/);
 assert.match(html,/NAV\.filter\(function\(n\)\{return primaryNav\.indexOf\(n\[0\]\)<0;\}\)/);
 assert.match(html,/DzoftTracking\.client\(sb\)/);
});

test('updated scripts parse as JavaScript and provide compact layouts on mobile',()=>{
 for(const name of ['admin/project-workspace.js','admin/simplified-ui.js']){
  new vm.Script(read(name),{filename:name});
 }
 for(const p of ['admin/index.html','espace/index.html'])
  for(const m of read(p).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
   if(m[1].trim())new vm.Script(m[1],{filename:p});
 for(const p of ['admin/project-workspace.css','admin/simplified-ui.css','espace/simplified-client.css']){
  const css=read(p);
  assert.match(css,/@media\(max-width:/);
  assert.ok(css.length>1000);
 }
});
