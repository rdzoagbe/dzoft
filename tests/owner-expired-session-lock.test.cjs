'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const admin=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
function section(src,start,stop){
 const a=src.indexOf(start),b=src.indexOf(stop,a+start.length);
 assert.ok(a>=0&&b>a,'Missing auth guard snippet: '+start);
 return src.slice(a,b);
}
const adminGuard=section(admin,'  function hideOwnerForRecheck(){','  /* ---------------- data ---------------- */');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){
 let resolve,reject;
 const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});
 return {promise,resolve,reject};
}
function ownerHarness(options={}){
 const app={hidden:false},auth={hidden:true},who={textContent:''};
 const modals=[{hidden:false},{hidden:false}],events={};
 const user=options.me||deferred(),owner=options.owner||deferred();
 const messages=[],calls={me:0,isOwner:0};
 const sb={
  aal:()=>options.aal||'aal2',
  mfaFresh:()=>options.fresh!==false,
  me:()=>{calls.me++;return user.promise;},
  rpc:(name)=>{assert.equal(name,'is_owner');calls.isOwner++;return owner.promise;},
  signOut:()=>Promise.resolve()
 };
 const sandbox={
  sb,$:key=>({app,auth,who}[key]||{hidden:true}),
  document:{hidden:!!options.documentHidden,
   querySelectorAll:()=>modals,
   addEventListener:(name,fn)=>events['document:'+name]=fn
  },
  window:{addEventListener:(name,fn)=>events['window:'+name]=fn},
  setInterval:(fn)=>events.interval=fn,
  showForm:(id,msg)=>messages.push({id,msg}),startPending:false,activeOwnerId:'synthetic-owner',
  loadGeneration:4,loadReady:true,
  MFA_WINDOW:7*24*60*60,
  factorOf:(u,type)=>(u.factors||[]).find(f=>f.factor_type===type&&f.status==='verified'),
  askSecondFactor:()=>{app.hidden=true;auth.hidden=false;messages.push({id:'f-mfa'});},
  returnAfterAuth:()=>false,
  loadAll(){},loadSettings(){},renderMfa(){},renderDevicePasskeys(){},fromHash(){},
  location:{reload(){}},Promise
 };
 vm.createContext(sandbox);
 vm.runInContext(adminGuard+';globalThis.__check=checkMfaExpiry;',sandbox);
 return {sandbox,app,auth,modals,events,user,owner,messages,calls,sb};
}

test('valid AAL2 and fresh server-issued MFA leaves visible workspace unchanged',()=>{
 const x=ownerHarness();
 x.sandbox.__check();
 assert.equal(x.app.hidden,false);
 assert.equal(x.auth.hidden,true);
 assert.equal(x.calls.me,0);
 assert.equal(x.sandbox.loadGeneration,4);
});

test('MFA expiration immediately hides financial app and modals before async identity lookup',()=>{
 const x=ownerHarness({fresh:false});
 x.events['window:focus']();
 assert.equal(x.app.hidden,true);
 assert.equal(x.auth.hidden,false);
 assert.ok(x.modals.every(modal=>modal.hidden));
 assert.equal(x.sandbox.activeOwnerId,null);
 assert.equal(x.sandbox.loadGeneration,5);
 assert.equal(x.sandbox.loadReady,false);
 assert.equal(x.calls.me,1);
 assert.equal(x.calls.isOwner,0);
 assert.equal(x.sandbox.startPending,true);
 assert.match(x.messages[0].msg,/vérification de sécurité a expiré/);
});

test('AAL1 downgrade cannot preserve admin UI even when MFA helper spuriously says fresh',()=>{
 const x=ownerHarness({aal:'aal1',fresh:true});
 x.events['document:visibilitychange']();
 assert.equal(x.app.hidden,true);
 assert.equal(x.calls.me,1);
 assert.equal(x.sandbox.loadGeneration,5);
});

test('auth lookup failure keeps private UI shielded and offers retryable login',async()=>{
 const x=ownerHarness({fresh:false});
 x.sandbox.__check();
 x.user.reject(new Error('offline synthetic'));
 await tick();
 assert.equal(x.app.hidden,true);
 assert.equal(x.auth.hidden,false);
 assert.equal(x.sandbox.startPending,false);
 assert.equal(x.sandbox.activeOwnerId,null);
 assert.match(x.messages.at(-1).msg,/Session non vérifiable/);
});

