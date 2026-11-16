// The unified menu (workspace-nav-v6.js) replaces the former sidebar tabs and their counters.
// The dashboard must keep drawing its data when those counters no longer exist.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const admin=read('admin/index.html');
const nav=read('admin/workspace-nav-v6.js');

test('counters of the former tabs are optional: a missing one never stops the page',()=>{
 assert.match(admin,/function badge\(id, n\)\{\n    var e = \$\(id\); if \(e\) \{ e\.hidden = !n; e\.textContent = n; \}/);
 for(const id of ['n-new','n-msg','n-trash'])
  assert.doesNotMatch(admin,new RegExp("\\$\\('"+id+"'\\)\\.(hidden|textContent)"),id+' is written without checking it exists');
});

test('menu translation markers sit on the label, so the page translator keeps icon and label',()=>{
 assert.doesNotMatch(nav,/\ba\.dataset\.fr=/);
 assert.match(nav,/label\.dataset\.fr=item\.fr;label\.dataset\.en=item\.en;/);
});

test('the menu survives the page translator replacing text of every [data-fr] element',()=>{
 // Minimal DOM: enough for workspace-nav-v6.js to build its links, then translate.
 function el(tag){return{tagName:tag,children:[],dataset:{},attrs:{},className:'',classList:{add(){}},textContent:'',
  append(...k){this.children.push(...k);},appendChild(k){this.children.push(k);},replaceChildren(){this.children=[];},
  setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},
  querySelector(sel){const cls=sel.slice(1);const walk=n=>{for(const c of n.children){if(String(c.className).split(' ').includes(cls))return c;const r=walk(c);if(r)return r;}return null;};return walk(this);}};}
 const side=el('nav');const listeners={};
 const document={documentElement:{lang:'fr'},createElement:el,getElementById:()=>null,querySelectorAll:()=>[],
  querySelector:s=>s==='#app .side'?side:null,addEventListener:(t,f)=>{listeners[t]=f;}};
 const window={addEventListener(){},DzoftNavigationV6:null};
 vm.runInNewContext(nav,{document,window,location:{pathname:'/dzoft/admin/',hash:'#/factures',search:''},URLSearchParams});
 // What dzoft-language.js does: every [data-fr][data-en] element gets its text replaced.
 const walk=n=>{for(const c of n.children){if(c.dataset.fr&&c.dataset.en){c.textContent=c.dataset.en;c.children=[];}walk(c);}};
 document.documentElement.lang='en';walk(side);
 assert.doesNotThrow(()=>listeners['dzoft:locale-change']());
 const link=side.children.find(c=>c.dataset&&c.dataset.route==='factures');
 assert.ok(link.querySelector('.dzoft-v6-icon'),'icon kept');
 assert.equal(link.querySelector('.dzoft-v6-label').textContent,'Invoices');
});

test('short admin pages start at the top instead of being centred in the window',()=>{
 const css=read('admin/unified-app-shell.css');
 assert.match(css,/body\.dzoft-admin #app \.shell main\{[^}]*margin:0 auto;align-self:start\}/);
 assert.match(admin,/unified-app-shell\.css\?v=20261117-1/);
});

test('the current section is shown again once every late script has built its sections',()=>{
 assert.match(admin,/window\.DzoftReapplyRoute = function\(\)\{ if \(!\/access_token\|error=\/\.test\(location\.hash\)\) fromHash\(\); \};/);
 const last=admin.lastIndexOf('<script src="workspace-nav-v6.js'),reapply=admin.indexOf('window.DzoftReapplyRoute();</script>');
 assert.ok(reapply>last,'re-applied after the last script that builds sections');
 for(const late of ['simplified-ui.js','workspace-panels-v7.js'])assert.ok(admin.indexOf(late)<reapply,late+' runs before the route is re-applied');
});

test('menu counters: new requests on Clients, unread messages on Messages, trash on Paramètres',()=>{
 assert.match(nav,/\{slug:'messages',fr:'Messages',en:'Messages',glyph:'☏'\}/);
 assert.match(admin,/var BADGE_ROUTE = \{'n-new':'clients', 'n-msg':'messages', 'n-trash':'parametres'\};/);
 // Values reported before the menu exists are kept and painted when it is built.
 assert.match(admin,/window\.DzoftMenuCounts\[BADGE_ROUTE\[id\]\] = n;/);
 assert.match(nav,/translate\(\);\npaintAllCounts\(\);/);
 // The counter is beside the label, never inside it: the page translator rewrites labels.
 assert.match(nav,/a\.append\(icon,label,countBadge\(item\.slug\)\)/);
 assert.doesNotMatch(nav,/countBadge[^\n]*dataset\.fr/);
});
