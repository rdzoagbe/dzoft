-- Rollback-only check: an unsent draft stays private after it is rejected or withdrawn.
begin;
do $test$
declare owner_id uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); tok uuid:=gen_random_uuid();
  a jsonb; b jsonb; c2 jsonb; l jsonb; row jsonb;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
  insert into public.clients(id,nom,email,portal_token) values(cid,'TEST draft close','draft-close@example.invalid',tok);
  insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,accepted_terms,shared,invoices)
   values(q,cid,'TEST-DRAFT-CLOSE',100,100,now(),'v2026-11',true,'[]');
  -- 1. DZOFT draft, never sent, then rejected: still invisible to the client.
  a:=public.owner_create_priced_proposal(q,'Ajout DZOFT','[{"label":"Ajout secret","qty":1,"price":77}]','',false);
  perform public.owner_reject_change((a->>'id')::uuid,'Brouillon refait');
  -- 2. Client request priced as a draft, then withdrawn by the client: no draft price shown.
  update public.dzoft_change_requests set created_at=now()-interval '2 minutes' where quote_id=q; -- request rate limit
  b:=private.dzoft_create_change(cid,q,'Ajouter une page','Le client veut une page de plus.');
  perform public.owner_price_change_request((b->>'id')::uuid,'[{"label":"Page","qty":1,"price":55}]','',false);
  perform private.dzoft_withdraw_change(cid,(b->>'id')::uuid);
  -- 3. DZOFT proposal sent (v1), repriced as a draft (v2), then rejected: visible, v2 price hidden.
  c2:=public.owner_create_priced_proposal(q,'Ajout envoyé','[{"label":"Ajout","qty":1,"price":30}]','',false);
  perform public.owner_send_change_proposal((c2->>'id')::uuid);
  perform public.owner_price_change_request((c2->>'id')::uuid,'[{"label":"Ajout","qty":1,"price":99}]','',false);
  perform public.owner_reject_change((c2->>'id')::uuid,'Abandonné');
  perform set_config('request.jwt.claims',jsonb_build_object('role','anon')::text,true);
  l:=public.portal_list_change_requests(tok,q);
  if l::text like '%Ajout DZOFT%' or l::text like '%Ajout secret%' then raise exception 'FAIL unsent DZOFT draft visible after rejection: %',l; end if;
  if jsonb_array_length(l)<>2 then raise exception 'FAIL expected 2 rows, got %',l; end if;
  select r into row from jsonb_array_elements(l) r where r->>'id'=b->>'id';
  if row->>'status'<>'withdrawn' or row->'extra_price'<>'null'::jsonb or row->'lines'<>'null'::jsonb or (row->>'proposal_version')::int<>0
     or row->'history' @> '[{"event_type":"proposed"}]' then raise exception 'FAIL withdrawn draft leaks: %',row; end if;
  select r into row from jsonb_array_elements(l) r where r->>'id'=c2->>'id';
  if row->>'status'<>'rejected' or row->'extra_price'<>'null'::jsonb or (row->>'proposal_version')::int<>1
     or row->'history' @> '[{"event_type":"proposed","proposal_version":2}]' then raise exception 'FAIL repriced draft leaks: %',row; end if;
  if exists(select 1 from jsonb_array_elements(l) r, jsonb_array_elements(r->'history') h
     where (h->>'proposal_version')::int>(r->>'proposal_version')::int) then raise exception 'FAIL history reveals a draft version: %',l; end if;
end $test$;
rollback;
