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
test('a draft stays private once rejected or withdrawn (any status), sent proposals keep their details',()=>{
 const fix=read('supabase/migrations/20261117210000_change_draft_private_after_close.sql');
 // Redaction no longer depends on status='proposed': any version not sent shows no scope, price or lines.
 assert.match(fix,/case when c\.sent_at is null and c\.proposal_version>0 then[\s\S]{0,200}?'proposed_scope',null,'extra_price',null,'timeline_impact',null,'lines',null/);
 assert.match(fix,/'status',case when c\.status='proposed' then 'requested' else c\.status end/);
 // Opened by DZOFT and never sent: hidden whatever its status.
 assert.match(fix,/and not \(c\.sent_at is null and s\.last_sent is null and c\.proposal_version>0 and exists\(/);
 assert.doesNotMatch(fix,/c\.status='proposed' and c\.sent_at is null and exists/);
 // History: no 'proposed' event nor version number of a draft.
 assert.match(fix,/c\.sent_at is not null or e\.event_type<>'proposed' or e\.proposal_version<=coalesce\(s\.last_sent,0\)/);
 assert.ok(schema.includes("and not (c.sent_at is null and s.last_sent is null"),'schema.sql regenerated');
 assert.ok(fs.existsSync(path.join(__dirname,'change-draft-private-after-close.sql')));
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
 assert.match(js,/Brouillon privé : relisez le supplément, envoyez votre explication/);
 assert.match(js,/data-change-send/);
 assert.doesNotMatch(js,/owner_send_change_proposal/);
 assert.doesNotMatch(js,/Elle sera visible dans l’espace du client, qui devra la signer/);
});
test('phone: the calculator checkboxes keep their size and their text has the room',()=>{
 assert.match(read('assets/change-requests.css'),/\.dzoft-change-check input\{margin-top:3px;flex:0 0 auto;width:auto!important;min-width:0!important\}/);
});
