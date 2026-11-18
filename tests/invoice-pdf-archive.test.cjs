const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('generated PDF is a real, private-ready PDF byte stream based on official invoice',async()=>{
 const win={};
 vm.runInNewContext(read('assets/invoice-pdf.js'),{window:win,Blob,Uint8Array});
 assert.equal(typeof win.DzoftInvoicePdf.build,'function');
 const pdf=win.DzoftInvoicePdf.build({
  quote:{numero:'D-TEST-001',accepted_data:{f:{myaddr:'12 rue Test, Paris, France',cname:'Client Test',caddr:'7 rue Demo, France',novat:true,desc:'Creation de site',pay:'Virement'}}},
  receipt:{amount:350,received_on:'2026-11-14',method:'transfer'},
  invoice:{num:'F-2026-0001',amt:350,n:'Facture acompte',issuedOn:'2026-11-14'}
 });
 assert.equal(pdf.type,'application/pdf');
 const out=Buffer.from(await pdf.arrayBuffer());
 const raw=out.toString('latin1');
 assert.ok(out.length>600);
 assert.ok(raw.startsWith('%PDF-1.4'));
 assert.match(raw,/xref\n0 7\n/);
 assert.match(raw,/%%EOF/);
 assert.match(raw,/F-2026-0001/);
 assert.match(raw,/D-TEST-001/);
 assert.match(raw,/350,00 EUR/);
 const xref=Number(raw.match(/startxref\n(\d+)/)[1]);
 assert.equal(raw.slice(xref,xref+4),'xref');
 assert.throws(()=>win.DzoftInvoicePdf.build({quote:{},receipt:{},invoice:{}}),/Missing issued invoice details/);
});

test('admin archiving is private, immutable and never fabricates a second payment or an email',()=>{
 const sql=read('supabase/migrations/20261114193000_auto_invoice_pdf_archive.sql');
 assert.match(sql,/public\.is_owner\(\)/);
 assert.match(sql,/client-files/);
 assert.match(sql,/private\.dzoft_issued_invoice_registry/);
 assert.match(sql,/Client account required for private PDF access/);
 assert.match(sql,/Issued invoice PDF is immutable/);
 assert.match(sql,/create trigger dzoft_auto_invoice_pdf_immutable/);
 assert.match(sql,/storage\.objects/);
 assert.match(sql,/from public,anon,authenticated/);
 assert.doesNotMatch(sql,/insert into public\.project_receipts|queue_project_event|email_outbox|process-notification-outbox/);
 const js=read('assets/project-tracking.js');
 assert.match(js,/function archiveInvoice\(/);
 assert.match(js,/DzoftInvoicePdf\.build/);
 assert.match(js,/sb\.files\.upload\(/);
 assert.match(js,/attach_generated_invoice_pdf/);
 assert.match(js,/data-archive-receipt-invoice/);
 assert.match(js,/data-download-receipt-invoice/);
 assert.match(js,/sb\.files\.link\(/);
 assert.match(js,/err\.status===409/);
 new vm.Script(js);
});

test('admin loads PDF generator; client portal uses existing authenticated private download',()=>{
 const admin=read('admin/suivi.html'),client=read('espace/index.html');
 assert.match(admin,/invoice-pdf\.js\?v=(?:20261114-(?:archive|github-auto)|20261115-pay-template|20261115-verified-receipts2|20261117-client-tabs)/);
 assert.match(admin,/project-tracking\.js\?v=(?:20261114-(?:archive|github-auto)|20261115-pay-template|20261115-verified-receipts2|20261117-client-tabs|20261117-onepage|20261117-quick|20261118-avoirs)/);
 assert.doesNotMatch(client,/invoice-pdf\.js/);
 assert.match(client,/data-invoice-file/);
 assert.match(client,/sb\.files\.link\(/);
 assert.match(admin,/x\.generatedByDzoft/);
 assert.match(admin,/PDF officiel archivé/);
 assert.match(admin,/Cette archive officielle ne peut pas être supprimée/);
});
