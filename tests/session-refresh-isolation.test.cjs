const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../admin/sb.js'),'utf8');
function deferred(){
 let resolve,reject;
 const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});
 return {promise,resolve,reject};
}
function harness(options={}){
 const now=Math.floor(Date.now()/1000);
 const key=options.store || 'rd-admin-session';
 const disk=options.disk||new Map(),calls=[],redirects=[];
 if(options.session!==null&&!options.preexisting)disk.set(key,JSON.stringify(options.session||{
  access_token:'access-A',refresh_token:'refresh-A',
  expires_at:now+(options.expiring?-5:3600),
  user:{id:'owner-id'}
 }));
 const localStorage={
  getItem:(k)=>disk.has(k)?disk.get(k):null,
  setItem:(k,v)=>disk.set(k,v),
  removeItem:(k)=>disk.delete(k)
 };
 const location={
  href:'https://rdzoagbe.github.io/dzoft/espace/',
  hostname:'rdzoagbe.github.io',origin:'https://rdzoagbe.github.io',
  pathname:'/dzoft/espace/',search:'',hash:'',
  replace:(url)=>redirects.push(url)
 };
 const win={RD_STORE:key,localStorage,location,URL,history:{replaceState(){}},isSecureContext:true};
 let refreshGate=options.refreshGate||null,refreshStatus=options.refreshStatus||200;
 async function fetch(url,opts={}){
  const u=new URL(url),name=u.pathname,headers=opts.headers||{};
  calls.push({path:name,authorization:headers.Authorization,body:opts.body||''});
  if(name==='/auth/v1/token'){
   if(refreshGate)await refreshGate.promise;
   if(refreshStatus!==200)return {ok:false,status:refreshStatus,text:async()=>JSON.stringify({message:'refresh declined',code:'invalid_grant'})};
   return {ok:true,status:200,text:async()=>JSON.stringify({access_token:'access-B',refresh_token:'refresh-B',expires_in:3600,user:{id:'owner-id'}})};
  }
  if(name==='/auth/v1/user'){
   const user=options.serverUser||{id:'owner-id',app_metadata:{dzoft_owner:true}};
   return {ok:true,status:200,text:async()=>JSON.stringify(user)};
  }
  return {ok:true,status:200,text:async()=>name.startsWith('/rest/v1/')?'[]':'{}'};
 }
 Object.assign(win,{fetch,atob:(s)=>Buffer.from(s,'base64').toString('latin1'),btoa:(s)=>Buffer.from(s,'latin1').toString('base64'),Uint8Array,navigator:options.locks?{locks:options.locks}:{}});
 const context={window:win,localStorage,fetch,URL,history:win.history,atob:win.atob,btoa:win.btoa,Uint8Array,
  Promise,Date,Number,String,Math,JSON,Error};
 vm.runInNewContext(source,context,{filename:'admin/sb.js'});
 return {sb:win.RDsb,win,calls,disk,redirects,changeRefreshStatus:v=>refreshStatus=v};
}
async function flush(){for(let i=0;i<5;i++)await Promise.resolve();}

test('parallel near-expiry private requests share precisely one rotating refresh',async()=>{
 const d=deferred(),h=harness({expiring:true,refreshGate:d});
 const result=Promise.all([h.sb.select('leads'),h.sb.select('quotes'),h.sb.select('clients')]);
 await flush();
 assert.equal(h.calls.filter(c=>c.path==='/auth/v1/token').length,1);
 d.resolve();
 const rows=await result;assert.equal(rows.length,3);
 const privateCalls=h.calls.filter(c=>c.path.startsWith('/rest/v1/'));
 assert.equal(privateCalls.length,3);
 assert.ok(privateCalls.every(c=>c.authorization==='Bearer access-B'));
 assert.equal(h.sb.session().refresh_token,'refresh-B');
});

test('Web Locks serialize refresh across independent DZOFT tabs sharing storage',async()=>{
 const disk=new Map(),gate=deferred();
 let tail=Promise.resolve();
 const locks={request:(_key,_options,callback)=>{
  const task=tail.then(callback);
  tail=task.catch(()=>{});
  return task;
 }};
 const first=harness({expiring:true,disk,locks,refreshGate:gate});
 const second=harness({preexisting:true,disk,locks});
 const a=first.sb.select('quotes');
 const b=second.sb.select('clients');
 await flush();
 assert.equal(first.calls.filter(x=>x.path==='/auth/v1/token').length,1);
 assert.equal(second.calls.filter(x=>x.path==='/auth/v1/token').length,0);
 gate.resolve();
 await Promise.all([a,b]);
 assert.equal(first.calls.filter(x=>x.path==='/auth/v1/token').length,1);
 assert.equal(second.calls.filter(x=>x.path==='/auth/v1/token').length,0);
 assert.equal(second.calls.find(x=>x.path==='/rest/v1/clients').authorization,'Bearer access-B');
});

