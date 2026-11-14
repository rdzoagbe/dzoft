-- DZOFT: signed-scope change requests and auditable supplementary proposals.
-- No modification to accepted quotes, invoices, receipts, or notifications.
create table if not exists public.dzoft_change_requests (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.quotes(id),
 client_id uuid not null references public.clients(id),
 title text not null check (char_length(title) between 3 and 120),
 description text not null check (char_length(description) between 10 and 2000),
 status text not null default 'requested'
   check (status in ('requested','proposed','approved','declined','rejected','withdrawn')),
 proposed_scope text check (proposed_scope is null or char_length(proposed_scope) between 10 and 2000),
 extra_price numeric(12,2) check (extra_price is null or (extra_price >= 0 and extra_price <= 1000000)),
 timeline_impact text check (timeline_impact is null or char_length(timeline_impact) <= 600),
 proposal_version integer not null default 0 check (proposal_version >= 0),
 proposed_at timestamptz,
 decision_name text,
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists dzoft_change_requests_project on public.dzoft_change_requests(quote_id,created_at desc);
create table if not exists public.dzoft_change_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.dzoft_change_requests(id),
 event_type text not null check (event_type in ('requested','proposed','approved','declined','rejected','withdrawn')),
 actor_type text not null check (actor_type in ('client','owner')),
 proposal_version integer not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists dzoft_change_events_request on public.dzoft_change_events(request_id,created_at,id);
alter table public.dzoft_change_requests enable row level security;
alter table public.dzoft_change_events enable row level security;
revoke all on public.dzoft_change_requests,public.dzoft_change_events from public,anon,authenticated;
-- Direct table mutation must never bypass the audited RPC state machine.
create or replace function private.dzoft_change_event_immutable()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin raise exception 'Change request audit events cannot be modified'; end $fn$;
drop trigger if exists dzoft_change_event_no_mutation on public.dzoft_change_events;
create trigger dzoft_change_event_no_mutation before update or delete on public.dzoft_change_events
for each row execute function private.dzoft_change_event_immutable();
revoke all on function private.dzoft_change_event_immutable() from public,anon,authenticated;

create or replace function private.dzoft_client_for_change(p_token uuid, p_use_token boolean)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare cid uuid;
begin
 if p_use_token then
   select id into cid from public.clients where portal_token=p_token and user_id is null;
 else
   if auth.uid() is null then raise exception 'Client sign-in required'; end if;
   select id into cid from public.clients where user_id=auth.uid();
 end if;
 if cid is null then raise exception 'Client access denied'; end if;
 return cid;
end $fn$;

create or replace function private.dzoft_changes_for_project(p_client uuid,p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
begin
 if not exists (select 1 from public.quotes q
   where q.id=p_quote and q.client_id=p_client and q.shared and q.deleted_at is null and q.accepted_at is not null)
 then raise exception 'Accepted project not found'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)||
   jsonb_build_object('history',coalesce((select jsonb_agg(jsonb_build_object(
    'event_type',e.event_type,'actor_type',e.actor_type,'at',e.created_at,
    'proposal_version',e.proposal_version) order by e.created_at,e.id)
    from public.dzoft_change_events e where e.request_id=c.id),'[]'::jsonb))
   order by c.created_at desc,c.id)
   from public.dzoft_change_requests c where c.quote_id=p_quote and c.client_id=p_client),'[]'::jsonb);
end $fn$;

create or replace function private.dzoft_create_change(p_client uuid,p_quote uuid,p_title text,p_description text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests;
begin
 if not exists(select 1 from public.quotes q where q.id=p_quote and q.client_id=p_client
   and q.accepted_at is not null and q.shared and q.deleted_at is null)
 then raise exception 'Accepted project not found'; end if;
 p_title:=btrim(coalesce(p_title,''));p_description:=btrim(coalesce(p_description,''));
 if char_length(p_title) not between 3 and 120 or char_length(p_description) not between 10 and 2000
 then raise exception 'Request title or description length is invalid';end if;
 if (select count(*) from public.dzoft_change_requests where quote_id=p_quote and client_id=p_client
      and status in ('requested','proposed'))>=5 then raise exception 'Please resolve an existing open change request first'; end if;
 if exists(select 1 from public.dzoft_change_requests where quote_id=p_quote and client_id=p_client
      and created_at>now()-interval '60 seconds') then raise exception 'Please wait before submitting another request'; end if;
 insert into public.dzoft_change_requests(quote_id,client_id,title,description)
 values(p_quote,p_client,p_title,p_description) returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'requested','client',0,jsonb_build_object('title',c.title,'description',c.description));
 return to_jsonb(c);
end $fn$;

create or replace function private.dzoft_decide_change(p_client uuid,p_request uuid,p_version integer,p_approve boolean,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests;
begin
 select * into c from public.dzoft_change_requests where id=p_request and client_id=p_client for update;
 if not found then raise exception 'Request not found';end if;
 if not exists(select 1 from public.quotes q where q.id=c.quote_id and q.client_id=p_client
  and q.deleted_at is null and q.shared and q.accepted_at is not null) then raise exception 'Project not available';end if;
 if c.status<>'proposed' or c.proposal_version<>p_version or p_version<1
 then raise exception 'Proposal changed or is no longer awaiting approval';end if;
 p_name:=btrim(coalesce(p_name,''));
 if char_length(p_name) not between 2 and 120 then raise exception 'Your name is required to confirm this decision';end if;
 update public.dzoft_change_requests
 set status=case when p_approve then 'approved' else 'declined' end,
  decision_name=p_name,decided_at=now(),updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,c.status,'client',c.proposal_version,
   jsonb_build_object('name',p_name,'scope',c.proposed_scope,'extra_price',c.extra_price,
    'timeline_impact',c.timeline_impact,'original_quote',c.quote_id));
 return to_jsonb(c);
