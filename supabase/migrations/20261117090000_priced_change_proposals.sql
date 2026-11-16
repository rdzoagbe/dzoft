-- DZOFT: priced proposals for extra work, sent by e-mail and signed with an e-mail code.
--  * settings.price_blocks : the owner's price list (owner only, existing RLS on settings).
--  * a proposal holds priced lines; the server computes its total and gives it a number
--    "<quote number>-C<n>" (D-2026-001-C1, -C2…).
--  * "Envoyer au client" queues one e-mail through the existing outbox.
--  * the client approves only with a 6-digit code sent to the e-mail of his file, like the
--    original quote. Declining stays possible without a code.
--  * work already done can be marked completed right after approval, then invoiced with
--    issue_accepted_invoice(…,'supplement',…).
-- The accepted quote, its invoices and its payments are never modified here.

alter table public.settings add column if not exists price_blocks jsonb not null default '[]'::jsonb;
alter table public.settings drop constraint if exists settings_price_blocks_check;
alter table public.settings add constraint settings_price_blocks_check
  check (jsonb_typeof(price_blocks)='array' and jsonb_array_length(price_blocks)<=200);

alter table public.dzoft_change_requests
  add column if not exists lines jsonb,
  add column if not exists proposal_number text,
  add column if not exists already_done boolean not null default false,
  add column if not exists sent_at timestamptz,
  add column if not exists decision_method text,
  add column if not exists decision_target text;
create unique index if not exists dzoft_change_requests_number on public.dzoft_change_requests(proposal_number)
  where proposal_number is not null;
alter table public.dzoft_change_requests drop constraint if exists dzoft_change_requests_lines_check;
alter table public.dzoft_change_requests add constraint dzoft_change_requests_lines_check
  check (lines is null or (jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 40));
alter table public.dzoft_change_requests drop constraint if exists dzoft_change_requests_decision_method_check;
alter table public.dzoft_change_requests add constraint dzoft_change_requests_decision_method_check
  check (decision_method is null or decision_method in ('email','checkbox'));

alter table public.dzoft_change_events drop constraint if exists dzoft_change_events_event_type_check;
alter table public.dzoft_change_events add constraint dzoft_change_events_event_type_check
  check (event_type in ('requested','proposed','approved','declined','rejected','withdrawn','in_progress','completed','sent'));

alter table public.project_events drop constraint if exists project_events_event_type_check;
alter table public.project_events add constraint project_events_event_type_check check (event_type = any (array[
  'quote_published','quote_accepted','client_message','owner_message','step_validation_requested','step_progress',
  'client_step_validated','invoice_shared','client_file_uploaded','review_submitted','payment_reported',
  'progress_digest','payment_received','payment_reopened','change_proposed','change_signed']));

-- A code belongs to a quote (original signature) or to one proposal of that quote.
alter table public.sign_codes add column if not exists change_id uuid references public.dzoft_change_requests(id) on delete cascade;
create index if not exists sign_codes_change on public.sign_codes(change_id, created_at desc) where change_id is not null;

-- Original quote signature must ignore codes sent for proposals.
do $do$ declare d text; begin
 d:=pg_get_functiondef('public.client_accept_signed(uuid,uuid,text,text,boolean,text)'::regprocedure);
 if position('change_id is null' in d)=0 then
   if position('where quote_id = p_quote and client_id = p_client and used_at is null' in d)=0 then
     raise exception 'Unexpected client_accept_signed body';
   end if;
   execute replace(d,'where quote_id = p_quote and client_id = p_client and used_at is null',
                     'where quote_id = p_quote and client_id = p_client and used_at is null and change_id is null');
 end if;
end $do$;

create or replace function private.format_eur(p numeric) returns text
language sql immutable set search_path='' as $fn$
  select replace(replace(to_char(round(p,2),'FM999G999G990D00'),',',' '),'.',',')||' €';
$fn$;
revoke all on function private.format_eur(numeric) from public,anon,authenticated;

