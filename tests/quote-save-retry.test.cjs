const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin/devis.html'),'utf8');
function harness(){
 const start=html.indexOf('  // Serialize owner quote saves.');
 const end=html.indexOf('  function iso(d){',start);
 assert.ok(start>0&&end>start);
 const source=html.slice(start,end);
 const requests=[];
 const dom={sync:{textContent:''},'b-retry':{hidden:true,onclick:null}};
 const el={dataset:{k:'cname'},type:'text',value:'First edit'};
 const context={QID:'test-quote',state:{lines:[],host:[]},KEY:'draft',lastTotal:500,remoteTimer:null,document:{querySelectorAll:()=>[el]},window:{addEventListener:()=>{}},localStorage:{setItem:()=>{}},$:(id)=>dom[id],setTimeout:()=>1,clearTimeout:()=>{},sb:{update:(table,id,payload)=>{
   let resolve,reject;
   const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
   requests.push({table,id,payload,resolve,reject});return promise;
 }}};
 vm.createContext(context);
 vm.runInContext(source,context);
 return {context,dom,el,requests,source};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('quote editor exposes save status and explicit retry, even on narrow screens',()=>{
 assert.match(html,/id="sync" role="status" aria-live="polite"/);
 assert.match(html,/id="b-retry" hidden>Réessayer l’enregistrement/);
 assert.match(html,/\.tools \.sync-retry\{flex:1 1 100%\}/);
});
test('remote saves are serialized and latest edit wins',async()=>{
 const h=harness();
 h.context.save();h.context.flushRemote();await tick();
 assert.equal(h.requests.length,1);
 h.el.value='Newest edit';h.context.lastTotal=700;h.context.save();
 h.context.flushRemote();await tick();
 assert.equal(h.requests.length,1);
 h.requests[0].resolve({});await tick();await tick();
 assert.equal(h.requests.length,2);
 assert.equal(h.requests[0].payload.data.f.cname,'First edit');
 assert.equal(h.requests[1].payload.data.f.cname,'Newest edit');
 assert.equal(h.requests[1].payload.total,700);
 assert.notEqual(h.dom.sync.textContent,'enregistré ✓');
 h.requests[1].resolve({});await tick();await tick();
 assert.equal(h.dom.sync.textContent,'enregistré ✓');
 assert.equal(h.dom['b-retry'].hidden,true);
});
test('save failures retain latest draft and enable manual retry',async()=>{
 const h=harness();h.context.save();h.context.flushRemote();await tick();
 h.requests[0].reject(new Error('offline'));await tick();await tick();
 assert.match(h.dom.sync.textContent,/non enregistrées/);
 assert.equal(h.dom['b-retry'].hidden,false);
 h.context.flushRemote();await tick();assert.equal(h.requests.length,1);
 h.dom['b-retry'].onclick();await tick();
 assert.equal(h.requests.length,2);
 h.requests[1].resolve({});await tick();await tick();
 assert.equal(h.dom.sync.textContent,'enregistré ✓');
 assert.equal(h.dom['b-retry'].hidden,true);
});
test('cancelling pasted request clears only unsaved import text',()=>{
 assert.match(html,/\$\('b-cancel'\)\.onclick = function\(\)\{ \$\('importbox'\)\.classList\.remove\('open'\); \$\('importtext'\)\.value='';/);
});
test('quote inline JavaScript remains parseable',()=>{
 let count=0;
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(m[1].trim()){new vm.Script(m[1]);count++;}
 }
 assert.ok(count>0);
});
