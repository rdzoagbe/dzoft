const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin/suivi.html'),'utf8');

test('Add external invoice opens a proper validated draft with Save and Cancel',()=>{
 assert.match(html,/id="iv-add" type="button" aria-expanded="false"/);
 assert.match(html,/id="iv-external-form" class="iv-external-form" hidden/);
 for (const name of ['description','number','amount']) assert.match(html,new RegExp('name="'+name+'"'));
 assert.match(html,/id="iv-external-cancel">Annuler/);
 assert.match(html,/externalAdd.onclick = function\(\)/);
 assert.match(html,/externalCancel.onclick = closeExternalForm/);
 assert.match(html,/if \(!externalForm.reportValidity\(\)\) return/);
});
test('Creating a draft does not create blank invoices or autosave them',()=>{
 const start=html.indexOf('externalAdd.onclick = function(){');
 const end=html.indexOf('externalForm.onsubmit = function(e){',start);
 assert.ok(start>0&&end>start);
 const click=html.slice(start,end);
 assert.doesNotMatch(click,/Q\.invoices\.push|later\(\)|save\(/);
 assert.doesNotMatch(html,/r\[r\.length - 1\]\.focus\(\)/);
});
test('Save rejects duplicates, cannot mark paid or notify, and only commits on success',()=>{
 const start=html.indexOf('externalForm.onsubmit = function(e){');
 const end=html.indexOf('/* monthly care after delivery:',start);
 assert.ok(start>0&&end>start);
 const handler=html.slice(start,end);
 assert.match(handler,/Number\.isFinite\(amount\)/);
 assert.match(handler,/some\(function\(x\).*String\(x\.num/);
 assert.match(handler,/paid: false/);
 assert.match(handler,/var next = Q\.invoices\.concat\(\[record\]\)/);
 assert.match(handler,/save\(\{client_note: .*invoices: next\}\)/);
 assert.ok(handler.indexOf('Q.invoices = next')>handler.indexOf('if (!ok)'));
 assert.doesNotMatch(handler,/sb\.rpc\(|mailInvoice\(|issueAccepted\(|notify\(sb\)/);
 assert.match(handler,/externalAdd.disabled = true/);
 assert.match(handler,/externalAdd.disabled = false/);
});
test('Page inline scripts remain syntactically valid',()=>{
 let count=0;
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(match[1].trim()){new vm.Script(match[1],{filename:'admin/suivi.html'});count++;}
 }
 assert.ok(count>0);
});
