const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('French and English landing pages describe the scope-bound fixed price',()=>{
 const fr=read('index.html'),en=read('en/index.html');
 const method=read('methode.html'),englishMethod=read('en/methode.html');
 const faq=read('faq.html'),englishFaq=read('en/faq.html');
 assert.match(fr,/Les demandes supplémentaires après signature peuvent modifier le budget uniquement après votre accord/);
 assert.match(en,/Changes requested after signing may affect the budget only if you approve/);
 assert.doesNotMatch(method,/Le prix ne bouge plus/);
 assert.doesNotMatch(englishMethod,/The price then stays fixed/);
 assert.match(method,/les corrections nécessaires pour respecter le devis signé restent incluses/i);
 assert.match(englishMethod,/corrections needed to deliver the original signed quote remain included/);
 assert.match(faq,/Le prix peut-il changer après la signature du devis/);
 assert.match(englishFaq,/Can the price change after I sign the quote/);
});

test('new terms make additional charges conditional on prior express acceptance',()=>{
 for(const p of ['cgv.html','en/cgv.html']){
  const html=read(p);
  assert.match(html,/Version 2026-12/);
  assert.match(html,/before|avant/i);
  assert.match(html,/accord|accept/i);
  assert.match(html,/corrections|corrections/i);
 }
 assert.match(read('cgv.html'),/aucun supplément n’est facturé/);
 assert.match(read('en/cgv.html'),/no additional charge will be invoiced/);
 const older=read('cgv-2026-10.html');
 const olderEn=read('en/cgv-2026-10.html');
 assert.match(older,/Version 2026-10/);
 assert.match(olderEn,/Version 2026-10/);
 assert.doesNotMatch(older,/Version 2026-11/);
 assert.doesNotMatch(olderEn,/Version 2026-11/);
 // The November terms stay archived, word for word, for agreements signed under them.
 for(const p of ['cgv-2026-11.html','en/cgv-2026-11.html']){
  assert.match(read(p),/Version 2026-11/);
  assert.doesNotMatch(read(p),/Version 2026-12/);
 }
});

test('December terms: written yes before any extra, quote lists the scope, delivery does not wait for a store',()=>{
 const fr=read('cgv.html'),en=read('en/cgv.html');
 assert.match(fr,/qu’après l’accord écrit du client sur ce prix/);
 assert.match(en,/until the client has agreed to that price in writing/);
 assert.match(fr,/Demande d’un montant de 100 € au plus/);
 assert.match(en,/Request of €100 or less/);
 assert.match(fr,/Ce qui ne figure pas dans le devis n’est pas compris/);
 assert.match(fr,/n’engage ni le client ni DZOFT tant que DZOFT ne l’a pas reprise par écrit/);
 assert.match(fr,/Le droit de rétractation de l’article 6 s’applique à chaque complément/);
 assert.match(fr,/ne retardent pas la livraison/);
 assert.match(en,/do not delay delivery/);
 assert.match(fr,/sans préjudice des garanties légales/);
 assert.match(en,/without prejudice to the statutory guarantees/);
 // The published unit prices are the ones the calculator uses.
 for(const price of ['10 €','25 €','50 €','100 €'])assert.ok(fr.includes(price));
});

test('request form asks for the must-have list and says extras need a written yes',()=>{
 const admin=read('admin/index.html');
 for(const p of ['devis.html','en/quote.html']){
  const html=read(p);
  assert.match(html,/id="essentiels"/);
  assert.match(html,/id="comptes-utilisateurs"/);
  assert.match(html,/id="mise-en-ligne"/);
  assert.match(html,/id="decideur"/);
  assert.match(html,/id="scope-note"/);
  assert.match(html,/add\('Fonctions indispensables : ', 'Must-have features: '/);
 }
 assert.match(read('devis.html'),/soumise à votre accord écrit avant d’être réalisée/);
 assert.match(read('en/quote.html'),/submitted for your written agreement before it is done/);
 assert.match(admin,/\['Fonctions indispensables', 'Must-have features'/);
 assert.match(admin,/\['Validation des étapes', 'Who approves'/);
});

test('client quote and signature show new terms; accepted October contracts remain unchanged',()=>{
 const s=read('espace/index.html');
 assert.match(s,/TERMS = 'v2026-12'/);
 assert.match(s,/OLD_TERMS = \{'v2026-10':'cgv-2026-10\.html','v2026-11':'cgv-2026-11\.html'\}/);
 assert.match(s,/OLD_TERMS\[q\.accepted_terms\]\?'\.\.\/'\+OLD_TERMS\[q\.accepted_terms\]:TERMS_URL/);
 assert.match(s,/showNewScopeClause\(q\)/);
 assert.match(s,/Je comprends que toute prestation supplémentaire sera soumise à un nouveau devis/);
 assert.match(s,/Sans accord, aucun supplément n’est facturé/);
 assert.match(s,/q\.accepted_terms==='v2026-11'/);
 const admin=read('admin/devis.html');
 assert.match(admin,/scope-change-quote/);
 assert.match(admin,/q\.accepted_at && q\.accepted_terms !== 'v2026-11' && q\.accepted_terms !== 'v2026-12'/);
 assert.match(admin,/cgv-2026-11\.html/);
 assert.match(admin,/scope-change-quote'\)\.hidden = true/);
 assert.match(admin,/cgv-2026-10\.html/);
 assert.match(admin,/corrections nécessaires pour respecter ce devis restent incluses/);
});

test('invoice PDFs carry a non-unilateral reminder only when new terms were accepted',async()=>{
 const code=read('assets/invoice-pdf.js');
 const preview=read('assets/invoice-preview.js');
 assert.match(code,/q\.accepted_terms==='v2026-11'/);
 assert.match(preview,/quote\.accepted_terms==='v2026-11'/);
 assert.doesNotMatch(code,/record_project_payment|process-notification-outbox/);
 const win={};
 vm.runInNewContext(code,{window:win,Blob,Uint8Array});
 const sample={
  quote:{numero:'D-TEST-001',accepted_terms:'v2026-11',accepted_data:{f:{myaddr:'12 rue Test, Paris',cname:'Test Client',caddr:'7 Rue Exemple, Paris',novat:true}}},
  receipt:{amount:350,received_on:'2026-11-14',method:'transfer'},
  invoice:{num:'F-2026-0001',amt:350,n:'Facture d’acompte',issuedOn:'2026-11-14'}
 };
 const next=win.DzoftInvoicePdf.build(sample);
 const newText=Buffer.from(await next.arrayBuffer()).toString('latin1');
 assert.match(newText,/PRIX CONVENU ET CHANGEMENTS/);
 assert.match(newText,/devis complémentaire/);
 sample.quote.accepted_terms='v2026-10';
 const older=win.DzoftInvoicePdf.build(sample);
 const oldText=Buffer.from(await older.arrayBuffer()).toString('latin1');
 assert.doesNotMatch(oldText,/PRIX CONVENU ET CHANGEMENTS/);
 assert.match(oldText,/F-2026-0001/);
});

test('invoice document delivery still uses private PDFs and existing scripts',()=>{
 const admin=read('admin/suivi.html');
 assert.match(admin,/invoice-pdf\.js\?v=(?:20261114-archive&scope=20261114|20261115-pay-template)/);
 assert.match(admin,/invoice-preview\.js\?v=(?:20261114-auto&scope=20261114|20261115-pay-template)/);
 assert.match(read('assets/project-tracking.js'),/attach_generated_invoice_pdf/);
 assert.match(read('espace/index.html'),/sb\.files\.link/);
});
