const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('admin/index.html');
const css=read('admin/settings-redesign.css');

test('redesigned Settings has visible language card and four collapsed groups',()=>{
 const settings=html.split('<section id="v-settings" hidden>')[1].split('</section>')[0];
 assert.match(settings,/class="panel settings-language-panel" id="admin-language-settings"/);
 assert.match(settings,/class="settings-language-intro"/);
 assert.match(settings,/class="lang-switch-app settings-language-switch"/);
 const folds=[...settings.matchAll(/<details class="settings-fold" id="([^"]+)" name="dzoft-settings">/g)].map(m=>m[1]);
 assert.deepEqual(folds,['settings-security','settings-payment','settings-backup','settings-legal']);
 assert.doesNotMatch(settings,/<details class="settings-fold"[^>]*\bopen\b/);
 assert.ok(settings.indexOf('admin-language-settings')<settings.indexOf('settings-security'));
 assert.ok(settings.indexOf('settings-security')<settings.indexOf('settings-payment'));
 assert.match(settings,/settings-fold-status">À vérifier/);
 assert.match(settings,/settings-fold-status">À compléter/);
 assert.match(css,/\.settings-fold\[open\]/);
 assert.match(css,/settings-fold>summary:focus-visible/);
 assert.match(css,/@media\(max-width:650px\)/);
});

test('payment form fields and existing payment saving logic preserved inside Payment',()=>{
 for(const id of ['p-holder','p-bank','p-iban','p-bic','p-link','p-note','p-save','p-msg']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/id="settings-payment"/);
 assert.match(html,/\$\('p-save'\)\.onclick = function\(\)/);
 assert.match(html,/sb\.update\('settings', 1, \{ payment: p, updated_at:/);
 assert.match(html,/id="p-msg" aria-live="polite"/);
});

test('MFA, passkey, recovery and archived terms still available and functional',()=>{
 for(const id of ['settings-security','mfa-box','device-passkey-panel','device-passkeys','settings-backup','backup-readiness','settings-legal'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/sb\.devicePasskey\.register\(\)/);
 assert.match(html,/sb\.mfa\.challenge\(mfaFactor\)/);
 assert.match(html,/href="\.\.\/cgv\.html"/);
 assert.match(html,/href="\.\.\/cgv-2026-10\.html"/);
 assert.match(html,/non vérifiée/);
 assert.match(html,/médiateur de la consommation/);
 assert.doesNotMatch(read('espace/index.html'),/settings-redesign\.css/);
});

test('French and English labels remain translatable, original saved locale still used',()=>{
 const lang=read('assets/dzoft-language.js');
 for(const phrase of ['Account security','Payment methods','Backups and data','Legal documents','Choose your language. Changes apply instantly']){
  assert.ok(lang.includes(phrase), 'Expected English copy: '+phrase);
 }
 assert.match(lang,/storageKey='dzoft-ui-locale'/);
 assert.match(lang,/localStorage\.setItem\(storageKey,locale\)/);
 assert.match(lang,/setLanguage\(saved\)/);
 assert.match(html,/settings-redesign\.css\?v=(?:20261115-(?:1|2)|20261117-blue)/);
 assert.match(html,/dzoft-language\.js\?v=20261115-settings/);
 new vm.Script(lang);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
  if(m[1].trim())new vm.Script(m[1]);
});
