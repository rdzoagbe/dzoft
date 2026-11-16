const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const lang=fs.readFileSync(path.join(root,'assets/dzoft-language.js'),'utf8');
test('language controller tracks runtime text and attribute mutations without overriding authored content',()=>{
 assert.match(lang,/characterData:true/);
 assert.match(lang,/attributeFilter:\['placeholder','title','aria-label'\]/);
 assert.match(lang,/r\.type==='characterData'/);
 assert.match(lang,/r\.type==='attributes'/);
 assert.match(lang,/renderedText=new WeakMap\(\)/);
 assert.match(lang,/renderedAttrs=new WeakMap\(\)/);
 assert.match(lang,/current!==renderedText\.get\(n\)/);
 assert.match(lang,/current!==rendered\[attr\]/);
 assert.match(lang,/data-no-translate/);
 new vm.Script(lang);
});
test('admin, project and client surfaces all load the new language controller',()=>{
 for(const pathName of ['admin/index.html','admin/suivi.html','espace/index.html']){
   const html=fs.readFileSync(path.join(root,pathName),'utf8');
   assert.match(html,/dzoft-language\.js\?v=[^"']+&reactive=20261116/);
 }
});
test('financial form labels are translated explicitly, not client-created invoice contents',()=>{
 assert.match(lang,/'Numéro officiel externe':'Existing external invoice number'/);
 assert.match(lang,/'Enregistrer la facture externe':'Save external invoice'/);
 assert.match(lang,/'Enregistrer un encaissement vérifié':'Record verified payment'/);
});


test('French fallback translates English-source authentication help',()=>{
 assert.match(lang,/dzoftFrenchMap\[core\]\|\|core/);
 assert.match(lang,/Saisissez le code à six chiffres de votre application d’authentification/);
 assert.match(lang,/'Mot de passe \(10 caractères minimum\)':'Password \(at least 10 characters\)'/);
 assert.match(lang,/'Pour rectifier une facture déjà émise/);
});