test('non-owner denial while server signout is pending never exposes previous owner data',async()=>{
 const x=ownerHarness({fresh:false});
 x.sandbox.__check();
 x.user.resolve({id:'non-owner',app_metadata:{dzoft_owner:false},factors:[]});
 await tick();
 assert.equal(x.calls.isOwner,1);
 x.owner.resolve(false);
 await tick();
 assert.equal(x.app.hidden,true);
 assert.equal(x.auth.hidden,false);
 assert.equal(x.sandbox.activeOwnerId,null);
});

test('a recheck after recovery cannot skip the actual MFA challenge',async()=>{
 const x=ownerHarness({fresh:false});
 x.sandbox.__check();
 x.user.resolve({id:'synthetic-owner',factors:[{factor_type:'totp',status:'verified',id:'fake-factor'}]});
 await tick();
 assert.equal(x.messages.at(-1).id,'f-mfa');
 assert.equal(x.calls.isOwner,0,'server owner permissions cannot be queried before fresh TOTP');
 assert.equal(x.app.hidden,true);
});


test('owner with no enrolled factor cannot loop from Admin back into AAL2-only private pages',()=>{
 const source=section(admin,'  function safeReturnTarget(){','  function showForm(');
 function check(fresh,url){
  const redirects=[];
  const context={
   sb:{mfaFresh:()=>fresh},MFA_WINDOW:7*24*60*60,
   URLSearchParams,location:{
    search:url,
    replace:v=>redirects.push(v)
   }
  };
  vm.createContext(context);
  vm.runInContext(source+';globalThis.__return=returnAfterAuth;',context);
  const moved=context.__return();
  return {moved,redirects};
 }
 const target='?return='+encodeURIComponent('suivi.html?q=synthetic-quote');
 const recovering=check(false,target);
 assert.equal(recovering.moved,true);
 assert.deepEqual(recovering.redirects,['./#/parametres']);
 const verified=check(true,target);
 assert.equal(verified.moved,true);
 assert.deepEqual(verified.redirects,['./suivi.html?q=synthetic-quote']);
 const nothing=check(false,'');
 assert.equal(nothing.moved,false);
 assert.deepEqual(nothing.redirects,[]);
});

function auxiliaryGuard(page,aal,fresh){
 const txt=fs.readFileSync(path.join(root,page),'utf8');
 const snippet=section(txt,'  function checkMfaExpiry(){','  if (checkMfaExpiry()) return;');
 const redirects=[];
 const document={documentElement:{style:{visibility:'visible'}}};
 const context={
  sb:{aal:()=>aal,mfaFresh:()=>fresh},MFA_WINDOW:7*24*60*60,
  document,location:{
   pathname:'/dzoft/admin/'+page.split('/').pop(),
   search:'?q=synthetic-quote',hash:'#paiements',
   replace:url=>redirects.push(url)
  },
  encodeURIComponent
 };
 vm.createContext(context);
 vm.runInContext(snippet+';globalThis.__check=checkMfaExpiry;',context);
 const result=context.__check();
 return {result,redirects,source:txt,visibility:document.documentElement.style.visibility};
}
for(const page of ['admin/suivi.html','admin/devis.html']){
 test(page+' redirects an AAL1 owner rather than allowing private project data to initialize',()=>{
  const x=auxiliaryGuard(page,'aal1',false);
  assert.equal(x.result,true);
  assert.equal(x.redirects.length,1);
  assert.equal(x.visibility,'hidden','private project content must disappear before redirect');
  assert.ok(x.redirects[0].startsWith('./?return='));
  assert.ok(decodeURIComponent(x.redirects[0].split('?return=')[1]).includes(page.split('/').pop()));
 });
 test(page+' preserves a fresh AAL2 session and handles expired AAL2',()=>{
  const okay=auxiliaryGuard(page,'aal2',true);
  assert.equal(okay.result,false);
  assert.equal(okay.redirects.length,0);
  assert.equal(okay.visibility,'visible');
  const stale=auxiliaryGuard(page,'aal2',false);
  assert.equal(stale.result,true);
  assert.equal(stale.redirects.length,1);
  assert.equal(stale.visibility,'hidden');
  assert.match(stale.source,/window\.addEventListener\('focus', checkMfaExpiry\)/);
 });
}
