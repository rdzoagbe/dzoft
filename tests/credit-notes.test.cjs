// 18 Nov 2026: an issued invoice is cancelled or reduced only by a credit note (« avoir »), never changed or deleted
// (CGI art. 289-I-5; BOI-TVA-DECLA-30-20-20-20 § V; service-public.fr F23208).
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const mig=read('supabase/migrations/20261118120000_credit_notes.sql');

test('own continuous series A-AAAA-NNNN, citing the invoice number and date, immutable',()=>{
 assert.match(mig,/num := 'A-' \|\| yr \|\| '-' \|\| lpad\(n::text, greatest\(4, length\(n::text\)\), '0'\);/);
 assert.match(mig,/select last_number into n from private\.dzoft_credit_note_sequences where credit_year = yr for update;/);
 assert.match(mig,/invoice_number text not null,\n  invoice_issued_on date,/);
 assert.match(mig,/before update or delete on public\.dzoft_credit_notes/);
 assert.match(mig,/raise exception 'A credit note cannot be changed or deleted';/);
 // Clients never read the table directly; owner and the project's client go through the functions.
 assert.match(mig,/alter table public\.dzoft_credit_notes enable row level security;/);
 assert.match(mig,/revoke all on public\.dzoft_credit_notes from anon, authenticated;/);
});

test('owner only, reason required, never more than what is still unpaid on the invoice, retry-safe',()=>{
 assert.match(mig,/if auth\.uid\(\) is null or not public\.is_owner\(\) then raise exception 'Owner access required'; end if;/);
 assert.match(mig,/char_length\(p_reason\) not between 5 and 600/);
 assert.match(mig,/open_amt := reg\.amount - paid - credited;/);
 assert.match(mig,/v_amount > open_amt then/);
 assert.match(mig,/request_key uuid not null unique/);
 // Only an invoice issued and numbered by DZOFT.
 assert.match(mig,/Only an invoice issued by DZOFT can be credited/);
 // Re-issue only for a whole invoice with no payment and no earlier credit note.
 assert.match(mig,/if p_effect = 'reissue' and \(paid > 0 or credited > 0 or v_amount <> reg\.amount\) then/);
});

test('payments, balances and re-issue take credit notes into account; each change applies exactly once',()=>{
 assert.match(mig,/if k <> 1 then raise exception 'Credit notes migration: % expected once in %, found %'/);
 for(const fn of ['private.project_tracking(uuid)','private.record_project_payment(','private.link_project_receipt_invoice(','private.auto_issue_project_receipt_invoice(',
   'private.issue_interim_invoice(','public.invoice_draft_amount(uuid)','private.issue_accepted_invoice(','public.issue_final_invoice_checked('])assert.ok(mig.includes("'"+fn),fn);
 assert.match(mig,/'''remaining'',greatest\(coalesce\(q\.accepted_total,0\)\+supp-cred_supp_reissue-cred_reduce-received-legacy,0\),/);
 assert.match(mig,/already:=already\+coalesce\(\(select sum\(amount\) from public\.dzoft_credit_notes where quote_id=p_quote and invoice_id=p_invoice\),0\);/);
 assert.match(mig,/where basis = 'final' and not cancelled_for_reissue;/);
});

test('admin: « Annuler ou réduire (avoir) » on each issued invoice with something left to pay; cancel window issues nothing',()=>{
 const html=read('admin/suivi.html');
 assert.match(html,/official && creditInfo\(x\)\.open > 0 \? '<button class="btn sm line" type="button" data-a="credit-note">'/);
 assert.match(html,/la loi demande un <b>avoir<\/b>/);
 assert.match(html,/q\('\[data-cancel\]'\)\.onclick = function\(\)\{ d\.close\(\); \};/);
 assert.match(html,/sb\.rpc\('issue_credit_note', \{ p_quote: QID, p_invoice: x\.id, p_amount: part \? amount : null, p_effect: effect, p_reason: reason, p_request_key: key \}, true\)/);
 // Figures come from the server (project_tracking), never from a flag stored in the invoice record.
 assert.match(html,/sb\.rpc\('project_tracking', \{ p_quote: QID \}, true\)/);
 assert.doesNotMatch(html,/'credited',/);
});

test('PDF and lists: credit note cites its invoice; listed for admin, client and accounting',()=>{
 const doc=read('assets/dzoft-documents.js');
 assert.match(doc,/Avoir se rapportant à la facture n° '\+cn\.invoice_number\+\(cn\.invoice_issued_on\?' du '\+frDate\(cn\.invoice_issued_on\)/);
 assert.match(doc,/TVA non applicable, art\. 293 B du CGI\./);
 assert.match(doc,/creditNote:creditNote/);
 assert.match(read('admin/project-summary.js'),/pdf\('credit',c\.number\)/);
 assert.match(read('espace/index.html'),/data-doc-pdf="credit"/);
 assert.match(read('admin/index.html'),/Registre des avoirs/);
 // What is due takes credit notes off.
 assert.match(read('assets/project-tracking.js'),/return n\+Math\.max\(0,cents\(i\.amt\)-paid-credited\);/);
});