-- Validates priced lines and returns them cleaned with their total.
create or replace function private.change_lines_total(p_lines jsonb)
returns jsonb language plpgsql immutable set search_path='' as $fn$
declare l jsonb; label text; qty numeric; price numeric; total numeric:=0; cleaned jsonb:='[]'::jsonb;
begin
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 40 then
   raise exception 'Add between 1 and 40 lines';
 end if;
 for l in select value from jsonb_array_elements(p_lines) loop
   label:=btrim(coalesce(l->>'label',''));
   qty:=case when coalesce(l->>'qty','') ~ '^[0-9]+([.][0-9]{1,2})?$' then (l->>'qty')::numeric end;
   price:=case when coalesce(l->>'price','') ~ '^[0-9]+([.][0-9]{1,2})?$' then (l->>'price')::numeric end;
   if char_length(label) not between 2 and 160 or qty is null or qty<=0 or qty>1000
      or price is null or price>1000000 then
     raise exception 'Each line needs a label, a quantity and a price';
   end if;
   total:=total+round(qty*price,2);
   cleaned:=cleaned||jsonb_build_array(jsonb_build_object('label',label,'qty',qty,'price',price,
     'detail',left(btrim(coalesce(l->>'detail','')),300)));
 end loop;
 if total>1000000 then raise exception 'Total too high'; end if;
 return jsonb_build_object('lines',cleaned,'total',round(total,2));
end $fn$;
revoke all on function private.change_lines_total(jsonb) from public,anon,authenticated;

-- Owner: create a priced, numbered proposal (status 'proposed', version 1).
create or replace function public.owner_create_priced_proposal(
  p_quote uuid,p_title text,p_lines jsonb,p_timeline text,p_already_done boolean)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests; q public.quotes; t jsonb; n integer; num text; scope text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared or q.client_id is null
 then raise exception 'Accepted project required';end if;
 p_title:=btrim(coalesce(p_title,''));p_timeline:=btrim(coalesce(p_timeline,''));
 if char_length(p_title) not between 3 and 120 or char_length(p_timeline)>600 then
   raise exception 'Invalid change proposal';end if;
 t:=private.change_lines_total(p_lines);
 if (select count(*) from public.dzoft_change_requests where quote_id=p_quote
      and status in ('requested','proposed'))>=5 then raise exception 'Please resolve an existing open change request first';end if;
 select count(*)+1 into n from public.dzoft_change_requests where quote_id=p_quote and proposal_number is not null;
 num:=coalesce(nullif(btrim(q.numero),''),'DEVIS')||'-C'||n;
 while exists(select 1 from public.dzoft_change_requests where proposal_number=num) loop
   n:=n+1;num:=coalesce(nullif(btrim(q.numero),''),'DEVIS')||'-C'||n;
 end loop;
 select left(string_agg(x->>'label'||' : '||private.format_eur(round((x->>'qty')::numeric*(x->>'price')::numeric,2)),' ; '),2000)
   into scope from jsonb_array_elements(t->'lines') x;
 if char_length(scope)<10 then scope:=rpad(scope,10,'.'); end if;
 insert into public.dzoft_change_requests(quote_id,client_id,title,description,status,
   proposed_scope,extra_price,timeline_impact,proposal_version,proposed_at,lines,proposal_number,already_done)
 values(p_quote,q.client_id,p_title,'Proposition établie par DZOFT.','proposed',
   scope,(t->>'total')::numeric,p_timeline,1,now(),t->'lines',num,coalesce(p_already_done,false)) returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'requested','owner',0,jsonb_build_object('title',c.title,'origin','owner'));
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'proposed','owner',1,jsonb_build_object('number',num,'lines',c.lines,'extra_price',c.extra_price,
   'timeline_impact',c.timeline_impact,'already_done',c.already_done));
 return to_jsonb(c);
end $fn$;

