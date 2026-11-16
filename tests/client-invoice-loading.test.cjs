const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin/index.html'),'utf8');
const panel=fs.readFileSync(path.join(__dirname,'../admin/workspace-panels-v7.js'),'utf8');
const begin=html.indexOf('  function loadAll(){');
const end=html.indexOf('  function client(id){',begin);
assert.ok(begin>=0&&end>begin,'Production loadAll located');
const source=html.slice(begin,end);

function run(seed,overrides={}){
 let rendered=0,toasts=[],quoteQueries=0;
 const data={leads:[],quotes:[],clients:[],messages:[],unread:[]},clientBox={innerHTML:''};
 const rows={
  leads:seed.leads||[],
  clients:seed.clients||[],
  quotes:seed.quotes||[],
  messages:seed.messages||[],
  reviews:[],project_events:[],email_outbox:[]
 };
 const ctx={
  Promise,location:{hash:'#/clients'},data,
  loadGeneration:0,loadErrors:{},loadReady:false,
  richDetailsLoaded:false,richDetailsLoading:false,richRequest:0,
  window:{DzoftWorkspacePanelsV6:{loadingDetails(){}}},
  $:id=>id==='clients'?clientBox:null,
  sb:{
   select(table,query){
    if(table==='quotes')quoteQueries++;
    if(overrides[table])return Promise.reject(overrides[table]);
    if(table==='quotes'&&overrides.jsonPath&&query.includes('data->f->>valid')){
      return Promise.reject(Object.assign(new Error('invalid JSON selector'),{status:400}));
    }
    return Promise.resolve(rows[table]||[]);
   },
   rpc(){return Promise.reject(new Error('notification status unavailable'));}
  },
  render(){rendered++;},loadRichPanels(){},
  toast:x=>toasts.push(x),fail:x=>{throw x},console:{warn(){}}
 };
 vm.createContext(ctx);
 vm.runInContext(source+';globalThis.__load=loadAll;',ctx);
 return {ctx,data,clientBox,toasts,run:()=>ctx.__load(),get rendered(){return rendered;},get quoteQueries(){return quoteQueries}};
}
test('failed Messages and monitoring queries do not hide an existing client and invoice',async()=>{
 const x=run({
  clients:[{id:'c1',nom:'Client vérifié'}],
  quotes:[{id:'q1',client_id:'c1',invoices:[{num:'FAC-001',amt:1500}]}]
 },{messages:new Error('messages timed out')});
 await x.run();
 assert.equal(x.rendered,1);
 assert.equal(x.data.clients.length,1);
 assert.equal(x.data.quotes[0].invoices.length,1);
 assert.equal(!!x.ctx.loadErrors.messages,true);
 assert.equal(!!x.ctx.loadErrors.clients,false);
});
test('a failed client read is explicit and never treated as a valid empty result',async()=>{
 const x=run({quotes:[{id:'q1',invoices:[]}]},{clients:new Error('client access error')});
 await x.run();
 assert.equal(x.data.clients.length,0);
 assert.equal(!!x.ctx.loadErrors.clients,true);
 assert.equal(x.data.quotes.length,1);
 assert.match(x.toasts.join(' '),/clients/);
});
test('HTTP 400 JSON-path failures retry the basic quotation select',async()=>{
 const x=run({
  clients:[{id:'c1'}],
  quotes:[{id:'q1',data:{f:{valid:'2026-12-01'}},invoices:[{num:'FAC-001'}]}]
 },{jsonPath:true});
 await x.run();
 assert.equal(x.quoteQueries,2);
 assert.equal(x.data.quotes[0].valid,'2026-12-01');
 assert.equal(!!x.ctx.loadErrors.quotes,false);
});
test('invoice view shows a retryable error instead of false empty invoice state',()=>{
 assert.match(panel,/if\(quotesError\)return/);
 assert.match(panel,/data-retry-owner="invoices"/);
 assert.match(panel,/q\.invoices/);
 assert.match(html,/\['clients','quotes'\]\.filter/);
 assert.match(html,/Promise\.allSettled\(reads\)/);
});
