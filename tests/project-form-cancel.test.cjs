const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const js=fs.readFileSync(path.join(__dirname,'../assets/project-tracking.js'),'utf8');
test('cancel buttons are added to editable payment, invoice, progress and correction forms',()=>{
 assert.match(js,/function wireDraftCancelButtons\(root\)/);
 assert.match(js,/details\.tracking-editor > form, details\.tracking-link > form, details\.tracking-confirm > form, details\.tracking-correction > form/);
 assert.match(js,/cancel\.type='button'/);
 assert.match(js,/cancel\.textContent=t\('Annuler','Cancel'\)/);
 assert.match(js,/wireDraftCancelButtons\(box\)/);
 assert.match(js,/wireDraftCancelButtons\(pub\)/);
});
test('cancel only clears local draft and refuses to close during a save',()=>{
 const a=js.indexOf('function wireDraftCancelButtons(root){');
 const b=js.indexOf('function invoiceLinkForms(',a);
 assert.ok(a>=0&&b>a);
 const section=js.slice(a,b);
 assert.match(section,/if\(form\.querySelector\('button\[type="submit"\]:disabled'\)\)return/);
 assert.match(section,/form\.reset\(\)/);
 assert.match(section,/detail\.open=false/);
 assert.doesNotMatch(section,/\.rpc\(|\.delete\(|fetch\(|sb\./);
 new vm.Script(js,{filename:'project-tracking.js'});
});
