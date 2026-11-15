// Synthetic, read-only regression coverage for future final balance PDFs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/invoice-pdf.js'),'utf8');
test('final invoice PDF shows accepted quote, previous invoices and unchanged €700 balance',async()=>{
 const context={window:{},Blob,Uint8Array,URL};
 vm.runInNewContext(source,context);
 const quote={numero:'D-EXEMPLE',accepted_total:1500,invoices:[
 {id:'a',amt:'350.00',n:'Premier acompte'},
 {id:'b',amt:'450.00',n:'Second acompte'},
 {id:'c',amt:'700.00',basis:'final',n:'Facture de solde'}],
 accepted_data:{f:{myaddr:'1 rue Test, France',cname:'Client test',caddr:'2 rue Test, France',novat:true,desc:'Project'}}};
 const pdf=context.window.DzoftInvoicePdf.build({quote,invoice:{
 id:'c',num:'F-2026-9999',amt:700,n:'Facture de solde',issuedOn:'2026-11-15',basis:'final'}});
 const content=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.match(content,/Montant du devis initial : 1500,00 EUR/);
 assert.match(content,/D.j. factur. sur ce devis : 800,00 EUR/);
 assert.match(content,/Solde faisant l.objet de cette facture : 700,00 EUR/);
 assert.match(content,/TOTAL TTC : 700,00 EUR/);
});
test('extra work invoices do not inherit final balance recap',async()=>{
 const context={window:{},Blob,Uint8Array,URL};
 vm.runInNewContext(source,context);
 const quote={numero:'D-TEST',accepted_total:1500,invoices:[],accepted_data:{f:{myaddr:'1 rue Test',cname:'Client',caddr:'2 rue Test',novat:true}}};
 const pdf=context.window.DzoftInvoicePdf.build({quote,invoice:{id:'extra',num:'F-2026-9998',amt:500,n:'Avenant',issuedOn:'2026-11-15',basis:'change'}});
 const content=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.doesNotMatch(content,/R.CAPITULATIF DU DEVIS ACCEPT./);
});
