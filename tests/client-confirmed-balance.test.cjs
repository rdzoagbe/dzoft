'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const tracking=read('assets/project-tracking.js');
const portal=read('espace/index.html');

function extract(from,to){
 const a=tracking.indexOf(from),b=tracking.indexOf(to,a+from.length);
 assert.ok(a>=0&&b>a,from+' must exist before '+to);
 return tracking.slice(a,b);
}
const summarySource=extract('function balanceSummary(d){',' function invoiceArchiveAction(');
const makeSummary=language=>{
 const context={
   t:(fr,en)=>language==='en'?en:fr,
   money:n=>'€'+Number(n).toFixed(2),
   Number
 };
 vm.createContext(context);
 vm.runInContext(summarySource,context);
 return d=>context.balanceSummary(d);
};

test('client balance is read only from the server-side confirmed ledger total',()=>{
 const render=makeSummary('fr');
 const out=render({total:1800,received:550,remaining:1250});
 assert.match(out,/Solde restant à régler/);
 assert.match(out,/€1250.00/);
 assert.match(out,/Paiements confirmés : €550.00/);
 assert.match(out,/Montant convenu : €1800.00/);
 assert.match(out,/Le solde suit les échéances convenues/);
 assert.doesNotMatch(summarySource,/\b(?:invoice|invoices|signature|signed|paid)\b/i);
 assert.doesNotMatch(summarySource,/\b(?:sb|rpc|insert|update|fetch)\s*[.(]/);
});

test('signed or unsigned invoice state cannot create a second payment',()=>{
 const render=makeSummary('en');
 const server={total:2000,received:600,remaining:1400};
 const signedInvoice={id:'signed-illustration',amt:600,paid:true,client_signed_at:'2026-11-20'};
 const unsignedInvoice={id:'unsigned-illustration',amt:600,paid:false};
 assert.equal(render({...server,invoices:[signedInvoice]}),render({...server,invoices:[unsignedInvoice]}));
 assert.match(render(server),/Remaining project balance/);
 assert.match(render(server),/€1400.00/);
 assert.match(render(server),/Only verified payments are deducted/);
});

test('a subsequent server snapshot automatically updates remaining funds',()=>{
 const render=makeSummary('fr');
 assert.match(render({total:2300,received:700,remaining:1600}),/€1600.00/);
 assert.match(render({total:2300,received:950,remaining:1350}),/€1350.00/);
 assert.match(render({total:2600,received:950,remaining:1650}),/€1650.00/);
});

test('invalid data fails closed instead of displaying a fabricated zero',()=>{
 const render=makeSummary('fr');
 for(const value of [null,{}, {total:1500,received:null,remaining:NaN},
   {total:1500,received:500,remaining:-50},{total:Infinity,received:500,remaining:1000}]){
  const out=render(value);
  assert.match(out,/Solde indisponible/);
  assert.doesNotMatch(out,/tracking-balance-amount/);
 }
});

test('both client home and project overview use live tracking RPC, not invoice totals',()=>{
 const a=portal.indexOf('  function paymentSummary(q){'),b=portal.indexOf('  // The project to feature',a);
 assert.ok(a>=0&&b>a,'paymentSummary helper must be defined');
 const snippet=portal.slice(a,b);
 assert.match(snippet,/data-tracking-part="balance"/);
 assert.match(snippet,/data-project-tracking/);
 assert.match(snippet,/Loading verified project balance/);
 assert.match(snippet,/paymentShortcut\(q\)/);
 assert.equal((portal.match(/\+\s*paymentSummary\(q\)/g)||[]).length,2);
 assert.match(portal,/project-tracking\.js\?v=20261120-balance2/);
});

test('payments tab distinguishes remaining project debt from due-now collection',()=>{
 const code=extract('function stats(d,due,clientView){',' function balanceSummary(');
 assert.match(code,/Solde restant à régler/);
 assert.match(code,/Reste à recevoir/);
 assert.match(code,/À régler maintenant/);
 assert.match(tracking,/part==='payments'\?stats\(d,dueNow\(box,d\),true\)/);
 assert.match(tracking,/part==='balance'\?balanceSummary\(d\)/);
 assert.match(tracking,/clientView\?t\('Solde restant à régler'/);
 assert.match(tracking,/Solde ou suivi indisponible/);
 assert.match(tracking,/tracking-help" role="status"/);
});