-- Owner: price a request the client sent from his space (same calculator, same numbering).
-- A new pricing is a new version: an older signature can never apply to it.
create or replace function public.owner_price_change_request(
  p_request uuid,p_lines jsonb,p_timeline text,p_already_done boolean)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests; q public.quotes; t jsonb; n integer; num text; scope text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'Only open requests can receive a proposal';end if;
 select * into q from public.quotes where id=c.quote_id and client_id=c.client_id for update;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared then raise exception 'Accepted project required';end if;
 p_timeline:=btrim(coalesce(p_timeline,''));
 if char_length(p_timeline)>600 then raise exception 'Invalid change proposal';end if;
 t:=private.change_lines_total(p_lines);
 num:=c.proposal_number;
 if num is null then
   select count(*)+1 into n from public.dzoft_change_requests where quote_id=c.quote_id and proposal_number is not null;
   num:=coalesce(nullif(btrim(q.numero),''),'DEVIS')||'-C'||n;
   while exists(select 1 from public.dzoft_change_requests where proposal_number=num) loop
     n:=n+1;num:=coalesce(nullif(btrim(q.numero),''),'DEVIS')||'-C'||n;
   end loop;
 end if;
 select left(string_agg(x->>'label'||' : '||private.format_eur(round((x->>'qty')::numeric*(x->>'price')::numeric,2)),' ; '),2000)
   into scope from jsonb_array_elements(t->'lines') x;
 if char_length(scope)<10 then scope:=rpad(scope,10,'.'); end if;
 update public.dzoft_change_requests set status='proposed',proposed_scope=scope,extra_price=(t->>'total')::numeric,
   timeline_impact=p_timeline,lines=t->'lines',proposal_number=num,already_done=coalesce(p_already_done,false),
   proposal_version=proposal_version+1,proposed_at=now(),decided_at=null,decision_name=null,
   decision_method=null,decision_target=null,sent_at=null,updated_at=now()
 where id=p_request returning * into c;
 -- Codes issued for an earlier version stop working.
 update public.sign_codes set used_at=now() where change_id=c.id and used_at is null;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'proposed','owner',c.proposal_version,jsonb_build_object('number',num,'lines',c.lines,
   'extra_price',c.extra_price,'timeline_impact',c.timeline_impact,'already_done',c.already_done));
 return to_jsonb(c);
