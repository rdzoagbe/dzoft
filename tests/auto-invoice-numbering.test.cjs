const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const migration=read('supabase/migrations/20261114190000_auto_invoice_numbering.sql');

test('official numbers are allocated atomically across projects, without skipping committed numbers',()=>{
 assert.match(migration,/private\.dzoft_invoice_sequences/);
 assert.match(migration,/invoice_year integer primary key/);
 assert.match(migration,/for update/);
 assert.match(migration,/\bn:=n\+1;/);
 assert.match(migration,/num:='F-'\|\|yr\|\|'-'/);
 assert.match(migration,/on conflict\(invoice_year\) do nothing/);
 assert.match(migration,/invoice_number text primary key/);
 assert.match(migration,/receipt_id uuid not null unique/);
 assert.match(migration,/generatedByDzoft/);
 assert.match(migration,/perform private\.link_project_receipt_invoice\(p_quote,p_receipt,key,null\)/);
 assert.match(migration,/Receipt already linked to an invoice/);
 assert.match(migration,/already_issued',true/);
 assert.doesNotMatch(migration,/insert into public\.project_receipts|private\.queue_project_event|email_outbox|sendTransacEmail/);
});

test('issue RPC is owner-only, validates addresses, and never exposes sequence tables',()=>{
 assert.match(migration,/auth\.uid\(\) is null or not public\.is_owner\(\)/);
 assert.match(migration,/q\.accepted_at is null/);
 assert.match(migration,/from public\.project_receipts/);
 assert.match(migration,/f->>'myaddr'/);
 assert.match(migration,/f->>'caddr'/);
 assert.match(migration,/from public,anon,authenticated/);
 assert.match(migration,/to authenticated/);
 assert.match(migration,/alter table private\.dzoft_issued_invoice_registry enable row level security/);
 assert.match(migration,/revoke all on private\.dzoft_invoice_sequences, private\.dzoft_issued_invoice_registry/);
 assert.doesNotMatch(migration,/drop table|truncate|delete from public\./i);
});

test('owner UI defaults to automatic number generation, retains manual association, and allows PDF reprint',()=>{
 const src=read('assets/project-tracking.js');
 assert.match(src,/<option value=\"auto\">/);
 assert.match(src,/auto_issue_project_receipt_invoice/);
 assert.match(src,/p_kind:\['deposit','interim','final'\]/);
 assert.match(src,/data-download-receipt-invoice/);
 assert.match(src,/inv\.issuedOn/);
 assert.match(src,/link_project_receipt_invoice/);
 assert.match(src,/return;\s*}\s*if\(fresh&&!form\.elements\.issued\.checked\)/);
 const p=read('assets/invoice-preview.js');
 assert.match(p,/invoice\.issuedOn/);
 assert.match(p,/window\.print\(\)/);
 new vm.Script(p,{filename:'assets/invoice-preview.js'});
 new vm.Script(src,{filename:'assets/project-tracking.js'});
});
