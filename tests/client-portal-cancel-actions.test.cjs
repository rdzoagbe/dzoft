const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../espace/index.html'),'utf8');

function body(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Expected source boundaries exist');
 return html.slice(a,b);
}
test('message composer exposes a bilingual Cancel action',()=>{
 assert.match(html,/id="m-send" type="button">Envoyer<\/button><button class="btn line" id="m-cancel" type="button">Annuler/);
 const fn=body("WIRE.messages = function(){","VIEWS.compte = function(){");
 assert.match(fn,/\$\('m-cancel'\)\.onclick/);
 assert.match(fn,/\$\('m-body'\)\.value = ''/);
 assert.match(fn,/\$\('m-send'\)\.disabled\) return/);
 const action=fn.slice(fn.indexOf("$('m-cancel').onclick"),fn.indexOf("$('m-send').onclick"));
 assert.doesNotMatch(action,/call\(|sb\.|\.rpc\(|load\(/);
});
test('initial review can be cancelled and an existing review remains editable',()=>{
 assert.match(html,/'<button class="btn line" type="button" id="rv-cancel">Annuler<\/button>'/);
 assert.doesNotMatch(html,/\(r \? '<button class="btn line" type="button" id="rv-cancel"/);
 const fn=body("function wireReview(q){","function rib(");
 assert.match(fn,/if \(\$\('rv-send'\)\.disabled\) return/);
 assert.match(fn,/if \(q\.review\) route\(\)/);
 assert.match(fn,/location\.hash = '#\/projets'/);
 assert.doesNotMatch(fn.slice(fn.indexOf("$('rv-cancel').onclick"),fn.indexOf("$('rv-send').onclick")) , /call\(|\.rpc\(/);
});
test('account password discard is safe and cannot race with an in-flight update',()=>{
 assert.match(html,/id="c-cancel" type="button">Annuler/);
 const fn=body("WIRE.compte = function(){","\/\* ---------- quote rendering");
 assert.match(fn,/\$\('c-cancel'\)\.onclick/);
 assert.match(fn,/\$\('c-pass'\)\.value = ''/);
 assert.match(fn,/saveButton\.disabled = true; cancelButton\.disabled = true/);
 assert.match(fn,/\.finally\(function\(\)\{ saveButton\.disabled = false; cancelButton\.disabled = false;/);
 const action=fn.slice(fn.indexOf("$('c-cancel').onclick"),fn.indexOf("$('c-save').onclick"));
 assert.doesNotMatch(action,/setPassword\(|call\(|\.rpc\(/);
});
test('client portal inline scripts parse after changes',()=>{
 let count=0;
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[1].trim()){new vm.Script(m[1],{filename:'espace/index.html'});count++;}
 }
 assert.ok(count>0);
});