end $fn$;
revoke all on function public.owner_price_change_request(uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.owner_price_change_request(uuid,jsonb,text,boolean) to authenticated;

-- Owner: e-mail the current proposal to the client (each click sends one e-mail).
create or replace function public.owner_send_change_proposal(p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests; q public.quotes; ev uuid; label text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status<>'proposed' or c.proposal_version<1 then
   raise exception 'Only a proposal waiting for the client can be sent';end if;
 select * into q from public.quotes where id=c.quote_id and client_id=c.client_id;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared then
   raise exception 'Accepted project required';end if;
 label:=coalesce(c.proposal_number,'Proposition complémentaire');
 ev:=private.queue_project_event(
   'change:'||c.id||':v'||c.proposal_version||':'||extract(epoch from clock_timestamp())::bigint,
   'change_proposed',
   left('Proposition complémentaire '||label||' · '||private.format_eur(coalesce(c.extra_price,0))||
     ' · à lire et signer dans votre espace client, avec un code reçu par e-mail.',300),
   c.client_id,c.quote_id,null,null,null,true,true,false);
 update public.dzoft_change_requests set sent_at=now(),updated_at=now() where id=c.id returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'sent','owner',c.proposal_version,jsonb_build_object('event',ev));
 return to_jsonb(c);
end $fn$;

-- Edge function (service role only): reserve a signature code for a proposal.
create or replace function public.reserve_change_sign_code(
  p_change_id uuid,p_client_id uuid,p_salt text,p_code_hash text,p_target text,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests; v_recent integer; v_daily integer; v_id uuid;
begin
 select * into c from public.dzoft_change_requests
  where id=p_change_id and client_id=p_client_id and status='proposed' for update;
 if not found then return jsonb_build_object('ok',false,'reason','change'); end if;
 select count(*) into v_recent from public.sign_codes where change_id=p_change_id and created_at>=now()-interval '15 minutes';
 select count(*) into v_daily from public.sign_codes where change_id=p_change_id and created_at>=now()-interval '24 hours';
 if v_recent>=3 or v_daily>=10 then return jsonb_build_object('ok',false,'reason','rate_limit'); end if;
 insert into public.sign_codes(quote_id,client_id,channel,target,salt,code_hash,expires_at,change_id)
 values(c.quote_id,p_client_id,'email',p_target,p_salt,p_code_hash,p_expires_at,p_change_id) returning id into v_id;
 return jsonb_build_object('ok',true,'id',v_id,'number',c.proposal_number,'amount',c.extra_price,'version',c.proposal_version);
end $fn$;
revoke all on function public.reserve_change_sign_code(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reserve_change_sign_code(uuid,uuid,text,text,text,timestamptz) to service_role;

-- Approval now needs the e-mail code; declining does not.
do $do$ declare d text; begin
 d:=pg_get_functiondef('private.dzoft_decide_change(uuid,uuid,integer,boolean,text)'::regprocedure);
 if position('dzoft.change_signed' in d)=0 then
   if position('p_name:=btrim(coalesce(p_name,''''));' in d)=0 then raise exception 'Unexpected dzoft_decide_change body'; end if;
   execute replace(d,'p_name:=btrim(coalesce(p_name,''''));',
     'if p_approve and coalesce(current_setting(''dzoft.change_signed'',true),'''')<>''yes'' then
   raise exception ''Approval requires the code sent by e-mail'';
 end if;
 p_name:=btrim(coalesce(p_name,''''));');
 end if;
end $do$;

create or replace function private.dzoft_sign_change(p_client uuid,p_request uuid,p_version integer,p_name text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare sc public.sign_codes; r jsonb; c public.dzoft_change_requests;
begin
 select * into sc from public.sign_codes
  where change_id=p_request and client_id=p_client and used_at is null
  order by created_at desc limit 1 for update;
 if not found then raise exception 'Request your code first'; end if;
 if sc.expires_at<now() then raise exception 'Code expired: request a new one'; end if;
 if sc.attempts>=5 then raise exception 'Too many attempts: request a new code'; end if;
 if encode(extensions.digest(sc.salt||btrim(coalesce(p_code,'')),'sha256'),'hex')<>sc.code_hash then
   update public.sign_codes set attempts=attempts+1 where id=sc.id;
   raise exception 'Incorrect code';
 end if;
 perform set_config('dzoft.change_signed','yes',true);
 r:=private.dzoft_decide_change(p_client,p_request,p_version,true,p_name);
 perform set_config('dzoft.change_signed','no',true);
 update public.sign_codes set used_at=now() where id=sc.id;
 update public.dzoft_change_requests set decision_method='email',decision_target=sc.target
  where id=p_request returning * into c;
 perform private.queue_project_event('change-signed:'||c.id||':v'||c.proposal_version,'change_signed',
   left('Proposition '||coalesce(c.proposal_number,'complémentaire')||' signée par '||c.decision_name||
     ' · '||private.format_eur(coalesce(c.extra_price,0)),300),
   c.client_id,c.quote_id,null,null,null,false,true,false);
 return to_jsonb(c);
end $fn$;
revoke all on function private.dzoft_sign_change(uuid,uuid,integer,text,text) from public,anon,authenticated;

create or replace function public.my_sign_change_request(p_request uuid,p_version integer,p_name text,p_code text)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_sign_change(private.dzoft_client_for_change(null,false),p_request,p_version,p_name,p_code);
$fn$;
create or replace function public.portal_sign_change_request(p_token uuid,p_request uuid,p_version integer,p_name text,p_code text)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_sign_change(private.dzoft_client_for_change(p_token,true),p_request,p_version,p_name,p_code);
$fn$;
revoke all on function public.my_sign_change_request(uuid,integer,text,text),
  public.portal_sign_change_request(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.my_sign_change_request(uuid,integer,text,text) to authenticated;
grant execute on function public.portal_sign_change_request(uuid,uuid,integer,text,text) to anon;

-- Work already done: an approved proposal may be marked completed directly.
create or replace function public.owner_progress_change(p_request uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or not (
   (c.status='approved' and p_status in ('in_progress','completed'))
   or (c.status='in_progress' and p_status='completed')
 ) then raise exception 'Only approved changes may start, then be completed';end if;
 update public.dzoft_change_requests set status=p_status,updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version)
 values(c.id,p_status,'owner',c.proposal_version);
 return to_jsonb(c);
end $fn$;

revoke all on function public.owner_create_priced_proposal(uuid,text,jsonb,text,boolean),
  public.owner_send_change_proposal(uuid) from public,anon,authenticated;
grant execute on function public.owner_create_priced_proposal(uuid,text,jsonb,text,boolean),
  public.owner_send_change_proposal(uuid) to authenticated;
