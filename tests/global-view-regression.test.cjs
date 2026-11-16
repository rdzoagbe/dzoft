const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const admin=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'admin/dashboard-v3.js'),'utf8');
const css=fs.readFileSync(path.join(root,'admin/global-view-v5.css'),'utf8');

// Test the real showView function extracted from the production admin page,
// with only DOM methods stubbed. No owner credentials or network calls.
const start=admin.indexOf('  function showView(v){');
const end=admin.indexOf('  function fromHash(){',start);
assert.ok(start>=0&&end>start,'Production showView implementation is present');
const src=admin.slice(start,end);
function navigate(hash,view){
 const nodes={};
 function node(key){
  if(!nodes[key]){
   const attrs=new Map();
   nodes[key]={
    dataset:{tab:key,dossier:key},
    hidden:false,
    attrs,
    setAttribute(k,v){attrs.set(k,v);},
    getAttribute(k){return attrs.get(k)},
    removeAttribute(k){attrs.delete(k)}
   };
  }
  return nodes[key];
 }
 const dash=node('dash'),group=node('dossiers'),global=node('global');
 const ctx={
  location:{hash},
  VIEWS:['dash','dossiers','leads','clients','quotes','projects','inbox','finance','settings','trash'],
  document:{
   body:{classList:{toggle(name,on){node('body').attrs.set(name,on)}}},
   querySelectorAll(query){
    if(query==='.side .tab')return [dash,group,node('inbox'),node('finance'),node('settings')];
    if(query==='.dossier-pill')return ['leads','clients','quotes','projects'].map(node);
    return [];
   },
   querySelector(query){return query==='.dzoft-global-overview'?global:null}
  },
  $:id=>node(id),
  renderFinance(){}
 };
 vm.runInNewContext(src+';showView('+JSON.stringify(view)+');',ctx);
 return {dash,group,global,nodes};
}
test('Vue globale is the ONLY selected sidebar destination on its route',()=>{
 const x=navigate('#/vue-globale','dash');
 assert.equal(x.dash.getAttribute('aria-selected'),'false');
 assert.equal(x.global.getAttribute('aria-current'),'page');
 assert.equal(x.nodes.body.attrs.get('dzoft-global-view'),true);
 assert.equal(x.nodes['v-dash'].hidden,false);
});
test('global highlight clears when navigating to a client section',()=>{
 const x=navigate('#/dossiers','dossiers');
 assert.equal(x.dash.getAttribute('aria-selected'),'false');
 assert.equal(x.group.getAttribute('aria-selected'),'true');
 assert.equal(x.global.getAttribute('aria-current'),undefined);
 assert.equal(x.nodes.body.attrs.get('dzoft-global-view'),false);
});
test('normal dashboard and global overview do not both select',()=>{
 const x=navigate('#/tableau-de-bord','dash');
 assert.equal(x.dash.getAttribute('aria-selected'),'true');
 assert.equal(x.global.getAttribute('aria-current'),undefined);
});
test('global page title and layout differ from the project dashboard',()=>{
 assert.match(dashboard,/global\?tr\("Vue globale","Global overview"\)/);
 assert.match(dashboard,/addEventListener\("hashchange"/);
 assert.match(css,/dzoft-global-view[^\n]*\.sd-selected\{display:none!important\}/);
 assert.match(css,/\.sd-shortcuts\{display:grid;grid-template-columns:repeat\(4/);
 assert.match(admin,/global-view-v5\.css/);
 assert.match(admin,/dashboard-v3\.js\?v=20261116-global-v5/);
});
