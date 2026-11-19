const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../assets/change-requests.js'),'utf8');
const start=ui.indexOf('function proposalExplanation(proposal,opt,portal,en){');
const end=ui.indexOf('function bindOwner(root,options){',start);
assert.ok(start>=0&&end>start,'Formatter from production source available');
const formatter=vm.runInNewContext(ui.slice(start,end)+'\nproposalExplanation',{Intl,Number,String,Math,Array});
const quote={proposal_number:'D-2026-001-C1',extra_price:350,lines:[
 {label:'Logo plus grand et titre centré',qty:1,price:25},
 {label:'Liste du lieu : 3 par ligne',qty:1,price:25},
 {label:'Photo floutée avant le pass',qty:1,price:100},
 {label:'Établissement devient événement',qty:1,price:50},
 {label:'Tutoiement selon le type de compte',qty:1,price:50},
 {label:'Portail avec connexion par Face ID',qty:1,price:50},
 {label:'Durée des QR codes',qty:1,price:50},
 {label:'Écran d’administration refait',qty:1,price:50},
 {label:'Vidéo de présentation offerte',qty:1,price:0},
 {label:'Retours des membres offerts',qty:1,price:0},
 {label:'Remise commerciale (12,5 %)',qty:1,price:-50}
]};
test('formats quote-based explanation with grouped services, gifts and discount',()=>{
 const msg=formatter(quote,{clientName:'Rodney K.',quoteNumber:'D-2026-001'},'https://example.org/client/?projet=uuid',false);
 for(const fragment of ['Bonjour Rodney,','1. PRESTATIONS COMPLÉMENTAIRES','INTERFACE ET PRÉSENTATION',
   'FONCTIONNALITÉS ET EXPÉRIENCE UTILISATEUR','ADMINISTRATION ET SUIVI',
   '2. PRESTATIONS OFFERTES','Vidéo de présentation offerte','Retours des membres offerts',
   '3. RÉCAPITULATIF FINANCIER','400,00','-50,00','350,00',
   '4. VOTRE ACCORD','Aucune facture complémentaire ne sera émise',
   'https://example.org/client/?projet=uuid'])assert.ok(msg.includes(fragment),fragment);
 assert.doesNotMatch(msg,/ATTENTION : le total des lignes diffère/);
 assert.match(msg,/DZOFT — Développement web/);
});
test('formatter uses each saved proposal amount rather than hard-coded client values',()=>{
 const other=formatter({extra_price:120,lines:[{label:'Maintenance supplémentaire',qty:2,price:60}]},
  {quoteNumber:'Q-2026-XX'},'https://example.org/client/',false);
 assert.match(other,/120,00/);
 assert.doesNotMatch(other,/2\. PRESTATIONS OFFERTES/); // no gifts: no gift section
});
test('flags total disagreements for owner review instead of silently misquoting',()=>{
 const msg=formatter({extra_price:110,lines:[{label:'Widget',qty:1,price:100}]},
  {quoteNumber:'Q-1'},'https://example.org/',false);
 assert.match(msg,/ATTENTION : le total des lignes diffère/);
 assert.match(msg,/110,00/);
});
test('English UI explanation remains coherent and dynamically sourced',()=>{
 const msg=formatter({extra_price:20,lines:[{label:'New homepage',qty:1,price:20}]},{quoteNumber:'Q-EN',clientName:'Alex'},'https://example.org/',true);
 assert.match(msg,/Hello Alex/);
 assert.match(msg,/ADDITIONAL WORK/);
 assert.match(msg,/TOTAL PROPOSED/);
 assert.match(msg,/No supplementary invoice will be issued/);
 assert.doesNotMatch(msg,/ATTENTION/);
});
test('manual delivery remains explicitly review-first and never queues a message',()=>{
 const form=ui.slice(ui.indexOf('function openManualShare(proposal){'),ui.indexOf("root.addEventListener('click'",ui.indexOf('function openManualShare(proposal){')));
 assert.match(form,/var msg=proposalExplanation\(proposal,opt,url,en\)/);
 assert.match(form,/data-share-body/);
 assert.match(form,/data-share-outlook/);
 assert.match(form,/data-share-wa/);
 assert.doesNotMatch(form,/owner_send_change_proposal|process-notification-outbox/);
});
