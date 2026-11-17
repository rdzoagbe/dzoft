// 17 Nov 2026: a priced proposal is a draft, seen only by the owner, until « Envoyer au client ».
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const mig=read('supabase/migrations/20261117200000_change_proposal_draft_until_sent.sql'),js=read('assets/change-requests.js'),schema=read('supabase/schema.sql');

test('the client never lists a proposal that was not sent',()=>{
 for(const fn of ['my_list_change_requests','portal_list_change_requests'])
  assert.match(mig,new RegExp('function public\\.'+fn+'\\([^)]*\\)[\\s\\S]*?private\\.dzoft_changes_for_client\\('));
 // A draft opened by DZOFT is hidden; the client's own request stays visible as « requested », without the draft price.
 assert.match(mig,/and not \(c\.status='proposed' and c\.sent_at is null and exists\(select 1 from public\.dzoft_change_events e\s+where e\.request_id=c\.id and e\.event_type='requested' and e\.actor_type='owner'\)\)/);
 assert.match(mig,/case when c\.status='proposed' and c\.sent_at is null then[\s\S]{0,120}?to_jsonb\(c\)\|\|jsonb_build_object\('status','requested','proposed_scope',null,'extra_price',null/);
 assert.match(mig,/revoke all on function private\.dzoft_changes_for_client\(uuid,uuid\) from public,anon,authenticated;/);
 // The owner keeps the full list.
 assert.match(schema,/return private\.dzoft_changes_for_project\(cid,p_quote\);/);
});
test('no signing code and no decision on a proposal that was not sent; repricing makes it a draft again',()=>{
 assert.match(mig,/status='proposed' and sent_at is not null for update;/);
 assert.match(mig,/if c\.sent_at is null then raise exception 'Proposal changed or is no longer awaiting approval';end if;/);
 assert.match(mig,/proposed_at=now\(\),decided_at=null,decision_name=null,sent_at=null,updated_at=now\(\)/);
 for(const f of ['private.dzoft_changes_for_client(','reserve_change_sign_code','sent_at is not null for update'])assert.ok(schema.includes(f),f);
});
test('the admin says « Brouillon » until sent, and the buttons say what happens',()=>{
 assert.match(js,/var draft=r\.status==='proposed'&&!r\.sent_at/);
 assert.match(js,/Brouillon · visible par vous seul/);
 assert.match(js,/Créer ce brouillon de '\+cash\(total\)\+' \? Vous seul le voyez/);
 assert.match(js,/Elle deviendra visible dans son espace et il recevra un e-mail/);
 assert.doesNotMatch(js,/Elle sera visible dans l’espace du client, qui devra la signer/);
});
test('phone: the calculator checkboxes keep their size and their text has the room',()=>{
 assert.match(read('assets/change-requests.css'),/\.dzoft-change-check input\{margin-top:3px;flex:0 0 auto;width:auto!important;min-width:0!important\}/);
});
