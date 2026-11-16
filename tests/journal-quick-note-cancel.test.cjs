const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin/suivi.html'),'utf8');
test('private journal quick note has Cancel next to Add',()=>{
 assert.match(html,/id="jr-quick-save">Ajouter au journal<\/button>/);
 assert.match(html,/type="button" id="jr-quick-cancel">Annuler<\/button>/);
});
test('Cancel discards only unsaved journal draft and restores current date',()=>{
 const start=html.indexOf("$('jr-quick-cancel').onclick = function(){");
 const end=html.indexOf("$('jr-add').onclick",start);
 assert.ok(start>=0&&end>start);
 const handler=html.slice(start,end);
 assert.match(handler,/jr-quick'\)\.reset\(\)/);
 assert.match(handler,/jr-quick-date'\)\.value = jrToday\(\)/);
 assert.doesNotMatch(handler,/jrSave\(\)|save\(|\.rpc\(|Q\.journal\./);
});
test('admin project inline JavaScript remains parseable',()=>{
 let count=0;for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(match[1].trim()){new vm.Script(match[1]);count++;}}
 assert.ok(count>0);
});
