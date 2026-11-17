// Client e-mails follow the language the client chose in their area (17 Nov 2026).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const read=f=>fs.readFileSync(f,'utf8');
const outbox=read('supabase/functions/process-notification-outbox/index.ts');

function outboxFunctions(){
 const src=stripTypeScriptTypes(outbox.replace(/^import .*;$/m,''));
 const ctx={Deno:{serve(){},env:{get(){return '';}}},console,Intl,TextEncoder,TextDecoder,Uint8Array,btoa,atob,createClient(){}};
 vm.createContext(ctx);vm.runInContext(src,ctx);return ctx;
}

test('project e-mails: English wording for clients who chose English, French for everyone else',()=>{
 const f=outboxFunctions();
 const q={numero:'D-2026-001'};
 const step=f.eventCopyEn('step_progress','Étape · Maquettes',q,'',[]);
 assert.match(step.subject,/Your project is moving forward · quote D-2026-001/);
 assert.match(step.intro,/“Maquettes” stage of your project is complete/);
 const digest=f.eventCopyEn('progress_digest','',q,'',[{category:'safety',status:'tested',summary:'Signalement et blocage.'}]);
 assert.match(digest.body,/Safety<\/b> · Tested/);
 assert.match(digest.body,/Signalement et blocage\./,'the summary Roland wrote is sent as written');
 const proposal=f.eventCopyEn('change_proposed','Proposition complémentaire D-2026-001-C1 · 400,00 € · Pages',q,'',[]);
 assert.match(proposal.subject,/Additional proposal D-2026-001-C1 to sign · 400,00 €/);
 assert.match(proposal.body,/Nothing is charged without your signature/);
 assert.match(f.eventCopyEn('something_new','x',q,'',[]).subject,/DZOFT update/);
 const signed=f.eventCopyEn('change_signed','Proposition complémentaire D-2026-001-C1 · 400,00 € · Pages',q,'',[]);
 assert.match(signed.subject,/Your signature has been recorded: proposal D-2026-001-C1 · 400,00 €/);
 assert.match(signed.body,/same terms and conditions of sale/,'acknowledgement keeps the content of the French copy');
 // French stays the default, and the owner's copies stay French.
 assert.match(f.eventCopy('step_progress','Étape · Maquettes',q,'',false,[]).subject,/Votre projet avance/);
 assert.match(outbox,/const english = !isOwner && client\?\.lang === "en";/);
 assert.match(outbox,/english && !paymentEvent \? eventCopyEn\(/,'payment e-mails keep their bilingual wording');
 assert.match(outbox,/select\("id,nom,email,contact,user_id,portal_token,lang"\)/);
});

test('signature codes: e-mail and error messages in the language the client area sends',()=>{
 for(const fn of ['sign-code','change-sign-code']){
  const src=read(`supabase/functions/${fn}/index.ts`);
  assert.match(src,/const en = b\.lang === "en";/,fn);
  assert.match(src,/subject: t\("Votre code de signature : ", "Your signature code: "\) \+ code/,fn);
  assert.match(src,/t\("trop de codes demandés : réessayez dans un moment", "too many codes requested: please try again in a moment"\)/,fn);
 }
 const page=read('espace/index.html');
 assert.match(page,/sb\.fn\('sign-code', \{ quote_id: q\.id, token: token \|\| undefined, lang: EN\(\) \? 'en' : 'fr' \}\)/);
});

test('payment reminders default to the client\'s saved language; the owner can still choose',()=>{
 const src=read('supabase/functions/payment-reminder/index.ts');
 assert.match(src,/const english = b\.lang === "en" \|\| b\.lang === "fr" \? b\.lang === "en" : c\.lang === "en";/);
 assert.match(src,/return reply\(\{lang:english\?"en":"fr",/);
 const dialog=read('assets/payment-reminder.js');
 assert.match(dialog,/var messageLanguage=null;/);
 assert.match(dialog,/if\(!messageLanguage\)messageLanguage=p\.lang==='en'\?'en':'fr';/);
});

test('client area saves the chosen language on the client record',()=>{
 const page=read('espace/index.html');
 assert.match(page,/call\('set_language', \{ p_lang: next \}\)/);
 assert.match(page,/function syncLanguage\(\)\{/);
 const mig=read('supabase/migrations/20261117120000_client_language_and_portal_tracking.sql');
 assert.match(mig,/check \(lang in \('fr', 'en'\)\)/);
 assert.match(mig,/where portal_token = p_token and user_id is null/,'private links only for clients without an account');
});
