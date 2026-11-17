-- Synthetic, transactional regression for priced proposals signed by e-mail code.
-- Nothing persists after rollback.
begin;
do $test$
declare
  owner_id uuid:=gen_random_uuid();
  client_id uuid:=gen_random_uuid();
  q_key uuid:=gen_random_uuid();
  p jsonb; p2 jsonb; inv jsonb; st jsonb; req jsonb;
  ch uuid; failed boolean; msg text;
  salt text:='00112233445566778899aabbccddeeff';
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated',
    'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
  insert into public.clients(id,nom,email) values(client_id,'TEST priced proposal','priced-proposal@example.invalid');
  insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,accepted_terms,shared,invoices,accepted_data)
  values(q_key,client_id,'TEST-PRICED-001',1500,1500,now(),'v2026-11',true,'[]'::jsonb,
   '{"f":{"myaddr":"Test business address, France","cname":"Test client","caddr":"Test customer address, France","novat":true}}');

  -- 1. Lines are validated and totalled by the server, and the proposal is numbered.
  failed:=false;
  begin perform public.owner_create_priced_proposal(q_key,'Ajouts','[{"label":"x","qty":1,"price":10}]','',false);
  exception when others then failed:=true; end;
  if not failed then raise exception 'A one-letter line was accepted'; end if;
  p:=public.owner_create_priced_proposal(q_key,'Ajouts réalisés',
    '[{"label":"Profils cachés avant le pass","qty":1,"price":200},{"label":"QR codes avec durée","qty":2,"price":75.5},{"label":"Design","qty":1,"price":49}]','',true);
  if p->>'proposal_number'<>'TEST-PRICED-001-C1' or (p->>'extra_price')::numeric<>400 or p->>'status'<>'proposed'
     or (p->>'already_done')::boolean is not true or jsonb_array_length(p->'lines')<>3 then
    raise exception 'Proposal wrong: %',p; end if;
  ch:=(p->>'id')::uuid;
  p2:=public.owner_create_priced_proposal(q_key,'Autre ajout','[{"label":"Logo en vague","qty":1,"price":50}]','',false);
  if p2->>'proposal_number'<>'TEST-PRICED-001-C2' then raise exception 'Second number wrong: %',p2->>'proposal_number'; end if;

  -- 2. Sending queues one e-mail for the client and one for the owner.
  p:=public.owner_send_change_proposal(ch);
  if p->>'sent_at' is null then raise exception 'sent_at not set'; end if;
  if not exists(select 1 from public.project_events e join public.email_outbox o on o.event_id=e.id
    where e.quote_id=q_key and e.event_type='change_proposed' and o.recipient_role='client'
      and o.recipient='priced-proposal@example.invalid' and e.summary like 'Proposition complémentaire TEST-PRICED-001-C1 · 400,00 €%') then
    raise exception 'Client e-mail not queued'; end if;

  -- 3. Approval without a code is refused; a wrong code is refused and counted.
  failed:=false;
  begin perform private.dzoft_decide_change(client_id,ch,1,true,'Test client');
  exception when others then failed:=true; msg:=sqlerrm; end;
  if not failed or msg not like '%code%' then raise exception 'Approved without code (%)',msg; end if;
  failed:=false;
  begin perform private.dzoft_sign_change(client_id,ch,1,'Test client','123456','v2026-11');
  exception when others then failed:=true; msg:=sqlerrm; end;
  if not failed or msg<>'Request your code first' then raise exception 'Signed without any code issued (%)',msg; end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  st:=public.reserve_change_sign_code(ch,client_id,salt,encode(extensions.digest(salt||'654321','sha256'),'hex'),'p•••@example.invalid',now()+interval '10 minutes');
  if (st->>'ok')::boolean is not true then raise exception 'Code not reserved: %',st; end if;
  failed:=false;
  begin perform private.dzoft_sign_change(client_id,ch,1,'Test client','111111','v2026-11');
  exception when others then failed:=true; msg:=sqlerrm; end;
  if not failed or msg<>'Incorrect code' then raise exception 'Wrong code accepted (%)',msg; end if;
  -- The original quote signature ignores proposal codes.
  if exists(select 1 from public.sign_codes where quote_id=q_key and change_id is null) then
    raise exception 'Proposal code mixed with quote codes'; end if;

  -- 4. The general terms of the signed quote must be accepted (Code civil art. 1119).
  failed:=false;
  begin perform private.dzoft_sign_change(client_id,ch,1,'Test client','654321','');
  exception when others then failed:=true; msg:=sqlerrm; end;
  if not failed or msg not like '%general terms%' then raise exception 'Signed without accepting the terms (%)',msg; end if;
  failed:=false;
  begin perform private.dzoft_sign_change(client_id,ch,1,'Test client','654321','v2026-10');
  exception when others then failed:=true; msg:=sqlerrm; end;
  if not failed or msg not like '%general terms%' then raise exception 'Signed with other terms than the quote''s (%)',msg; end if;

  -- 5. The right code and terms approve, record the method and terms, and notify the client and the owner.
  p:=private.dzoft_sign_change(client_id,ch,1,'Test client','654321','v2026-11');
  if p->>'status'<>'approved' or p->>'decision_method'<>'email' or p->>'decision_name'<>'Test client' then
    raise exception 'Signature not recorded: %',p; end if;
  if p->>'terms_version'<>'v2026-11' then raise exception 'Terms version not recorded: %',p; end if;
  if not exists(select 1 from public.project_events e join public.email_outbox o on o.event_id=e.id
    where e.quote_id=q_key and e.event_type='change_signed' and o.recipient_role='owner') then
    raise exception 'Owner not notified of the signature'; end if;
  -- Electronic acknowledgement to the client (Code civil art. 1127-2).
  if not exists(select 1 from public.project_events e join public.email_outbox o on o.event_id=e.id
    where e.quote_id=q_key and e.event_type='change_signed' and o.recipient_role='client'
      and o.recipient='priced-proposal@example.invalid') then
    raise exception 'Client not sent an acknowledgement of the signature'; end if;
  failed:=false;
  begin perform private.dzoft_sign_change(client_id,ch,1,'Test client','654321','v2026-11');
  exception when others then failed:=true; end;
  if not failed then raise exception 'A code was used twice'; end if;

  -- 6. Already done: approved goes straight to completed, then the invoice uses the signed amount.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated',
    'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
  p:=public.owner_progress_change(ch,'completed');
  if p->>'status'<>'completed' then raise exception 'Not completed: %',p; end if;
  inv:=public.issue_accepted_invoice(q_key,'supplement',ch);
  if (inv->>'amount')::numeric<>400 then raise exception 'Invoice amount wrong: %',inv; end if;
  st:=public.project_tracking(q_key);
  if (st->>'total')::numeric<>1900 or (st->>'base_total')::numeric<>1500 then raise exception 'Tracking wrong: %',st; end if;
  if (select accepted_total from public.quotes where id=q_key)<>1500 then raise exception 'Quote total changed'; end if;

  -- 7. Declining needs no code.
  perform set_config('dzoft.change_signed','no',true);
  -- Drafts (17 Nov 2026): not sent → hidden from the client and impossible to decide; once sent, decidable.
  if exists(select 1 from jsonb_array_elements(private.dzoft_changes_for_client(client_id,q_key)) x where x->>'id'=p2->>'id') then
    raise exception 'An unsent draft is visible to the client'; end if;
  failed:=false;
  begin perform private.dzoft_decide_change(client_id,(p2->>'id')::uuid,1,false,'Test client');
  exception when others then failed:=true; end;
  if not failed then raise exception 'An unsent draft could be decided'; end if;
  update public.dzoft_change_requests set sent_at=now() where id=(p2->>'id')::uuid;
  p:=private.dzoft_decide_change(client_id,(p2->>'id')::uuid,1,false,'Test client');
  if p->>'status'<>'declined' then raise exception 'Decline failed: %',p; end if;

  -- 8. A request sent by the client is priced with the same calculator; re-pricing voids older codes.
  update public.dzoft_change_requests set created_at=now()-interval '2 minutes' where quote_id=q_key; -- client anti-spam window
  req:=private.dzoft_create_change(client_id,q_key,'Nouvelle page','Le client veut une page de plus.');
  p:=public.owner_price_change_request((req->>'id')::uuid,'[{"label":"Page supplémentaire","qty":1,"price":120}]','+2 jours',false);
  if p->>'proposal_number'<>'TEST-PRICED-001-C3' or (p->>'extra_price')::numeric<>120 or (p->>'proposal_version')::int<>1 then raise exception 'Priced request wrong: %',p; end if;
  -- Priced but not sent: the client still sees his request, as « requested » and without the draft price.
  if not exists(select 1 from jsonb_array_elements(private.dzoft_changes_for_client(client_id,q_key)) x
    where x->>'id'=req->>'id' and x->>'status'='requested' and x->'extra_price'='null'::jsonb) then raise exception 'Client view of a priced, unsent request is wrong'; end if;
  -- Sent proposals stay visible with their price (sent via the button, or with sent_at only).
  if not exists(select 1 from jsonb_array_elements(private.dzoft_changes_for_client(client_id,q_key)) x
    where x->>'id'=p2->>'id' and x->>'status'='declined' and (x->>'extra_price')::numeric=50) then raise exception 'A sent proposal lost its details'; end if;
  if not exists(select 1 from jsonb_array_elements(private.dzoft_changes_for_client(client_id,q_key)) x
    where x->>'id'=ch::text and x->>'status'='completed' and (x->>'extra_price')::numeric=400) then raise exception 'A signed proposal lost its details'; end if;
  update public.dzoft_change_requests set sent_at=now() where id=(req->>'id')::uuid;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  st:=public.reserve_change_sign_code((req->>'id')::uuid,client_id,salt,encode(extensions.digest(salt||'222222','sha256'),'hex'),'p•••',now()+interval '10 minutes');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
  p:=public.owner_price_change_request((req->>'id')::uuid,'[{"label":"Page supplémentaire","qty":1,"price":150}]','+2 jours',false);
  if (p->>'proposal_version')::int<>2 or p->>'proposal_number'<>'TEST-PRICED-001-C3' then raise exception 'Re-pricing wrong: %',p; end if;
  failed:=false;
  begin perform private.dzoft_sign_change(client_id,(req->>'id')::uuid,2,'Test client','222222','v2026-11');
  exception when others then failed:=true; end;
  if not failed then raise exception 'A code from an older version signed the new price'; end if;
end
$test$;
rollback;