end $fn$;

create or replace function private.dzoft_withdraw_change(p_client uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests;
begin
 select * into c from public.dzoft_change_requests where id=p_request and client_id=p_client for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'This request cannot be withdrawn';end if;
 update public.dzoft_change_requests set status='withdrawn',updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version)
 values(c.id,'withdrawn','client',c.proposal_version);
 return to_jsonb(c);
end $fn$;

create or replace function public.owner_list_change_requests(p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare cid uuid;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select q.client_id into cid from public.quotes q where q.id=p_quote and q.deleted_at is null;
 if cid is null then raise exception 'Project not found';end if;
 return private.dzoft_changes_for_project(cid,p_quote);
end $fn$;

create or replace function public.owner_propose_change(p_request uuid,p_scope text,p_extra_price numeric,p_timeline text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests; q public.quotes;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'Only open requests can receive a proposal';end if;
 select * into q from public.quotes where id=c.quote_id and client_id=c.client_id;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared then raise exception 'Accepted project required';end if;
 p_scope:=btrim(coalesce(p_scope,''));p_timeline:=btrim(coalesce(p_timeline,''));
 if char_length(p_scope) not between 10 and 2000 or p_extra_price is null or
  p_extra_price<0 or p_extra_price>1000000 or p_extra_price<>round(p_extra_price,2)
  or char_length(p_timeline)>600 then raise exception 'Invalid change proposal';end if;
 update public.dzoft_change_requests set status='proposed',proposed_scope=p_scope,
  extra_price=p_extra_price,timeline_impact=p_timeline,
  proposal_version=proposal_version+1,proposed_at=now(),decided_at=null,decision_name=null,updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'proposed','owner',c.proposal_version,
 jsonb_build_object('scope',c.proposed_scope,'extra_price',c.extra_price,'timeline_impact',c.timeline_impact));
 return to_jsonb(c);
end $fn$;

create or replace function public.owner_reject_change(p_request uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'Request is not open';end if;
 p_reason:=btrim(coalesce(p_reason,''));
 if char_length(p_reason) not between 5 and 600 then raise exception 'Please explain why this change is declined';end if;
 update public.dzoft_change_requests set status='rejected',updated_at=now() where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'rejected','owner',c.proposal_version,jsonb_build_object('reason',p_reason));
 return to_jsonb(c);
end $fn$;

-- User account APIs (client_id resolved from verified auth.uid).
create or replace function public.my_list_change_requests(p_quote uuid)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_changes_for_project(private.dzoft_client_for_change(null,false),p_quote);
$fn$;
create or replace function public.my_create_change_request(p_quote uuid,p_title text,p_description text)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_create_change(private.dzoft_client_for_change(null,false),p_quote,p_title,p_description);
$fn$;
create or replace function public.my_decide_change_request(p_request uuid,p_version integer,p_approve boolean,p_name text)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_decide_change(private.dzoft_client_for_change(null,false),p_request,p_version,p_approve,p_name);
$fn$;
create or replace function public.my_withdraw_change_request(p_request uuid)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_withdraw_change(private.dzoft_client_for_change(null,false),p_request);
$fn$;

-- Existing invitation links work only while the client has no authenticated account.
create or replace function public.portal_list_change_requests(p_token uuid,p_quote uuid)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_changes_for_project(private.dzoft_client_for_change(p_token,true),p_quote);
$fn$;
create or replace function public.portal_create_change_request(p_token uuid,p_quote uuid,p_title text,p_description text)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_create_change(private.dzoft_client_for_change(p_token,true),p_quote,p_title,p_description);
$fn$;
create or replace function public.portal_decide_change_request(p_token uuid,p_request uuid,p_version integer,p_approve boolean,p_name text)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_decide_change(private.dzoft_client_for_change(p_token,true),p_request,p_version,p_approve,p_name);
$fn$;
create or replace function public.portal_withdraw_change_request(p_token uuid,p_request uuid)
returns jsonb language sql security definer set search_path='' as $fn$
 select private.dzoft_withdraw_change(private.dzoft_client_for_change(p_token,true),p_request);
$fn$;

revoke all on function
 private.dzoft_client_for_change(uuid,boolean),private.dzoft_changes_for_project(uuid,uuid),
 private.dzoft_create_change(uuid,uuid,text,text),
 private.dzoft_decide_change(uuid,uuid,integer,boolean,text),
 private.dzoft_withdraw_change(uuid,uuid),
 public.owner_list_change_requests(uuid),
 public.owner_propose_change(uuid,text,numeric,text),
 public.owner_reject_change(uuid,text),
 public.my_list_change_requests(uuid),
 public.my_create_change_request(uuid,text,text),
 public.my_decide_change_request(uuid,integer,boolean,text),
 public.my_withdraw_change_request(uuid),
 public.portal_list_change_requests(uuid,uuid),
 public.portal_create_change_request(uuid,uuid,text,text),
 public.portal_decide_change_request(uuid,uuid,integer,boolean,text),
 public.portal_withdraw_change_request(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.owner_list_change_requests(uuid),public.owner_propose_change(uuid,text,numeric,text),
 public.owner_reject_change(uuid,text),
 public.my_list_change_requests(uuid),public.my_create_change_request(uuid,text,text),
 public.my_decide_change_request(uuid,integer,boolean,text),public.my_withdraw_change_request(uuid)
 to authenticated;
grant execute on function public.portal_list_change_requests(uuid,uuid),
 public.portal_create_change_request(uuid,uuid,text,text),
 public.portal_decide_change_request(uuid,uuid,integer,boolean,text),
 public.portal_withdraw_change_request(uuid,uuid) to anon;
