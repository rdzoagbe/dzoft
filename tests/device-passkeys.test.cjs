const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../admin/sb.js'),'utf8');

function context(mock) {
 const events=[], storage=new Map();
 const payload=Buffer.from(JSON.stringify({
  aal:mock.aal || 'aal1',
  amr:mock.aal==='aal2'?[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]:[],
  email:'synthetic@example.invalid'
 })).toString('base64url');
 const jwt='eyJhbGciOiJub25lIn0.'+payload+'.synthetic';
 if (mock.signedIn)storage.set('rd-admin-session',JSON.stringify({
  access_token:jwt,refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'synthetic-user'}
 }));
 const window={
  isSecureContext:true,location:{hostname:'rdzoagbe.github.io',origin:'https://rdzoagbe.github.io'},
  PublicKeyCredential:{
   parseRequestOptionsFromJSON:x=>x,
   parseCreationOptionsFromJSON:x=>x
  },
  navigator:{
   credentials:{
    get:async (opts)=>{
     events.push({type:'get',options:opts});
     return {id:'synthetic-passkey',toJSON:()=>({id:'synthetic-passkey',rawId:'synthetic-passkey',type:'public-key',response:{authenticatorData:'test',clientDataJSON:'test',signature:'test'}})};
    },
    create:async (opts)=>{
     events.push({type:'create',options:opts});
     return {id:'synthetic-passkey',toJSON:()=>({id:'synthetic-passkey',rawId:'synthetic-passkey',type:'public-key',response:{attestationObject:'test',clientDataJSON:'test'}})};
    }
   }
  }
 };
 const requests=[];
 window.fetch=async (url,opts)=>{
  requests.push({url,opts});
  const endpoint=url.split('/auth/v1/')[1]||'';
  let value={};let status=200;
  if(mock.disabled){status=400;value={code:'passkey_disabled',message:'Passkey sign-in disabled'};}
  else if(endpoint==='passkeys/authentication/options')value={challenge_id:'challenge-login',options:{challenge:'YQ',rpId:'rdzoagbe.github.io',userVerification:'required'}};
  else if(endpoint==='passkeys/authentication/verify')value={access_token:jwt,refresh_token:'synthetic-refresh',expires_in:3600,user:{id:'synthetic-user'}};
  else if(endpoint==='passkeys/registration/options')value={challenge_id:'challenge-register',options:{challenge:'YQ',rp:{name:'DZOFT'},user:{id:'YQ',name:'synthetic'},pubKeyCredParams:[{type:'public-key',alg:-7}]}};
  else if(endpoint==='passkeys/registration/verify')value={id:'88888888-8888-4888-8888-888888888888',friendly_name:'Test device'};
  else if(endpoint==='passkeys')value=[{id:'88888888-8888-4888-8888-888888888888',friendly_name:'Test device'}];
  else if(endpoint.indexOf('passkeys/')===0)value={};
  return {ok:status<400,status,text:async()=>JSON.stringify(value)};
 };
 window.localStorage={
  getItem:k=>storage.get(k)||null,
  setItem:(k,v)=>storage.set(k,v),
  removeItem:k=>storage.delete(k)
 };
 window.atob=x=>Buffer.from(x,'base64').toString('latin1');
 window.btoa=x=>Buffer.from(x,'latin1').toString('base64');
 window.Uint8Array=Uint8Array;
 window.URL=URL;
 const sandbox={window,localStorage:window.localStorage,fetch:window.fetch,
  navigator:window.navigator,PublicKeyCredential:window.PublicKeyCredential,
  Uint8Array,Promise,Date,Math,JSON,String,Number,Error,atob:window.atob,btoa:window.btoa};
 vm.runInNewContext(source,sandbox,{filename:'admin/sb.js'});
 return {sb:window.RDsb,requests,events,storage};
}
test('real passkey sign-in requires server-issued challenge, real credential and verified server token',async()=>{
 const ctx=context({});
 const s=await ctx.sb.devicePasskey.signIn();
 assert.equal(s.user.id,'synthetic-user');
 assert.equal(ctx.sb.session().access_token,s.access_token);
 assert.equal(ctx.requests.length,2);
 assert.match(ctx.requests[0].url,/\/auth\/v1\/passkeys\/authentication\/options$/);
 assert.match(ctx.requests[1].url,/\/auth\/v1\/passkeys\/authentication\/verify$/);
 const body=JSON.parse(ctx.requests[1].opts.body);
 assert.equal(body.challenge_id,'challenge-login');
 assert.equal(body.credential.id,'synthetic-passkey');
 assert.equal(ctx.events.length,1);
 assert.equal(ctx.events[0].type,'get');
 assert.equal(ctx.sb.aal(),'aal1');
 assert.equal(ctx.sb.mfaFresh(43200),false);
});
test('disabled passkey backend rejects sign-in and does not create a session',async()=>{
 const ctx=context({disabled:true});
 await assert.rejects(ctx.sb.devicePasskey.signIn(),/Passkey sign-in disabled/);
 assert.equal(ctx.sb.session(),null);
 assert.equal(ctx.events.length,0);
});
test('registration is blocked until a fresh, server-issued AAL2 MFA claim is present',async()=>{
 const ctx=context({signedIn:true,aal:'aal1'});
 await assert.rejects(ctx.sb.devicePasskey.register(),/Complete the account verification step/);
 assert.equal(ctx.requests.length,0);
});
test('registered device binds discoverable credentials and never changes MFA policy',async()=>{
 const ctx=context({signedIn:true,aal:'aal2'});
 const key=await ctx.sb.devicePasskey.register();
 assert.equal(key.friendly_name,'Test device');
 assert.equal(ctx.events[0].type,'create');
 assert.equal(ctx.events[0].options.publicKey.authenticatorSelection.residentKey,'required');
 assert.equal(ctx.events[0].options.publicKey.authenticatorSelection.userVerification,'required');
 assert.match(ctx.requests[0].url,/\/passkeys\/registration\/options$/);
 assert.match(ctx.requests[1].url,/\/passkeys\/registration\/verify$/);
 assert.equal(ctx.sb.aal(),'aal2');
 const list=await ctx.sb.devicePasskey.list();
 assert.equal(list.length,1);
 assert.equal(list[0].friendly_name,'Test device');
});
test('UI has device-first login while retaining password, TOTP and owner enforcement',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../admin/index.html'),'utf8');
 assert.match(html,/id="device-signin"/);
 assert.match(html,/id="email-signin-details"/);
 assert.match(html,/id="device-passkeys"/);
 assert.match(html,/sb\.devicePasskey\.signIn\(\)/);
 assert.match(html,/sb\.devicePasskey\.register\(\)/);
 assert.match(html,/if \(f && !sb\.mfaFresh\(MFA_WINDOW\)\)/);
 assert.match(html,/sb\.rpc\('is_owner', \{\}, true\)/);
 assert.match(html,/sb\.mfa\.challenge\(mfaFactor\)/);
 assert.doesNotMatch(html,/MFA_WINDOW\s*=\s*0|mfaFresh\s*=\s*\(\)\s*=>\s*true/);
 const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const script of inline)if(script[1].trim())assert.doesNotThrow(()=>new vm.Script(script[1]));
});
