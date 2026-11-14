const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('admin/index.html');
const lang=read('assets/dzoft-language.js');

test('signed-in admin header no longer contains language switch',()=>{
 const header=html.match(/<header class="top">([\s\S]*?)<\/header>/);
 assert.ok(header,'Admin header must exist');
 assert.doesNotMatch(header[1],/lang-switch-app|data-dzoft-lang/);
 assert.match(header[1],/id="b-out"/);
});

test('language control is the first Settings panel, with accessible French and English options',()=>{
 const settings=html.match(/<section id="v-settings" hidden>([\s\S]*?)<\/section>/);
 assert.ok(settings,'Admin Settings must exist');
 const p=settings[1];
 assert.match(p,/id="admin-language-settings"/);
 assert.ok(p.indexOf('id="admin-language-settings"')<p.indexOf('<h3>Paiement</h3>'),'Language must be easy to find above payment settings');
 assert.match(p,/<h3>Langue de l’interface<\/h3>/);
 const fr=p.match(/<button[^>]*data-dzoft-lang="fr"[^>]*>Français<\/button>/);
 const en=p.match(/<button[^>]*data-dzoft-lang="en"[^>]*>English<\/button>/);
 assert.ok(fr&&en,'Settings must offer both languages');
 assert.match(fr[0],/aria-pressed="true"/);
 assert.match(en[0],/aria-pressed="false"/);
 assert.match(p,/role="group" aria-label="Langue de l’interface"/);
 assert.match(html,/\.settings-language-panel \.settings-language-switch button\{[^}]*min-height:44px/);
 assert.match(html,/@media\(max-width:450px\)\{\.settings-language-panel \.settings-language-switch/);
});

test('language selection still works before sign-in and persists on this device',()=>{
 const auth=html.match(/<section class="auth" id="auth" hidden>([\s\S]*?)<\/section>/);
 assert.ok(auth);
 assert.match(auth[1],/lang-switch-app auth-language/);
 assert.match(auth[1],/data-dzoft-lang="fr"/);
 assert.match(auth[1],/data-dzoft-lang="en"/);
 assert.match(lang,/storageKey='dzoft-ui-locale'/);
 assert.match(lang,/localStorage\.setItem\(storageKey,locale\)/);
 assert.match(lang,/saved=localStorage\.getItem\(storageKey\)/);
 assert.match(lang,/b\.addEventListener\('click',\(\)=>setLanguage\(b\.dataset\.dzoftLang\)\)/);
 assert.match(lang,/setLanguage\(saved\)/);
 assert.match(lang,/b\.setAttribute\('aria-pressed',String\(active\)\)/);
 assert.match(lang,/document\.dispatchEvent\(new CustomEvent\('dzoft:locale-change'/);
 assert.match(html,/dzoft-language\.js\?v=20261114-lang-settings/);
});

test('Settings introduction translates correctly; no new permissions or auth changes',()=>{
 assert.match(lang,/'Langue de l’interface': 'Interface language'/);
 assert.match(lang,/Choose the language for your private DZOFT workspace/);
 assert.match(html,/Conditions générales de vente \(version actuelle 2026-11\)/);
 assert.match(html,/href="\.\.\/cgv-2026-10\.html"/);
 assert.match(html,/id="device-passkeys"/);
 assert.match(html,/sb\.devicePasskey\.register\(\)/);
 assert.match(html,/sb\.mfa\.challenge\(mfaFactor\)/);
 new vm.Script(lang,{filename:'assets/dzoft-language.js'});
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[1].trim())new vm.Script(m[1],{filename:'admin/index.html inline'});
 }
});
