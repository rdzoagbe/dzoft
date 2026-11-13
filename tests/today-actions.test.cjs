const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function widget(){
 const ctx={window:{},Intl};vm.runInNewContext(read('admin/today-actions.js'),ctx);
 return ctx.window.DzoftToday;
}
test('Today separates confirmed money from announced or pending transfers',()=>{
 const w=widget(),data=w.build({ready:true,failures:0,
  projects:[{id:'project-one',numero:'D-TEST',clientName:'Test Customer',
   tracking:{received:450,remaining:1050,
    payment_statuses:[{status:'sent_by_client',amount:350},{status:'cancelled',amount:100}],
    receipts:[{id:'a',amount:450,invoice_id:null}]}}],
  unread:[{client_id:'client-1',clientName:'Customer'}]
 });
 assert.equal(data.received,45000);
 assert.equal(data.pending,35000);
 assert.equal(data.documents,1);
 assert.equal(data.messages,1);
 assert.equal(data.actions[0].category,'reported');
 assert.equal(data.actions[0].target,'follow:project-one');
 assert.ok(data.actions.some(x=>x.category==='invoice'));
 assert.ok(data.actions.some(x=>x.category==='message'));
});
test('a failed RPC cannot be presented as 0 EUR verified',()=>{
 const w=widget(),node={innerHTML:''};
 w.render(node,{ready:true,failures:1,projects:[{id:'p',numero:'D-ERR',clientName:'Test',tracking:null}],unread:[],english:false});
 assert.match(node.innerHTML,/Les montants affichés sont partiels/);
 assert.match(node.innerHTML,/—/);
 assert.doesNotMatch(node.innerHTML,/0,00\s*€/);
});
test('model and HTML prevent raw markup from injected client names',()=>{
 const w=widget(),node={innerHTML:''};
 w.render(node,{ready:true,failures:0,english:false,
  projects:[{id:'p',numero:'D-1',clientName:'<img src=x onerror=alert(1)>',tracking:{received:0,payment_statuses:[{status:'pending',amount:10}],receipts:[]}}],
  unread:[]});
 assert.doesNotMatch(node.innerHTML,/<img/i);
 assert.match(node.innerHTML,/&lt;img/);
 assert.match(node.innerHTML,/Paiement en attente/);
 assert.doesNotMatch(node.innerHTML,/Confirmer la réception/);
});
test('dashboard retains existing navigation and projects, while its actionable panel is read-only',()=>{
 const html=read('admin/index.html'),js=read('admin/today-actions.js');
 assert.match(html,/id="today-action-center"/);
 assert.match(html,/DzoftToday\.render/);
 assert.match(html,/dashboardReceiptFailures/);
 assert.match(html,/sb\.rpc\('project_tracking'/);
 assert.match(html,/data-go="follow:/);
 assert.doesNotMatch(js,/sb\.rpc|fetch\(|localStorage|record_project_payment/);
 new vm.Script(js);
});
