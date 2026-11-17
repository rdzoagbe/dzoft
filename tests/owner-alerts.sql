-- Rollback-only check: client actions on extra work alert the owner (never the client), owner proposals do not.
begin;
do $test$
declare owner_id uuid:=gen_random_uuid(); client_id uuid:=gen_random_uuid(); q uuid:=gen_random_uuid();
  r jsonb; p jsonb; n int; open jsonb;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
  insert into public.clients(id,nom,email) values(client_id,'TEST alerts','alerts@example.invalid');
  insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,accepted_terms,shared,invoices)
   values(q,client_id,'TEST-ALERT-001',100,100,now(),'v2026-11',true,'[]');
  r:=private.dzoft_create_change(client_id,q,'Ajouter une page','Le client veut une page de plus.');
  if not exists(select 1 from public.project_events e join public.email_outbox o on o.event_id=e.id
     where e.quote_id=q and e.event_type='change_requested' and o.recipient_role='owner') then raise exception 'No owner alert for a new request'; end if;
  if exists(select 1 from public.project_events e join public.email_outbox o on o.event_id=e.id
     where e.quote_id=q and e.event_type='change_requested' and o.recipient_role='client') then raise exception 'Client e-mailed about own request'; end if;
  p:=public.owner_price_change_request((r->>'id')::uuid,'[{"label":"Page supplémentaire","qty":1,"price":50}]','',false);
  update public.dzoft_change_requests set sent_at=now() where id=(r->>'id')::uuid; -- sent to the client: a draft cannot be decided
  open:=public.owner_open_change_requests();
  if jsonb_array_length(open)<>1 or open->0->>'status'<>'proposed' then raise exception 'Open list wrong: %',open; end if;
  perform set_config('dzoft.change_signed','no',true);
  p:=private.dzoft_decide_change(client_id,(r->>'id')::uuid,(p->>'proposal_version')::int,false,'Test client');
  if not exists(select 1 from public.project_events where quote_id=q and event_type='change_declined') then raise exception 'No owner alert for a decline'; end if;
  update public.dzoft_change_requests set created_at=now()-interval '2 minutes' where quote_id=q;
  r:=private.dzoft_create_change(client_id,q,'Changer la couleur','Plutôt du bleu.');
  perform private.dzoft_withdraw_change(client_id,(r->>'id')::uuid);
  if not exists(select 1 from public.project_events where quote_id=q and event_type='change_withdrawn') then raise exception 'No owner alert for a withdrawal'; end if;
  p:=public.owner_create_priced_proposal(q,'Ajout DZOFT','[{"label":"Ajout proposé","qty":1,"price":20}]','',false);
  select count(*) into n from public.project_events where quote_id=q and event_type='change_requested';
  if n<>2 then raise exception 'Owner proposal counted as a client request (%)',n; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  begin perform public.owner_open_change_requests(); raise exception 'NOT OWNER ALLOWED'; exception when others then if sqlerrm='NOT OWNER ALLOWED' then raise; end if; end;
end $test$;
rollback;
