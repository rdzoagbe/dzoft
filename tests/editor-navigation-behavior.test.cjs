const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('admin/editor-navigation.js','utf8');
function run(search='',small=true){
 const created=[];let document;
 function element(){return {attrs:{},events:{},dataset:{},children:[],
  setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.events[k]=f},
  focus(){document.activeElement=this},contains(el){return this.links?.includes(el)},
  querySelector(s){if(s==='nav')return this.nav||(this.nav=element());return this.links?.[0]||null},
  querySelectorAll(s){return s==='a[href]'?this.links:[]},
  insertBefore(){},
  set innerHTML(html){this.html=html;this.links=Array.from(html.matchAll(/<a href="([^"]+)"/g),m=>Object.assign(element(),{href:m[1]}))}
 }}
 const classes=new Set(['dzoft-editor']);
 const body={classList:{contains:k=>classes.has(k),remove:k=>classes.delete(k),toggle(k,on){on?classes.add(k):classes.delete(k)}},querySelector:()=>element(),prepend(){},appendChild(){}};
 document={body,documentElement:{lang:'en'},events:{},getElementById:()=>null,createElement(){const e=element();created.push(e);return e},addEventListener(k,f){this.events[k]=f}};
 const media={matches:small,addEventListener(k,f){this.change=f}};
 vm.runInNewContext(source,{document,window:{matchMedia:()=>media},location:{search,pathname:'/admin/devis.html'},URLSearchParams});
 return {document,media,aside:created[0],toggle:created[1],overlay:created[2]};
}
test('unsaved and malformed quote URLs never offer a project tools destination',()=>{
 for(const q of ['', '?q=invalid']){
  const {aside}=run(q);
  assert.doesNotMatch(aside.html,/href="(?:projet|suivi)\.html/);
  assert.match(aside.html,/\.\/#\/dossiers/);
 }
 const id='12345678-1234-1234-1234-123456789abc';
 const {aside}=run('?q='+id);
 assert.ok(aside.html.includes('projet.html?q='+id));
 assert.ok(aside.html.includes('suivi.html?q='+id));
});
test('closed mobile navigation is inert; opening and Escape restore keyboard focus',()=>{
 const h=run();
 assert.equal(h.aside.inert,true);
 h.toggle.events.click();
 assert.equal(h.aside.inert,false);
 assert.equal(h.toggle.attrs['aria-expanded'],'true');
 assert.equal(h.document.activeElement,h.aside.links[0]);
 h.document.events.keydown({key:'Escape',preventDefault(){}});
 assert.equal(h.aside.inert,true);
 assert.equal(h.overlay.hidden,true);
 assert.equal(h.document.activeElement,h.toggle);
});
test('mobile Tab cycles through navigation; desktop keeps navigation accessible',()=>{
 const h=run();h.toggle.events.click();
 const last=h.aside.links.at(-1);last.focus();
 h.document.events.keydown({key:'Tab',preventDefault(){}});
 assert.equal(h.document.activeElement,h.aside.links[0]);
 h.document.events.keydown({key:'Tab',shiftKey:true,preventDefault(){}});
 assert.equal(h.document.activeElement,last);
 h.media.matches=false;h.media.change();
 assert.equal(h.aside.inert,false);assert.equal(h.overlay.hidden,true);
});
test('menu close control follows the current language',()=>{
 const h=run();assert.equal(h.overlay.attrs['aria-label'],'Close navigation');
 h.document.documentElement.lang='fr';h.document.events['dzoft:locale-change']();
 assert.equal(h.overlay.attrs['aria-label'],'Fermer la navigation');
});
test('cancelling journal import discards only its local text and restores focus',()=>{
 const html=fs.readFileSync('admin/suivi.html','utf8');
 const handler=html.match(/\$\('jr-cancel'\)\.onclick = function\(\)\{([^]*?)\};/)[1];
 const controls={'jr-text':{value:'unsaved'},'jr-bulk':{hidden:false},'jr-paste':{focus(){this.focused=true}}};
 vm.runInNewContext(handler,{$:id=>controls[id]});
 assert.equal(controls['jr-text'].value,'');assert.equal(controls['jr-bulk'].hidden,true);assert.equal(controls['jr-paste'].focused,true);
});
