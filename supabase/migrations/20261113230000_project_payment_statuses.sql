-- DZOFT payment lifecycle: separate client-reported transfers from money actually received.
-- Additive only; existing project_receipts, clients, quotes and invoice records stay untouched.

create table if not exists public.project_payment_statuses (
 id uuid primary key,
 quote_id uuid not null references public.quotes(id),
 amount numeric(12,2) not null check(amount>0),
 method text not null check(method in ('transfer','cash','card','other')),
 status text not null check(status in ('pending','sent_by_client','received','cancelled')),
 reported_on date,
 reference text not null default '' check(length(reference)<=100),
 receipt_id uuid unique references public.project_receipts(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 confirmed_at timestamptz,
 created_by uuid not null
);
create index if not exists project_payment_statuses_quote_idx on public.project_payment_statuses(quote_id,created_at desc);
alter table public.project_payment_statuses enable row level security;
revoke all on public.project_payment_statuses from public,anon,authenticated;
-- Owners manage claims through guarded SECURITY DEFINER functions.
-- Clients read only sanitized statuses through existing project_tracking authorization.

create or replace function private.create_project_payment_status(
 p_quote uuid,p_id uuid,p_amount numeric,p_method text,
 p_status text,p_reported_on date,p_reference text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; x public.project_payment_statuses;
 state jsonb; already_pending numeric;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null or q.accepted_total is null or not q.shared
 then raise exception 'An accepted shared project is required'; end if;
 select * into x from public.project_payment_statuses where id=p_id;
 if found then
  if x.quote_id is distinct from p_quote or x.amount is distinct from p_amount
  or x.method is distinct from p_method or x.reference is distinct from coalesce(p_reference,'')
  then raise exception 'Payment status key already used'; end if;
  return private.project_tracking(p_quote);
 end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2)
  or p_amount>9999999999.99 or p_method not in ('transfer','cash','card','other')
  or p_status not in ('pending','sent_by_client') or p_method is null or p_status is null
  or p_reported_on>current_date or p_reported_on<date '2000-01-01'
  or p_reference is null or length(p_reference)>100
  or (p_status='sent_by_client' and p_reported_on is null)
 then raise exception 'Invalid payment status details'; end if;
 state:=private.project_tracking(p_quote);
 select coalesce(sum(amount),0) into already_pending from public.project_payment_statuses
 where quote_id=p_quote and status in ('pending','sent_by_client');
 if p_amount+already_pending>(state->>'remaining')::numeric
 then raise exception 'Pending payments exceed remaining balance'; end if;
 insert into public.project_payment_statuses
 (id,quote_id,amount,method,status,reported_on,reference,created_by)
 values(p_id,p_quote,p_amount,p_method,p_status,p_reported_on,p_reference,auth.uid());
 return private.project_tracking(p_quote);
end $fn$;

create or replace function public.create_project_payment_status(
 p_quote uuid,p_id uuid,p_amount numeric,p_method text,
 p_status text,p_reported_on date default null,p_reference text default ''
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.create_project_payment_status(
  p_quote,p_id,p_amount,p_method,p_status,p_reported_on,p_reference);
$fn$;

create or replace function private.update_project_payment_status(
 p_quote uuid,p_id uuid,p_status text,p_reported_on date
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; x public.project_payment_statuses;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null or not q.shared
 then raise exception 'An accepted shared project is required'; end if;
 select * into x from public.project_payment_statuses where id=p_id and quote_id=p_quote for update;
 if not found then raise exception 'Payment status not found'; end if;
 if x.status in ('received','cancelled') then raise exception 'A finalized payment status cannot be changed'; end if;
 if p_status not in ('pending','sent_by_client','cancelled') or p_status is null
  or p_reported_on>current_date or p_reported_on<date '2000-01-01'
  or (p_status='sent_by_client' and p_reported_on is null)
 then raise exception 'Invalid payment status'; end if;
 update public.project_payment_statuses set
  status=p_status,reported_on=p_reported_on,updated_at=now()
 where id=p_id;
 return private.project_tracking(p_quote);
end $fn$;

create or replace function public.update_project_payment_status(
 p_quote uuid,p_id uuid,p_status text,p_reported_on date default null
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.update_project_payment_status(p_quote,p_id,p_status,p_reported_on);
$fn$;

create or replace function private.confirm_project_payment_status(
 p_quote uuid,p_id uuid,p_received_on date,p_notify boolean
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; x public.project_payment_statuses; result jsonb;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null or q.accepted_total is null or not q.shared
 then raise exception 'An accepted shared project is required'; end if;
 select * into x from public.project_payment_statuses where id=p_id and quote_id=p_quote for update;
 if not found then raise exception 'Payment status not found'; end if;
 if x.status='received' then return private.project_tracking(p_quote); end if;
 if x.status='cancelled' then raise exception 'Cancelled payments cannot be confirmed'; end if;
 if p_received_on is null or p_received_on>current_date or p_received_on<date '2000-01-01'
  or p_notify is null then raise exception 'Invalid confirmation date'; end if;
 -- Reuse the existing validated owner-only receipt path. The operation is atomic:
 -- if it fails, the claim remains pending and does not enter confirmed totals.
 result:=private.record_project_payment_unbilled(
   p_quote,p_id,x.amount,p_received_on,x.method,x.reference,p_notify
 );
 update public.project_payment_statuses set
 status='received',receipt_id=p_id,confirmed_at=now(),updated_at=now()
 where id=p_id;
 return private.project_tracking(p_quote);
end $fn$;

create or replace function public.confirm_project_payment_status(
 p_quote uuid,p_id uuid,p_received_on date,p_notify boolean default true
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.confirm_project_payment_status(p_quote,p_id,p_received_on,p_notify);
$fn$;

-- Keep the original project_tracking authorization, confirmed sums, historical
-- legacy invoice adjustment and progress feed. Include sanitized status list.
create or replace function private.project_tracking(p_quote uuid)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; received numeric; legacy numeric; rows jsonb; reports jsonb;
begin
 select * into q from public.quotes where id=p_quote and deleted_at is null;
 if not found or auth.uid() is null or not (public.is_owner() or
   (q.shared and q.accepted_at is not null and exists(
     select 1 from public.clients c where c.id=q.client_id and c.user_id=auth.uid())))
 then raise exception 'Project unavailable'; end if;
 select coalesce(sum(amount),0) into received
 from public.project_receipts where quote_id=p_quote;
 select coalesce(sum((i->>'amt')::numeric),0) into legacy
 from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) i
 where not (i ? 'care') and i->>'paid'='true'
 and coalesce(i->>'amt','') ~ '^[0-9]+([.][0-9]+)?$'
 and not exists(select 1 from public.project_receipts r
   where r.quote_id=p_quote and r.invoice_id=i->>'id');
 select coalesce(jsonb_agg(to_jsonb(r)-'created_by' order by r.received_on desc,r.created_at desc),'[]'::jsonb)
 into rows from public.project_receipts r where quote_id=p_quote;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',s.id,'amount',s.amount,'method',s.method,'status',s.status,
  'reported_on',s.reported_on,'reference',s.reference,
  'receipt_id',s.receipt_id,'confirmed_at',s.confirmed_at,
  'created_at',s.created_at
 ) order by s.created_at desc),'[]'::jsonb)
 into reports from public.project_payment_statuses s where quote_id=p_quote;
 return jsonb_build_object(
  'total',q.accepted_total,'received',received+legacy,'legacy',legacy,
  'remaining',greatest(coalesce(q.accepted_total,0)-received-legacy,0),
  'receipts',rows,'payment_statuses',reports,
  'updates',(select coalesce(jsonb_agg(to_jsonb(u)-'created_by' order by u.created_at desc),'[]'::jsonb)
    from public.project_updates u where quote_id=p_quote)
 );
end $fn$;

revoke all on function
 private.create_project_payment_status(uuid,uuid,numeric,text,text,date,text),
 private.update_project_payment_status(uuid,uuid,text,date),
 private.confirm_project_payment_status(uuid,uuid,date,boolean),
 public.create_project_payment_status(uuid,uuid,numeric,text,text,date,text),
 public.update_project_payment_status(uuid,uuid,text,date),
 public.confirm_project_payment_status(uuid,uuid,date,boolean)
from public,anon;
grant execute on function
 private.create_project_payment_status(uuid,uuid,numeric,text,text,date,text),
 private.update_project_payment_status(uuid,uuid,text,date),
 private.confirm_project_payment_status(uuid,uuid,date,boolean),
 public.create_project_payment_status(uuid,uuid,numeric,text,text,date,text),
 public.update_project_payment_status(uuid,uuid,text,date),
 public.confirm_project_payment_status(uuid,uuid,date,boolean)
to authenticated;
