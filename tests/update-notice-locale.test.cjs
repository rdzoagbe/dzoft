const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../admin/update-notice.js'),'utf8');

// A minimal DOM makes this a behavior test, rather than another source-text test.
// It does not contact Supabase or create invoices, payments, or messages.
function createPage(){
 const elements=new Map();
 const listeners=new Map();
 function element(tag){
  const handlers=new Map();
  return {
   tagName:tag,style:{},children:[],textContent:'',id:'',
   setAttribute(){},
   addEventListener(event,callback){handlers.set(event,callback);},
   fire(event){const callback=handlers.get(event);assert.ok(callback,'missing event '+event);callback();},
   appendChild(child){this.children.push(child);if(child.id)elements.set(child.id,child);return child;},
   append(...children){children.forEach(child=>this.appendChild(child));},
   remove(){this.removed=true;}
  };
 }
 const settings=element('section');
 elements.set('v-settings',settings);
 const document={
  documentElement:{lang:'fr'},
  createElement:element,
  getElementById(id){return elements.get(id)||null;},
  addEventListener(event,callback){listeners.set(event,callback);},
  visibilityState:'hidden',
  body:element('body')
 };
 const window={addEventListener(){}};
 const fetch=async()=>({ok:true,json:async()=>({version:'2026.11.20.1'})});
 vm.runInNewContext(source,{document,window,navigator:{},fetch,URL,Date,location:{href:'https://example.test/admin/'}});
 return {document,elements,fireLocale(){listeners.get('dzoft:locale-change')();}};
}

test('update-check button, release label, and result translate immediately in both directions',async()=>{
 const page=createPage();
 const button=page.elements.get('dzoft-check-updates');
 const label=page.elements.get('dzoft-build-info');
 const status=page.elements.get('dzoft-update-status');
 assert.ok(button&&label&&status);
 assert.equal(button.textContent,'Vérifier les mises à jour');
 assert.match(label.textContent,/^Version DZOFT : 2026\.11\.20\.1$/);
 button.fire('click');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(status.textContent,'Version publiée vérifiée.');

 page.document.documentElement.lang='en';
 page.fireLocale();
 assert.equal(button.textContent,'Check for updates');
 assert.equal(label.textContent,'DZOFT version: 2026.11.20.1');
 assert.equal(status.textContent,'Published release version verified.');

 page.document.documentElement.lang='fr';
 page.fireLocale();
 assert.equal(button.textContent,'Vérifier les mises à jour');
 assert.equal(status.textContent,'Version publiée vérifiée.');
});