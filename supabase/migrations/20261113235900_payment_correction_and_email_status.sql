-- DZOFT: trustable payment metadata corrections and notification audit (2026-11-13).
-- Preserve every existing client, quote, payment amount, invoice and email.
-- Never turn a pending transfer into a confirmed receipt inside this migration.

create table if not exists public.project_receipt_method_audit (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.quotes(id),
 receipt_id uuid not null references public.project_receipts(id),
 previous_method text not null check (previous_method in ('transfer','card','cash','other')),
 corrected_method text not null check (corrected_method in ('transfer','card','cash','other')),
 reason text not null check (length(btrim(reason)) between 12 and 500),
 changed_by uuid not null,
 changed_at timestamptz not null default now()
);
create index if not exists project_receipt_method_audit_quote_id_idx
 on public.project_receipt_method_audit (quote_id,changed_at desc);
alter table public.project_receipt_method_audit enable row level security;
revoke all on public.project_receipt_method_audit from public,anon,authenticated;

create or replace function private.correct_project_receipt_method(
 p_quote uuid,p_receipt uuid,p_method text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 q public.quotes;
 r public.project_receipts;
 why text:=btrim(coalesce(p_reason,''));
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 if p_quote is null or p_receipt is null or p_method not in ('transfer','card','cash','other')
    or p_method is null or length(why) not between 12 and 500 then
  raise exception 'Invalid correction details';
 end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null then
  raise exception 'Project unavailable';
 end if;
 select * into r from public.project_receipts
 where quote_id=p_quote and id=p_receipt for update;
 if not found then raise exception 'Receipt not found'; end if;
 if r.method=p_method then raise exception 'Payment method unchanged'; end if;

 update public.project_receipts set method=p_method where id=p_receipt;
 -- Keep linked claims consistent without changing their status or value.
 update public.project_payment_statuses set method=p_method,updated_at=now()
  where receipt_id=p_receipt and quote_id=p_quote and status='received';
 insert into public.project_receipt_method_audit
  (quote_id,receipt_id,previous_method,corrected_method,reason,changed_by)
 values (p_quote,p_receipt,r.method,p_method,why,auth.uid());
 -- No payment-created event or client email: this is metadata correction only.
 return private.project_tracking(p_quote);
end $fn$;

create or replace function public.correct_project_receipt_method(
 p_quote uuid,p_receipt uuid,p_method text,p_reason text
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.correct_project_receipt_method(p_quote,p_receipt,p_method,p_reason);
$fn$;

create or replace function private.project_payment_admin_meta(p_quote uuid)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; notices jsonb; corrections jsonb;
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 select * into q from public.quotes where id=p_quote and deleted_at is null;
 if not found then raise exception 'Project unavailable'; end if;

 select coalesce(jsonb_agg(jsonb_build_object(
  'receipt_id',r.id,
  'email_status',coalesce(mail.email_status,'not_queued'),
  'sent_at',mail.sent_at
 ) order by r.created_at desc),'[]'::jsonb)
 into notices
 from public.project_receipts r
 left join lateral (
  select case
   when bool_or(o.status='sent') then 'sent'
   when bool_or(o.status='failed') then 'failed'
   when count(o.id)>0 then 'queued'
   else 'not_queued' end as email_status,
   max(o.sent_at) filter (where o.status='sent') as sent_at
  from public.project_events e
  join public.email_outbox o on o.event_id=e.id and o.recipient_role='client'
  where e.quote_id=p_quote and e.event_key='receipt:'||r.id::text
 ) mail on true
 where r.quote_id=p_quote;

 select coalesce(jsonb_agg(jsonb_build_object(
  'receipt_id',a.receipt_id,
  'old_method',a.previous_method,
  'new_method',a.corrected_method,
  'reason',a.reason,
  'changed_at',a.changed_at
 ) order by a.changed_at desc),'[]'::jsonb)
 into corrections
 from public.project_receipt_method_audit a where a.quote_id=p_quote;

 return jsonb_build_object('notifications',notices,'corrections',corrections);
end $fn$;

create or replace function public.project_payment_admin_meta(p_quote uuid)
 returns jsonb language sql security invoker set search_path='' as $fn$
 select private.project_payment_admin_meta(p_quote);
$fn$;

revoke all on function
 private.correct_project_receipt_method(uuid,uuid,text,text),
 public.correct_project_receipt_method(uuid,uuid,text,text),
 private.project_payment_admin_meta(uuid),
 public.project_payment_admin_meta(uuid)
from public,anon;
grant execute on function
 private.correct_project_receipt_method(uuid,uuid,text,text),
 public.correct_project_receipt_method(uuid,uuid,text,text),
 private.project_payment_admin_meta(uuid),
 public.project_payment_admin_meta(uuid)
to authenticated;
