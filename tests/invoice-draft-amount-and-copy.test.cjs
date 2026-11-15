// Owner-editable invoice draft amount + actual client & owner email copy.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const sql=read('supabase/migrations/20261115221000_interim_invoice_amount_preview.sql');
const html=read('admin/suivi.html');
const emailSql=read('supabase/migrations/20261030131831_project_email_outbox.sql');
const emailWorker=read('supabase/functions/process-notification-outbox/index.ts');
const existingSql=read('supabase/migrations/20261115190000_issue_accepted_invoices.sql');

test('the preview is owner-only and excludes already-issued amounts and unbilled receipts',()=>{
 assert.match(sql,/function public\.invoice_draft_amount\(p_quote uuid\)/);
 assert.match(sql,/auth\.uid\(\) is null or not public\.is_owner\(\)/);
 assert.match(sql,/not\(i \? 'care'\) and not\(i \? 'change'\)/);
 assert.match(sql,/where r\.quote_id=p_quote and r\.invoice_id is null/);
 assert.match(sql,/remaining:=greatest\(round\(q\.accepted_total-already-unbilled,2\),0\)/);
 assert.match(sql,/grant execute on function public\.invoice_draft_amount\(uuid\) to authenticated/);
 assert.match(html,/sb\.rpc\('invoice_draft_amount', \{ p_quote: QID \}, true\)/);
});

test('interim invoices require owner, signed quote, smaller amount and idempotency key',()=>{
 assert.match(sql,/function private\.issue_interim_invoice\(\s*p_quote uuid,p_amount numeric,p_request_key uuid\)/);
 assert.match(sql,/p_amount <> round\(p_amount,2\)/);
 assert.match(sql,/request_key uuid/);
 assert.match(sql,/dzoft_issued_invoice_request_key_unique/);
 assert.match(sql,/prior\.quote_id<>p_quote or prior\.basis<>'interim' or prior\.amount<>p_amount/);
 assert.match(sql,/where quote_id=p_quote and basis='final'/);
 assert.match(sql,/if p_amount >= remaining then/);
 assert.match(sql,/where invoice_year=yr for update/);
 assert.match(sql,/num:='F-'\|\|yr/);
 assert.match(sql,/basis','interim'/);
 assert.doesNotMatch(sql,/set\s+accepted_total\s*=/);
 assert.doesNotMatch(sql,/insert into public\.project_receipts|sendTransacEmail/i);
 assert.match(html,/sessionStorage\.getItem\(storageKey\)/);
 assert.match(html,/sessionStorage\.setItem\(storageKey, key\)/);
 assert.match(html,/sessionStorage\.removeItem\(storageKey\)/);
});

test('final invoice compares requested amount under quote lock before numbering',()=>{
 assert.match(sql,/function public\.issue_final_invoice_checked\(/);
 assert.match(sql,/where id=p_quote for update/);
 assert.match(sql,/balance is distinct from p_expected_amount/);
 assert.match(sql,/return private\.issue_accepted_invoice\(p_quote,'final',null\)/);
 assert.match(existingSql,/num:='F-'\|\|yr/);
 assert.match(html,/p_expected_amount: chosenAmount/);
 assert.match(html,/p_request_key: key/);
});

test('issued invoices INCLUDING receipt invoices are immutable',()=>{
 assert.match(sql,/select invoice_id from private\.dzoft_issued_invoice_registry where quote_id=new\.id/);
 assert.doesNotMatch(sql,/where quote_id=new\.id and basis<>'receipt'/);
 assert.match(sql,/before_invoice->>'amt' is distinct from after_invoice->>'amt'/);
 assert.match(sql,/before_invoice->>'num' is distinct from after_invoice->>'num'/);
 assert.match(html,/invoice-fixed-values invoice-wide/);
 assert.match(html,/il\('Montant émis','Issued amount'\)/);
});

test('editable input supports French comma decimals and rejects invalid values',()=>{
 const start=html.indexOf('function parseInvoiceAmount(raw){');
 const end=html.indexOf('function refreshDraftHint(',start);
 assert.ok(start>0 && end>start);
 const ctx={};
 vm.runInNewContext(html.slice(start,end),ctx);
 const parsed=(v)=>ctx.parseInvoiceAmount(v);
 assert.equal(parsed('155,50'),155.5);
 assert.equal(parsed('155.50'),155.5);
 assert.equal(parsed('0'),null);
 assert.equal(parsed('-4'),null);
 assert.equal(parsed('1,234'),null);
 assert.equal(parsed('2.999'),null);
 assert.equal(parsed('abc'),null);
 assert.equal(parsed(''),null);
});

test('sending invoice includes its archived PDF for BOTH client and owner',()=>{
 assert.match(emailSql,/\'invoice_shared\'/);
 assert.match(emailSql,/new\.client_id, new\.id, null, inv ->> 'id', v_file_name, true, true,/);
 assert.match(emailSql,/p_notify_owner then/);
 assert.match(emailSql,/'owner', v_owner_email, p_invoice_id, p_attach_invoice_pdf/);
 assert.match(emailWorker,/if \(job\.attach_invoice_pdf\)/);
 assert.match(emailWorker,/const isOwner = job\.recipient_role === "owner"/);
 assert.match(emailWorker,/attachment = \[\{/);
 assert.match(emailWorker,/\.download\(path\)/);
 assert.match(html,/x\.attachPdf = true/);
 assert.match(html,/Envoyer le PDF \+ ma copie/);
 assert.match(html,/!x\.num \|\| !x\.file/);
 assert.match(html,/invoiceDeliverySummary\(x\)/);
 assert.match(html,/job\.status === 'sent'/);
 assert.match(html,/accepté par le fournisseur \(livraison à confirmer\)/);
 assert.doesNotMatch(html,/toast\('E-mail de facture traité/);
});

test('PDF renderer and email worker source are parseable and no auto-send on creation',()=>{
 assert.match(html,/if \(!confirm\(ask\)\) return;/);
 assert.match(html,/if \(!confirm\('Facture '/);
 assert.doesNotMatch(sql,/queue_project_event|email_outbox|fetch\(/);
 // Extract the inline page script (not external scripts) for syntactic validity.
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length);
 for(const match of scripts) if(match[1].trim()) new vm.Script(match[1],{filename:'admin/suivi.html'});
});
