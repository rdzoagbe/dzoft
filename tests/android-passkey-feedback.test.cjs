const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin/index.html'),'utf8');
const sb=fs.readFileSync(path.join(__dirname,'../admin/sb.js'),'utf8');

function explain(err){
 const begin=html.indexOf('  function passkeyRegistrationMessage(err) {');
 const end=html.indexOf('  function renderDevicePasskeys(',begin);
 assert.ok(begin>=0&&end>begin,'Passkey error classifier must be defined in the owner-only admin');
 const code=html.slice(begin,end);
 return new Function('err',code+'\nreturn passkeyRegistrationMessage(err);')(err);
}

test('Android synced/duplicate passkeys tell owner to try existing sign-in instead of re-registering',()=>{
 const local=explain({name:'InvalidStateError',message:'Authenticator excluded the requested credential'});
 assert.match(local,/already registered or available from your password manager/i);
 assert.match(local,/Sign out and try/);
 const api=explain({name:'Error',code:'webauthn_credential_exists',message:'existing'});
 assert.match(api,/do not need to add it again/i);
 assert.doesNotMatch(api,/remove|delete|revoke/i);
});

test('Passkey error classifier distinguishes other common WebAuthn and Supabase failures',()=>{
 assert.match(explain({code:'passkey_disabled'}),/disabled/);
 assert.match(explain({code:'too_many_passkeys'}),/reached its passkey limit/i);
 assert.match(explain({name:'NotAllowedError'}),/cancelled, unavailable or timed out/);
 assert.match(explain({name:'NotSupportedError'}),/browser or password manager/);
 assert.match(explain({name:'SecurityError'}),/passkey domain/);
 assert.match(explain({code:'webauthn_verification_failed'}),/could not verify/);
 assert.match(explain({code:'webauthn_challenge_expired'}),/expired/);
 assert.match(explain({message:'Complete the account verification step before adding a passkey.'}),/six-digit authenticator verification/i);
 assert.match(explain({status:404}),/registration endpoint is unavailable/);
 assert.match(explain({}),/No new passkey was registered/);
});

test('Existing Google Password Manager passkeys are explained and repeated errors reuse one message',()=>{
 assert.match(html,/Passkeys in Google Password Manager can sync between Chrome on a laptop and Android/);
 assert.match(html,/sign out and choose “Unlock with this device”/i);
 assert.match(html,/rows\.length \? 'Add another passkey' : 'Add a passkey'/);
 assert.match(html,/var progress = null;/);
 assert.match(html,/if \(!progress\) progress = note\(/);
 assert.match(html,/else \{ progress\.className = 'device-feedback'; progress\.textContent =/);
 assert.match(html,/progress\.textContent = passkeyRegistrationMessage\(err\)/);
 assert.doesNotMatch(html,/Could not add this device\. Verify your account and try again/);
 assert.doesNotMatch(html,/Add a passkey on each device you use/);
});

test('No change to passkey privacy, server challenges, MFA or removal logic',()=>{
 assert.match(sb,/if \(!getSession\(\) \|\| !mfaFresh\(12 \* 60 \* 60\)\)/);
 assert.match(sb,/passkeys\/registration\/options/);
 assert.match(sb,/passkeys\/registration\/verify/);
 assert.match(sb,/navigator\.credentials\.create/);
 assert.match(html,/sb\.devicePasskey\.list\(\)/);
 assert.match(html,/sb\.devicePasskey\.remove\(item\.id\)/);
 assert.match(html,/sb\.devicePasskey\.signIn\(\)/);
 assert.match(html,/sb\.mfa\.challenge\(mfaFactor\)/);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const m of scripts)if(m[1].trim())assert.doesNotThrow(()=>new vm.Script(m[1]));
});
