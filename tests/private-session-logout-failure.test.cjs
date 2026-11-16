const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const admin=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
const client=fs.readFileSync(path.join(root,'espace/index.html'),'utf8');
function snippet(source,first,last){
 const a=source.indexOf(first),b=source.indexOf(last,a+first.length);
 assert.ok(a>=0&&b>a,'expected logout handler code');
 return source.slice(a,b);
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('admin: private content and modals hide before network logout completes; failed logout reloads',async()=>{
 const code=snippet(admin,'  function logoutPrivateWorkspace(){','  function start(){');
 let resolve,reject,reloads=0,authShown=0;
 const logout=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const ids={app:{hidden:false},auth:{hidden:true},'mfa-out':{},'b-out':{}};
 const modals=[{hidden:false},{hidden:false}];
 const ctx={activeOwnerId:'owner-test',document:{querySelectorAll:()=>modals},$:id=>ids[id],showForm:()=>authShown++,sb:{signOut:()=>logout},location:{reload:()=>reloads++},Promise};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 ids['b-out'].onclick();
 assert.equal(ids.app.hidden,true);
 assert.ok(modals.every(m=>m.hidden));
 assert.equal(ids.auth.hidden,false);assert.equal(authShown,1);
 assert.equal(ctx.activeOwnerId,null);
 reject(Error('network unavailable'));await tick();await tick();
 assert.equal(reloads,1);
});
test('client: account and guest link disappear immediately, even if signOut rejects',async()=>{
 const code=snippet(client,'  function logout(){', "  $('b-out').onclick = logout;");
 let reject,replacements=0,visible='app',removed=[];
 const request=new Promise((yes,no)=>reject=no);
 const ctx={D:{private:'fixture'},activeClientUserId:'user-test',token:'guest-link-test',show:id=>visible=id,
  localStorage:{removeItem:key=>removed.push(key)},sb:{signOut:()=>request},location:{pathname:'/espace/',replace:()=>replacements++},Promise};
 vm.createContext(ctx);vm.runInContext(code,ctx);ctx.logout();
 assert.equal(ctx.D,null);assert.equal(ctx.token,null);assert.equal(ctx.activeClientUserId,null);
 assert.equal(visible,'s-load');assert.deepEqual(removed,['rd-espace']);
 reject(Error('offline'));await tick();await tick();
 assert.equal(replacements,1);
});
test('both portal inline scripts remain parseable',()=>{
 for(const [name,html] of [['admin',admin],['client',client]]){
  let checked=0;
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(match[1].trim()){new vm.Script(match[1],{filename:name});checked++;}
  }
  assert.ok(checked>0);
 }
});
