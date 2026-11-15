const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const js=read('admin/installed-app-menu.js');
const css=read('admin/simplified-ui.css');
const html=read('admin/index.html');

test('single-menu script runs only when an installed PWA is on a mobile viewport',()=>{
 assert.match(js,/matchMedia\('\(display-mode: standalone\)'\)/);
 assert.match(js,/navigator\.standalone===true/);
 assert.match(js,/matchMedia\('\(max-width: 980px\)'\)/);
 assert.match(js,/classList\.toggle\('dzoft-installed-mobile',!!\(installed&&mobile\)\)/);
 assert.match(css,/body\.dzoft-admin\.dzoft-installed-mobile #app \.side\{display:none!important\}/);
 assert.match(css,/body\.dzoft-admin\.dzoft-installed-mobile #app \.top \.in>:not\(\.installed-app-menu\)\{display:none!important\}/);
 assert.match(css,/#app \.installed-app-menu\{display:none\}/);
 assert.match(html,/installed-app-menu\.js\?v=20261115-one-menu/);
 assert.match(html,/simplified-ui\.css\?v=20261115-one-menu/);
 assert.doesNotMatch(read('espace/index.html'),/installed-app-menu\.js|dzoft-installed-mobile/);
});

test('one menu includes all routes, public website and existing logout handler',()=>{
 for(const slug of ['tableau-de-bord','dossiers','demandes','clients','devis','projets','messages','paiements','parametres','corbeille'])
  assert.ok(js.includes("slug:'"+slug+"'"),'Missing mobile menu destination '+slug);
 assert.match(js,/url:'\.\.\/\?workspace=admin'/);
 assert.match(js,/action:'logout'/);
 assert.match(js,/document\.getElementById\('b-out'\)/);
 assert.match(js,/if\(existing\)existing\.click\(\)/);
 assert.match(html,/\$\('b-out'\)\.onclick = function\(\)\{ sb\.signOut\(\)/);
 assert.match(js,/location\.hash='#\/'\+item\.dataset\.appRoute/);
 assert.match(js,/addEventListener\('hashchange'/);
 assert.doesNotMatch(js,/fetch\(|sb\.rpc\(|localStorage|window\.location\.reload\(/);
});

test('mobile installed menu is accessible, closes cleanly, and respects language preferences',()=>{
 assert.match(js,/aria-controls="dzoft-installed-menu-panel"/);
 assert.match(js,/aria-expanded="false"/);
 assert.match(js,/menu\.addEventListener\('toggle'/);
 assert.match(js,/menu\.addEventListener\('keydown'/);
 assert.match(js,/event\.key==='Escape'/);
 assert.match(js,/document\.addEventListener\('pointerdown'/);
 assert.match(js,/document\.addEventListener\('dzoft:locale-change',translate\)/);
 assert.match(js,/setAttribute\('aria-current','page'\)/);
 assert.match(js,/label\.dataset\.noTranslate='true'/);
 assert.match(css,/min-height:47px/);
 assert.match(css,/max-height:min\(76dvh,680px\)/);
 assert.match(css,/@media\(max-width:420px\)/);
 new vm.Script(js,{filename:'admin/installed-app-menu.js'});
});

test('regular mobile website and desktop app navigation remain present',()=>{
 const standard=read('admin/simplified-ui.js');
 assert.match(standard,/var folder=nav\('dossiers'/);
 assert.match(standard,/var finance=nav\('finance'/);
 assert.match(standard,/var controls=document\.createElement\('details'\)/);
 assert.match(html,/<nav class="side" role="tablist"/);
 assert.match(html,/id="b-out"/);
 assert.match(css,/@media\(max-width:980px\)/);
 assert.match(css,/#app \.side\{position:fixed/);
 assert.doesNotMatch(js,/document\.querySelector\('\.side'\)\.remove/);
});
