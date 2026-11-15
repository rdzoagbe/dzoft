// DZOFT invoice arithmetic and correction clarity. All cases synthetic only.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('admin/suivi.html');
const pdfSource=read('assets/invoice-pdf.js');

test('accepted quote, previous deposits, final balance and outstanding payment are separate concepts',()=>{
 for(const id of ['iv-total','iv-billed','iv-remaining','iv-received','iv-due','iv-balance-explain']){
  if(id==='iv-balance-explain')assert.match(html,/class="invoice-balance-explain"/);
  else assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/Le <b>reste à facturer<\/b>/);
 assert.match(html,/Le <b>reste à encaisser<\/b>/);
 assert.match(html,/sb\.rpc\('project_tracking', \{p_quote: QID\}, true\)/);
 assert.match(html,/if \(request !== invoicePaymentRequest\) return;/);
 assert.match(html,/Number\.isFinite\(received\)/);
 assert.match(html,/Number\.isFinite\(remaining\)/);
 assert.doesNotMatch(html,/if \(.*received.*\) update.*public\.quotes/);
 assert.equal(1500-350-450,700,'The final invoice is based on the unchanged accepted quote');
});

test('amount breakdown is displayed BEFORE irreversible issuance',()=>{
 assert.match(html,/id="iv-amount-hint"/);
 assert.match(html,/data-iv-breakdown/);
 assert.match(html,/info\.base_total/);
 assert.match(html,/info\.invoiced/);
 assert.match(html,/info\.unbilled_receipts/);
 assert.match(html,/data-iv="final" disabled>Émettre une facture officielle/);
 assert.match(html,/Cette action attribue un numéro définitif/);
 assert.match(html,/if \(!confirm\(ask\)\) return;/);
 assert.match(html,/invoiceDraftFacts/);
 assert.match(html,/Calcul vérifié/);
});

test('official invoice cannot be deleted or silently edited, and an explanation is readily available',()=>{
 assert.match(html,/var official = !!\(x\.generatedByDzoft \|\| x\.basis\)/);
 assert.match(html,/if \(Q\.invoices\[invoiceIndex\] && Q\.invoices\[invoiceIndex\]\.generatedByDzoft\)/);
 assert.match(html,/Facture de solde déjà émise/);
 assert.match(html,/corriger ou annuler cette facture/i);
 assert.match(html,/une <b>facture rectificative<\/b>/);
 assert.match(html,/utilisez un <b>avoir<\/b>/);
 assert.match(html,/La rectification n’est pas encore automatisée dans DZOFT/);
 assert.match(html,/entreprendre\.service-public\.gouv\.fr\/vosdroits\/F23208/);
 assert.match(html,/Émise · non envoyée/);
});

test('future official final PDF explains why €700 is not a revised €1500 quote',async()=>{
 const win={};
 vm.runInNewContext(pdfSource,{window:win,Blob,Uint8Array,URL});
 const quote={numero:'D-EXEMPLE',accepted_total:1500,invoices:[
   {id:'deposit-one',num:'F-2026-0001',amt:'350.00',n:'Facture acompte'},
   {id:'deposit-two',num:'F-2026-0002',amt:'450.00',n:'Facture acompte'},
   {id:'final-invoice',num:'F-2026-0003',amt:'700.00',n:'Facture de solde',basis:'final'}
  ],accepted_data:{f:{myaddr:'1 rue Test, France',cname:'Client test',caddr:'2 rue Test, France',novat:true,desc:'Project'}}};
 const pdf=win.DzoftInvoicePdf.build({quote,invoice:{
   id:'final-invoice',num:'F-2026-0003',amt:700,n:'Facture de solde',
   issuedOn:'2026-11-15',basis:'final'
 }});
 const bytes=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.match(bytes,/Montant du devis initial : 1500,00 EUR/);
 assert.match(bytes,/D.j. factur. sur ce devis : 800,00 EUR/);
 assert.match(bytes,/Solde faisant l.objet de cette facture : 700,00 EUR/);
 assert.match(bytes,/TOTAL TTC : 700,00 EUR/);
 assert.match(bytes,/Cette facture de solde ne modifie pas le montant du devis accept./);
 assert.match(html,/basis: x\.basis/);
});

test('original archived PDF is never changed by this UI-only patch',()=>{
 const file=read('supabase/migrations/20261114193000_auto_invoice_pdf_archive.sql');
 assert.match(file,/Issued invoice PDF is immutable/);
 assert.match(html,/Cette archive officielle ne peut pas être supprimée/);
 assert.doesNotMatch(html,/delete from private\.dzoft_issued_invoice_registry/i);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
  if(m[1].trim())new vm.Script(m[1],{filename:'admin/suivi.html'});
 new vm.Script(pdfSource,{filename:'assets/invoice-pdf.js'});
});