test('logout during refresh cannot resurrect old session or make private request',async()=>{
 const d=deferred(),h=harness({expiring:true,refreshGate:d});
 const pending=h.sb.select('leads');
 await flush();
 await h.sb.signOut();
 assert.equal(h.sb.session(),null);
 d.resolve();
 await assert.rejects(pending,/Session changed during refresh/);
 assert.equal(h.sb.session(),null,'The pending old response must never restore login after signout');
 assert.equal(h.calls.filter(c=>c.path==='/rest/v1/leads').length,0);
});

test('outage during refresh preserves credentials, fails closed and allows retry',async()=>{
 const h=harness({expiring:true,refreshStatus:503});
 await assert.rejects(h.sb.select('clients'),e=>e.status===503);
 assert.equal(h.sb.session().access_token,'access-A','Transient outage is not a logout');
 assert.equal(h.calls.filter(c=>c.path.startsWith('/rest/v1/')).length,0);
 h.changeRefreshStatus(200);
 await h.sb.select('clients');
 const privateCalls=h.calls.filter(c=>c.path==='/rest/v1/clients');
 assert.equal(privateCalls.length,1);
 assert.equal(privateCalls[0].authorization,'Bearer access-B');
});

test('invalid refresh token revokes only that session; never falls back to anon',async()=>{
 const h=harness({expiring:true,refreshStatus:400});
 await assert.rejects(h.sb.select('quotes'),e=>e.status===400);
 assert.equal(h.sb.session(),null);
 assert.equal(h.calls.filter(c=>c.path.startsWith('/rest/v1/')).length,0);
});

test('missing session rejects private reads, writes, signed RPC and storage',async()=>{
 const h=harness({session:null});
 const privateOps=[
  ()=>h.sb.select('clients'),
  ()=>h.sb.insert('quotes',{id:'demo'}),
  ()=>h.sb.update('quotes','demo',{status:'sent'}),
  ()=>h.sb.remove('quotes','demo'),
  ()=>h.sb.rpc('is_owner',{},true),
  ()=>h.sb.fn('process-notification-outbox',{}),
  ()=>h.sb.files.list('u/'),
  ()=>h.sb.files.link('file.pdf')
 ];
 for(const op of privateOps)await assert.rejects(op(),e=>e.status===401);
 assert.equal(h.calls.length,0,'No private operation may use the anonymous public key');
 const result=await h.sb.rpc('public_reviews',{});
 assert.equal(h.calls.length,1,'Genuinely public token-scoped RPCs still work');
 assert.deepEqual(Array.from(result),[]);
});

test('owner routing remains server-verified and clients keep client workspace',async()=>{
 const client=harness({store:'rd-client-session',serverUser:{id:'client-id',app_metadata:{}}});
 assert.equal(await client.sb.routeOwner(),false);
 assert.equal(client.redirects.length,0);
 assert.equal(client.disk.has('rd-admin-session'),false);
 const owner=harness({store:'rd-client-session',serverUser:{id:'owner-id',app_metadata:{dzoft_owner:true}}});
 assert.equal(await owner.sb.routeOwner(),true);
 assert.equal(owner.redirects.length,1);
 assert.match(owner.redirects[0],/\/dzoft\/admin\/$/);
 assert.equal(owner.disk.has('rd-client-session'),false);
 assert.equal(owner.disk.has('rd-admin-session'),true);
});

test('admin and client screens hide private UI when session disappears in another tab',()=>{
 const admin=fs.readFileSync(path.join(__dirname,'../admin/index.html'),'utf8');
 const client=fs.readFileSync(path.join(__dirname,'../espace/index.html'),'utf8');
 assert.match(admin,/window\.addEventListener\('storage', function\(event\)/);
 assert.match(admin,/event\.key !== 'rd-admin-session'/);
 assert.match(admin,/activeOwnerId = u\.id/);
 assert.match(admin,/document\.querySelectorAll\('\.modal'\)/);
 assert.match(admin,/\$\('app'\)\.hidden = true;[\s\S]*?location\.reload\(\)/);
 assert.match(client,/event\.key !== 'rd-client-session'/);
 assert.match(client,/activeClientUserId = current && current\.user && current\.user\.id/);
 assert.match(client,/D = null; activeClientUserId = null/);
 assert.match(client,/location\.replace\(location\.pathname\)/);
 assert.match(admin,/sb\.js\?v=20261115-owner-passkey/);
 assert.match(client,/sb\.js\?v=20261115-session-concurrency/);
});
