const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('both client and admin render live change-request workflows',()=>{
 const client=read('espace/index.html');
 const owner=read('admin/suivi.html'),workspace=read('admin/project-workspace.js');
 assert.match(client,/dzoft-client-changes/);
 assert.match(client,/DzoftChanges\.client/);
 assert.match(client,/change-requests\.js\?v=20261117-(?:prices|freeprice|since|neutral)/);
 assert.match(owner,/dzoft-owner-changes/);
 assert.match(owner,/DzoftChanges\.owner/);
 assert.match(owner,/change-requests\.js\?v=20261117-(?:prices|freeprice|since|neutral)/);
 assert.match(workspace,/move\('c-changes',primary\)/);
 for(const html of [client,owner]){
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(m[1].trim())new vm.Script(m[1]);
  }
 }
 new vm.Script(read('assets/change-requests.js'));
});

test('client can submit, sign with an e-mail code or decline versioned proposals, and withdraw requests',()=>{
 const js=read('assets/change-requests.js');
 for(const name of ['list_change_requests','create_change_request','sign_change_request','decide_change_request','withdraw_change_request']){
  assert.match(js,new RegExp(name));
 }
 assert.match(js,/p_version:Number\(form\.dataset\.version\)/);
 // Approval is a signature with the code received by e-mail; declining needs no code.
 assert.doesNotMatch(js,/p_approve:true/);
 assert.match(js,/p_code:code/);
 assert.match(js,/p_approve:false/);
 assert.match(js,/name="consent" required/);
 assert.match(js,/No extra charge without your agreement/);
 assert.match(js,/The original quote price remains unchanged/);
 assert.doesNotMatch(js,/record_project_payment|auto_issue_project_receipt_invoice|sb\.update\('quotes'/);
});

test('owner prices the extra work and its timeline; the signature controls the work',()=>{
 const js=read('assets/change-requests.js');
 assert.match(js,/owner_list_change_requests/);
 assert.match(js,/owner_create_priced_proposal/);
 assert.match(js,/owner_price_change_request/);
 assert.match(js,/owner_reject_change/);
 assert.match(js,/owner_progress_change/);
 assert.match(js,/data-change-progress/);
 assert.doesNotMatch(js,/p_extra_price:/,'the server computes the price from the lines');
 assert.match(js,/p_timeline:f\.elements\.timeline\.value\.trim\(\)/);
 assert.match(js,/the original invoice/i);
});

test('database restricts all state transitions to signed-project server functions with immutable audit events',()=>{
 const sql=read('supabase/migrations/20261114210000_dzoft_change_requests.sql');
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/revoke all on public\.dzoft_change_requests,public\.dzoft_change_events/);
 assert.match(sql,/dzoft_change_event_no_mutation/);
 assert.match(sql,/auth\.uid\(\) is null or not public\.is_owner\(\)/);
 assert.match(sql,/user_id=auth\.uid\(\)/);
 assert.match(sql,/portal_token=p_token and user_id is null/);
 assert.match(sql,/c\.proposal_version<>p_version/);
 assert.match(sql,/status not in \('requested','proposed'\)/);
 assert.match(sql,/extra_price=p_extra_price/);
 const progress=read('supabase/migrations/20261114213000_dzoft_change_progress.sql');
 assert.match(progress,/c.status='approved' and p_status='in_progress'/);
 assert.match(progress,/c.status='in_progress' and p_status='completed'/);
 assert.match(progress,/public.is_owner\(\)/);
 assert.match(sql,/jsonb_build_object\('name',p_name,'scope',c\.proposed_scope/);
 assert.doesNotMatch(sql,/update public\.quotes|update public\.project_receipts|insert into public\.project_receipts/);
 assert.doesNotMatch(sql,/process-notification-outbox|sendTransacEmail/);
 for(const n of ['owner_list_change_requests','owner_propose_change','owner_reject_change','my_list_change_requests','portal_list_change_requests']){
  assert.match(sql,new RegExp(n));
 }
});

test('signing extra work confirms the signed quote’s general terms and the client gets an acknowledgement (17 Nov)',()=>{
 const js=read('assets/change-requests.js'),client=read('espace/index.html');
 const sql=read('supabase/migrations/20261117200000_change_signature_terms_and_receipt.sql');
 const mail=read('supabase/functions/process-notification-outbox/index.ts');
 // Code civil art. 1119: the terms are shown, linked and accepted with the signature.
 assert.match(js,/function termsLine\(en,terms\)/);
 assert.match(js,/conditions générales de vente \(CGV\)/);
 assert.match(js,/p_terms:\(options\.terms&&options\.terms\.version\)\|\|''/);
 assert.match(client,/terms:\{version:q\.accepted_terms\|\|TERMS,url:quoteTermsUrl\(q\),quote:q\.numero\|\|''\}/);
 // The server refuses a signature without the quote's terms version and records it.
 assert.match(sql,/btrim\(p_terms\)<>quote_terms/);
 assert.match(sql,/terms_version=btrim\(p_terms\)/);
 // Code civil art. 1127-2: the client receives the acknowledgement (notify_client = true).
 assert.match(sql,/c\.client_id,c\.quote_id,null,null,null,true,true,false\);/);
 assert.match(mail,/type === "change_signed" && !isOwner/);
 assert.match(mail,/Votre signature est enregistrée/);
 assert.doesNotMatch(client,/journal/i);
});
