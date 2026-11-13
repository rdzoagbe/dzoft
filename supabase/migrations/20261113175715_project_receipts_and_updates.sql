-- Append-only receipts. Existing paid invoices remain a baseline, never an extra receipt.
create table public.project_receipts (
 id uuid primary key, quote_id uuid not null references public.quotes(id),
 invoice_id text not null, amount numeric(12,2) not null check(amount>0),
 received_on date not null, method text not null check(method in ('transfer','card','cash','other')),
 reference text not null default '' check(length(reference)<=100),
 created_at timestamptz not null default now(), created_by uuid not null
);
create index project_receipts_quote_idx on public.project_receipts(quote_id,invoice_id);
alter table public.project_receipts enable row level security;
revoke all on public.project_receipts from public,anon,authenticated;
create table public.project_updates (
 id uuid primary key, quote_id uuid not null references public.quotes(id),
 category text not null check(category in ('design','accounts','venue','chat','safety','other')),
 status text not null check(status in ('planned','working','built','tested')),
 summary text not null check(length(summary) between 1 and 220),
 created_at timestamptz not null default now(), created_by uuid not null
);
create index project_updates_quote_idx on public.project_updates(quote_id,created_at desc);
alter table public.project_updates enable row level security;
revoke all on public.project_updates from public,anon,authenticated;
-- Tables are intentionally RPC-only, with explicit scope checks below.
create or replace function private.project_tracking(p_quote uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; received numeric; legacy numeric; rows jsonb;
begin
 select * into q from public.quotes where id=p_quote and deleted_at is null;
 if not found or auth.uid() is null or not (public.is_owner() or
   (q.shared and q.accepted_at is not null and exists(select 1 from public.clients c where c.id=q.client_id and c.user_id=auth.uid())))
 then raise exception 'Project unavailable'; end if;
 select coalesce(sum(amount),0) into received from public.project_receipts where quote_id=p_quote;
 select coalesce(sum((i->>'amt')::numeric),0) into legacy from jsonb_array_elements(coalesce(q.invoices,'[]')) i
 where not (i ? 'care') and i->>'paid'='true' and coalesce(i->>'amt','') ~ '^[0-9]+([.][0-9]+)?$'
 and not exists(select 1 from public.project_receipts r where r.quote_id=p_quote and r.invoice_id=i->>'id');
 select coalesce(jsonb_agg(to_jsonb(r)-'created_by' order by r.received_on desc,r.created_at desc),'[]') into rows
 from public.project_receipts r where quote_id=p_quote;
 return jsonb_build_object('total',q.accepted_total,'received',received+legacy,'legacy',legacy,
 'remaining',greatest(coalesce(q.accepted_total,0)-received-legacy,0),
 'receipts',rows,'updates',(select coalesce(jsonb_agg(to_jsonb(u)-'created_by' order by u.created_at desc),'[]')
 from public.project_updates u where quote_id=p_quote));
end $fn$;
create or replace function public.project_tracking(p_quote uuid) returns jsonb
language sql security invoker set search_path='' as $fn$ select private.project_tracking(p_quote); $fn$;
revoke all on function private.project_tracking(uuid), public.project_tracking(uuid) from public,anon;
grant execute on function private.project_tracking(uuid), public.project_tracking(uuid) to authenticated;

-- Guard invoices with ledger receipts against stale autosaves, deletion and amount changes.
create or replace function private.guard_receipt_invoices() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare r record; i jsonb; prev jsonb;
begin
 for r in select distinct invoice_id from public.project_receipts where quote_id=new.id loop
  select value into i from jsonb_array_elements(coalesce(new.invoices,'[]')) where value->>'id'=r.invoice_id;
  select value into prev from jsonb_array_elements(coalesce(old.invoices,'[]')) where value->>'id'=r.invoice_id;
  if i is null or i->>'amt' is distinct from prev->>'amt' or i->>'num' is distinct from prev->>'num'
  then raise exception 'An invoice with recorded receipts cannot be removed or changed'; end if;
  if coalesce(current_setting('dzoft.receipt_write',true),'')<>'yes' and i->>'paid' is distinct from prev->>'paid'
  then raise exception 'Payment status is calculated from recorded receipts'; end if;
 end loop;
 return new;
end $fn$;
revoke all on function private.guard_receipt_invoices() from public,anon,authenticated;
create trigger a_guard_receipt_invoices before update of invoices on public.quotes for each row execute function private.guard_receipt_invoices();
-- The receipt RPC queues exactly one email event; skip the old full-invoice event for this transaction.
do $do$ declare d text; begin
 d:=pg_get_functiondef('private.payment_confirmation_events()'::regprocedure);
 if position('for inv in' in d)=0 then raise exception 'Unexpected payment trigger'; end if;
 d:=replace(d,'for inv in', E'if current_setting(''dzoft.receipt_write'',true) = ''yes'' then return new; end if;\n for inv in');
 execute d;
end $do$;
create or replace function private.record_project_receipt(p_quote uuid,p_id uuid,p_invoice text,p_amount numeric,p_date date,p_method text,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; i jsonb; pos integer; already numeric; state jsonb; r public.project_receipts;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null or q.accepted_total is null or not q.shared then raise exception 'An accepted shared project is required'; end if;
 select * into r from public.project_receipts where id=p_id;
 if found then
  if r.quote_id<>p_quote or r.invoice_id<>p_invoice or r.amount<>p_amount or r.received_on<>p_date or r.method<>p_method or r.reference<>p_reference then raise exception 'Receipt key already used'; end if;
  return private.project_tracking(p_quote);
 end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>9999999999.99
 or p_date is null or p_date>current_date or p_date<date '2000-01-01' or p_method is null or p_method not in ('transfer','card','cash','other')
 or p_reference is null or length(p_reference)>100 then raise exception 'Invalid payment details'; end if;
 select value,ordinality::integer-1 into i,pos from jsonb_array_elements(coalesce(q.invoices,'[]')) with ordinality where value->>'id'=p_invoice;
 if i is null or i ? 'care' or coalesce(i->>'num','')='' or i->>'paid'='true' then raise exception 'Choose an unpaid numbered invoice'; end if;
 select coalesce(sum(amount),0) into already from public.project_receipts where quote_id=p_quote and invoice_id=p_invoice;
 state:=private.project_tracking(p_quote);
 if p_amount>(i->>'amt')::numeric-already or p_amount>(state->>'remaining')::numeric then raise exception 'Amount exceeds remaining balance'; end if;
 insert into public.project_receipts values(p_id,p_quote,p_invoice,p_amount,p_date,p_method,p_reference,now(),auth.uid());
 if already+p_amount=(i->>'amt')::numeric then
  perform set_config('dzoft.receipt_write','yes',true);
  update public.quotes set invoices=jsonb_set(invoices,array[pos::text],i||jsonb_build_object('paid',true,'payment_confirmed_at',now())) where id=p_quote;
  perform set_config('dzoft.receipt_write','no',true);
 end if;
 state:=private.project_tracking(p_quote);
 perform private.queue_project_event('receipt:'||p_id,'payment_received',
 'Reçu / Received: '||p_amount||' EUR · Total reçu / Received total: '||(state->>'received')||' EUR · Reste / Remaining: '||(state->>'remaining')||' EUR. Selon échéancier / Per agreed schedule.',
 q.client_id,q.id,p_invoice_id=>p_invoice,p_notify_client=>true,p_notify_owner=>true);
 return state;
end $fn$;
create or replace function public.record_project_receipt(p_quote uuid,p_id uuid,p_invoice text,p_amount numeric,p_date date,p_method text,p_reference text default '') returns jsonb
language sql security invoker set search_path='' as $fn$ select private.record_project_receipt(p_quote,p_id,p_invoice,p_amount,p_date,p_method,p_reference); $fn$;
revoke all on function private.record_project_receipt(uuid,uuid,text,numeric,date,text,text),public.record_project_receipt(uuid,uuid,text,numeric,date,text,text) from public,anon;
grant execute on function private.record_project_receipt(uuid,uuid,text,numeric,date,text,text),public.record_project_receipt(uuid,uuid,text,numeric,date,text,text) to authenticated;

-- Add one explicit client-facing digest event, separate from private journal and completed milestones.
do $do$ declare c text; begin
 select pg_get_constraintdef(oid) into c from pg_constraint where conrelid='public.project_events'::regclass and conname='project_events_event_type_check';
 if c is null then raise exception 'Event constraint missing'; end if;
 alter table public.project_events drop constraint project_events_event_type_check;
 execute 'alter table public.project_events add constraint project_events_event_type_check '||replace(c,'''payment_received''::text','''progress_digest''::text, ''payment_received''::text');
end $do$;
create or replace function private.publish_project_update(p_quote uuid,p_id uuid,p_category text,p_status text,p_summary text) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; u public.project_updates;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or not q.shared or q.accepted_at is null then raise exception 'Accepted shared project required'; end if;
 select * into u from public.project_updates where id=p_id;
 if found then
  if u.quote_id<>p_quote or u.category<>p_category or u.status<>p_status or u.summary<>btrim(p_summary) then raise exception 'Update key already used'; end if;
  return private.project_tracking(p_quote);
 end if;
 insert into public.project_updates values(p_id,p_quote,p_category,p_status,btrim(p_summary),now(),auth.uid());
 perform private.queue_project_event('digest:'||p_id,'progress_digest','Avancement / Progress · '||p_category||' · '||p_status||' · '||btrim(p_summary),q.client_id,q.id,p_notify_client=>true,p_notify_owner=>true);
 return private.project_tracking(p_quote);
end $fn$;
create or replace function public.publish_project_update(p_quote uuid,p_id uuid,p_category text,p_status text,p_summary text) returns jsonb
language sql security invoker set search_path='' as $fn$ select private.publish_project_update(p_quote,p_id,p_category,p_status,p_summary); $fn$;
revoke all on function private.publish_project_update(uuid,uuid,text,text,text),public.publish_project_update(uuid,uuid,text,text,text) from public,anon;
grant execute on function private.publish_project_update(uuid,uuid,text,text,text),public.publish_project_update(uuid,uuid,text,text,text) to authenticated;
