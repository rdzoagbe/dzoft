const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('admin/suivi.html');
const tracking=read('assets/project-tracking.js');
const interim=read('supabase/migrations/20261115221000_interim_invoice_amount_preview.sql');
const accepted=read('supabase/migrations/20261115190000_issue_accepted_invoices.sql');
const audit=read('supabase/migrations/20261113235900_payment_correction_and_email_status.sql');

test('invoice detail cannot directly toggle paid state or bypass verified receipt ledger',()=>{
 assert.doesNotMatch(ui,/<input type="checkbox" class="paid"/);
 assert.match(ui,/data-a="record-payment"/);
 assert.match(ui,/if \(c === 'paid'\) \{ e\.target\.checked = !!x\.paid;.*return; \}/);
 assert.doesNotMatch(ui,/x\.paid = e\.target\.checked/);
});
test('invoice receipt shortcut opens the existing signed backend flow, never fabricates unbilled money',()=>{
 const a=ui.indexOf("if (b.dataset.a === 'record-payment')");
 const b=ui.indexOf("if (b.dataset.a === 'payment-reminder')",a);
 assert.ok(a>0&&b>a);
 const handler=ui.slice(a,b);
 assert.match(handler,/iv-payments-advanced/);
 assert.match(handler,/tracking-admin details\.tracking-editor/);
 assert.match(handler,/item\.value===x\.id/);
 assert.match(handler,/if \(!option\)/);
 assert.doesNotMatch(handler,/select\.value='unbilled'/);
 assert.doesNotMatch(handler,/sb\.rpc|save\(|x\.paid=|notify\(|emailAt/);
 assert.match(tracking,/record_project_payment_unbilled/);
 assert.match(tracking,/record_project_payment'/);
 assert.match(tracking,/if\(!confirm\(review\)\)return;/);
});
test('accepted total, invoices and payments use distinct server-authoritative calculations',()=>{
 assert.match(interim,/public\.invoice_draft_amount\(p_quote uuid\)/);
 assert.match(interim,/q\.accepted_total-already-unbilled/);
 assert.match(interim,/p_amount >= remaining/);
 assert.match(interim,/if balance is distinct from p_expected_amount/);
 assert.match(accepted,/private\.project_tracking\(p_quote uuid\)/);
 assert.match(accepted,/'remaining',greatest\(coalesce\(q\.accepted_total,0\)\+supp-received-legacy,0\)/);
 assert.match(ui,/id="iv-payment-truth"/);
 assert.match(tracking,/sb\.rpc\('project_tracking'/);
});
test('official invoice issue is owner-only, idempotent and still requires server-confirmed amount',()=>{
 assert.match(accepted,/not public\.is_owner\(\)/);
 assert.match(accepted,/'already_issued',true/);
 assert.match(accepted,/dzoft_issued_invoice_one_final/);
 assert.match(interim,/request_key uuid/);
 assert.match(interim,/dzoft_issued_invoice_request_key_unique/);
 assert.match(interim,/Issued invoice number and amount cannot be changed or deleted/);
 assert.match(ui,/issue_final_invoice_checked/);
 assert.match(ui,/issue_interim_invoice/);
 assert.match(ui,/archiveIssued\(x\)/);
});
test('payment method correction is audited and never changes amount, date or emails',()=>{
 assert.match(audit,/create table if not exists public\.project_receipt_method_audit/);
 assert.match(audit,/if auth\.uid\(\) is null or not public\.is_owner\(\)/);
 assert.match(audit,/update public\.project_receipts set method=p_method where id=p_receipt/);
 assert.doesNotMatch(audit,/update public\.project_receipts set amount=/);
 assert.match(tracking,/correct_project_receipt_method/);
 assert.match(tracking,/p_reason:form\.elements\.reason\.value\.trim\(\)/);
});
test('invoice page inline scripts are syntactically valid',()=>{
 let checked=0;
 for(const m of ui.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[1].trim()){new vm.Script(m[1],{filename:'admin/suivi.html'});checked++;}
 }
 assert.ok(checked>0);
});
