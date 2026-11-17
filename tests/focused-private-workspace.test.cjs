// DZOFT private workspace navigation contract: synthetic, no Supabase calls.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('project overview presents exactly four navigable sections and retains all original controls',()=>{
 const html=read('admin/suivi.html');
 const js=read('admin/project-workspace-tabs.js');
 const base=read('admin/project-workspace.js');
 const css=read('admin/project-workspace-tabs.css');
 assert.match(html,/project-workspace\.js\?v=.*" defer/);
 assert.match(html,/project-workspace-tabs\.js\?v=20261115-clean3" defer/);
 assert.match(html,/project-workspace-tabs\.css\?v=20261115-v2/);
 for(const key of ["overview","work","billing","messages"])
  assert.match(js,new RegExp("id:'"+key+"'"));
 for(const id of ["c-steps","c-changes","c-inv","c-care","c-msg","c-note","c-activity","c-share","c-acc","c-env","c-rv","c-journal","c-docs","c-files"]){
  assert.ok(html.includes('id="'+id+'"'),'existing project component '+id+' retained');
  assert.ok(base.includes("'"+id+"'")||js.includes("'"+id+"'"),'component '+id+' kept in layout');
 }
 assert.match(js,/aria-selected/);
 assert.match(js,/aria-controls/);
 assert.match(js,/role','tabpanel'/);
 assert.match(js,/ArrowLeft/);
 assert.match(js,/ArrowRight/);
 assert.match(js,/new MutationObserver\(updateSoon\)/);
 assert.match(js,/document\.addEventListener\('dzoft:locale-change',translate\)/);
 assert.match(css,/project-focus-tabs/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/project-focus-panel\[hidden\]\{display:none!important\}/);
 new vm.Script(js,{filename:'admin/project-workspace-tabs.js'});
});

test('quick actions reveal original sections without initiating payments, invoices or client messages',()=>{
 const js=read('admin/project-workspace-tabs.js');
 assert.match(js,/dest==='documents'\?'c-docs'/);
 assert.match(js,/dest==='history'\?'c-activity'/);
 assert.match(js,/dest==='payment'\?'billing'/);
 assert.match(js,/select\(id,\{scroll:true,target:target\}\)/);
 assert.doesNotMatch(js,/\bsb\.(?:rpc|update|insert|remove|select|fn)\(|\bfetch\(/);
 assert.doesNotMatch(js,/localStorage|sessionStorage/);
});

test('new owner dashboard provides real client, quote, finance and case finder routes',()=>{
 const js=read('admin/dashboard-v3.js');
 const html=read('admin/index.html');
 const css=read('admin/dashboard-v3.css');
 assert.match(html,/dashboard-v3\.js\?v=20261117-todo/);
 assert.match(html,/dashboard-v3\.css\?v=20261117-todo/);
 assert.match(html,/case-finder\.js/);
 assert.match(html,/id="sd-dashboard"/);
 assert.match(html,/id="sd-project-list"/);
 assert.match(html,/id="sd-project-select"/);
 assert.match(js,/location\.hash="#\/devis"/);
 assert.match(html,/data-go="finance"/);
 assert.match(html,/data-go="clients"/);
 assert.match(js,/projectUrl/);
 assert.doesNotMatch(js,/\.rpc\(|\.update\(|\.insert\(|fetch\(|service_role|localStorage/);
 assert.match(css,/max-width:600px/);
 assert.match(read('admin/simplified-ui.js'),/workspace-trash-link/);
 new vm.Script(js,{filename:'admin/dashboard-v3.js'});
});

test('client portal is neither hidden nor modified by the admin-only redesign',()=>{
 const client=read('espace/index.html');
 assert.doesNotMatch(client,/project-workspace-tabs|workspace-home/);
 assert.match(client,/DzoftTracking\.client\(sb\)/);
});
