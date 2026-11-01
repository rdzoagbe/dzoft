const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };

async function requestCase(file, saved, emailed) {
  const html = read(file);
  const source = html.slice(html.indexOf("  var lastLead = ''"), html.indexOf('  if (FORMSPREE_ID) {'));
  const status = {textContent:'', innerHTML:'', scrollIntoView(){}};
  const button = {};
  let writes = 0, resets = 0;
  const values = {prenom:'Test Client',contact:'test@example.invalid',projet:'Site vitrine'};
  const context = {
    Promise, JSON, Error, FormData:class { get(k){return values[k] || '';} },
    f:{reset(){resets++;}}, me:{id:'sample-client',email:values.contact},
    valid:()=>true, projet:()=>values.projet, brief:()=> 'Sample brief',
    accEmail:()=>values.contact, selectedChoices:()=>'', label:()=>'', esc:x=>x,
    showProjectDetails(){}, quoteMore:{}, FORMSPREE_ID:'simulation',
    document:{getElementById:()=>status,querySelectorAll:s=>s==='#send-direct'?[button]:[]},
    window:{RDsb:{submitLead(){writes++;return saved?Promise.resolve():Promise.reject(Error('simulated storage outage'));}}},
    fetch:()=>emailed?Promise.resolve({ok:true}):Promise.reject(Error('simulated mail outage'))
  };
  vm.createContext(context); vm.runInContext(source,context);
  vm.runInContext('sendDirect(); sendDirect();',context);
  await settle();
  assert.equal(writes,1,`${file}: double-click must not duplicate the request`);
  assert.equal(button.disabled,false);
  assert.equal(resets,saved||emailed?1:0,`${file}: retain form data when neither destination received it`);
  assert.equal(status.className,'full fstatus '+(saved||emailed?'ok':'err'));
  assert.equal(Boolean(status.innerHTML),saved,`${file}: only confirm client-space storage after it succeeds`);
  if (!saved && emailed) assert.match(status.textContent,/n’a pas pu|could not/);
  if (!saved && !emailed) {
    vm.runInContext('sendDirect()',context); await settle();
    assert.equal(writes,2,'failed storage must remain retryable');
  }
}

async function signatureCase(ok) {
  const html=read('espace/index.html');
  const source=html.slice(html.indexOf('  WIRE.devis = function(id){'),html.indexOf('  function amsg('));
  const nodes={};
  for(const id of ['q-print','acc','a-ok','a-go','a-name','a-mail','a-code','a-coderow','a-early']) nodes[id]={value:'',checked:false};
  nodes['a-name'].value='Test Client'; nodes['a-ok'].checked=true; nodes['a-code'].value='123456';
  let loaded=0, args, notice='';
  const context={WIRE:{},byId:()=>({id:'sample-quote'}),$:id=>nodes[id],token:null,
    document:{body:{classList:{add(){}}}},window:{print(){}},setTimeout(){},
    TERMS:'v-test',amsg:s=>notice=s,load(){loaded++;return Promise.resolve();},
    sb:{fn:()=>Promise.resolve({target:'test@example.invalid'})},
    call:(name,input)=>{args={name,input};return Promise.resolve(ok?{ok:true}:{ok:false,error:'code incorrect'});}
  };
  vm.createContext(context);vm.runInContext(source,context);context.WIRE.devis('sample-quote');
  assert.equal(nodes['a-go'].disabled,false);
  nodes['a-go'].onclick();await settle();
  assert.equal(args.name,'accept_signed');assert.equal(args.input.p_quote,'sample-quote');
  assert.equal(args.input.p_code,'123456');assert.equal(loaded,ok?1:0);
  if(!ok){assert.match(notice,/incorrect/);assert.equal(nodes['a-go'].disabled,false);}
}

async function validationCase() {
  const html=read('espace/index.html');
  const source=html.slice(html.indexOf('  WIRE.projets = function(id){'),html.indexOf('  function projectDetail('));
  const button={},message={},box={dataset:{step:'design'},querySelector:s=>s==='[data-v]'?button:message};
  let loaded=0,args;
  const context={WIRE:{},byId:()=>({id:'sample-quote',steps:[{k:'design',t:'Design review'}]}),
    wireReview(){},location:{hash:'#/projets/sample-quote'},$:()=>null,
    document:{querySelectorAll:()=>[box]},steps:q=>q.steps,D:{client:{nom:'Test Client'}},
    call:(name,input)=>{args={name,input};return Promise.resolve({ok:true});},load(){loaded++;return Promise.resolve();}};
  vm.createContext(context);vm.runInContext(source,context);context.WIRE.projets('sample-quote');
  button.onclick();await settle();
  assert.equal(args.name,'validate');assert.equal(args.input.p_step,'design');assert.equal(loaded,1);
}

function invoiceCases() {
  const html=read('espace/index.html');
  const source=html.slice(html.indexOf('  function invoices(q){'),html.indexOf('  function careBlock(q){'));
  const context={token:null,esc:x=>String(x),eur:x=>String(x),D:{payment:{}},
    amounts:()=>({ttc:800,dep:240}),depositDone:()=>true,balanceDone:()=>true,rib:()=>''};
  vm.createContext(context);vm.runInContext(source,context);
  const quote={id:'sample-project',invoices:[{id:'sample-invoice',num:'TEST-001',n:'Sample invoice',file:'u/sample/factures/test.pdf',paid:false,amt:240}]};
  let output=context.invoiceList(quote);
  assert.match(output,/data-invoice-file="u\/sample\/factures\/test.pdf"/);
  assert.doesNotMatch(output,/inscription=1/);
  assert.doesNotMatch(context.payBlock(quote),/Tout est réglé/,'unpaid invoice must override a completed handover');
  context.token='sample-secret-link';output=context.invoiceList(quote);
  assert.match(output,/inscription=1&projet=sample-project&facture=sample-invoice/);
  assert.doesNotMatch(output,/data-invoice-file=/,'secret links do not expose authenticated PDF controls');
  context.token=null;quote.invoices[0].paid=true;
  assert.match(context.payBlock(quote),/Tout est réglé/);
}

(async()=>{
  for(const file of ['devis.html','en/quote.html'])
    for(const saved of [false,true]) for(const emailed of [false,true]) await requestCase(file,saved,emailed);
  await signatureCase(true);await signatureCase(false);await validationCase();invoiceCases();
  for(const file of ['devis.html','en/quote.html','espace/index.html','admin/suivi.html'])
    for(const match of read(file).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
      if(match[1].trim() && !match[0].includes('application/ld+json'))new vm.Script(match[1],{filename:file});
  console.log('PASS: 8 request delivery combinations, duplicate/retry handling, successful/rejected signature responses, stage approval, invoice download routing, payment precedence, and script parsing.');
  console.log('These are isolated UI contract checks. They do not send mail, sign a real quote, move money, or verify live delivery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
