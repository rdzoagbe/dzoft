-- DZOFT (18 Nov 2026) — owner backup of the business data.
-- « Sauvegarder mes données » (Paramètres) downloads every business record in one file, encrypted in the browser with a
-- password the owner chooses (the server never sees it). Only the owner with a recent second factor can export (is_owner()).
-- Left out on purpose: access secrets (clients.portal_token, sign_codes), e-mail provider setup and sync state.
-- Each export is logged privately, so the dashboard can remind the owner when the last backup is old.

create table if not exists private.owner_backup_log (
  id bigint generated always as identity primary key,
  made_at timestamptz not null default now(),
  made_by uuid not null,
  counts jsonb not null default '{}'::jsonb
);
alter table private.owner_backup_log enable row level security;
revoke all on private.owner_backup_log from public, anon, authenticated;

create or replace function public.owner_backup_export()
 returns jsonb language plpgsql volatile security definer set search_path to '' as $f$
declare
  t jsonb := '{}'::jsonb; c jsonb := '{}'::jsonb; rows jsonb; name text;
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
  foreach name in array array['leads','clients','quotes','messages','reviews','notifications','project_receipts',
    'project_receipt_method_audit','project_payment_statuses','project_updates','project_work_items','project_events',
    'email_outbox','dzoft_change_requests','dzoft_change_events','dzoft_credit_notes','settings'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x', name) into rows;
    if name = 'clients' then
      select coalesce(jsonb_agg(r - 'portal_token'),'[]'::jsonb) into rows from jsonb_array_elements(rows) r;
    end if;
    t := t || jsonb_build_object(name, rows);
    c := c || jsonb_build_object(name, jsonb_array_length(rows));
  end loop;
  -- The invoice register and its counters prove that invoice and credit-note numbers follow on without gaps.
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from private.dzoft_issued_invoice_registry x;
  t := t || jsonb_build_object('invoice_registry', rows); c := c || jsonb_build_object('invoice_registry', jsonb_array_length(rows));
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from private.dzoft_invoice_sequences x;
  t := t || jsonb_build_object('invoice_sequences', rows);
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from private.dzoft_credit_note_sequences x;
  t := t || jsonb_build_object('credit_note_sequences', rows);
  insert into private.owner_backup_log(made_by, counts) values (auth.uid(), c);
  return jsonb_build_object('format','dzoft-backup','version',1,'exported_at',now(),'tables',t,'counts',c);
end $f$;
revoke all on function public.owner_backup_export() from public, anon;
grant execute on function public.owner_backup_export() to authenticated;

-- Last backup, and the last important change since (signature, payment, invoice, credit note, extra decided).
create or replace function public.owner_backup_status()
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
  return jsonb_build_object(
    'last_backup_at', (select max(made_at) from private.owner_backup_log),
    'last_change_at', greatest(
      (select max(accepted_at) from public.quotes),
      (select max(created_at) from public.project_receipts),
      (select max(created_at) from private.dzoft_issued_invoice_registry),
      (select max(issued_at) from public.dzoft_credit_notes),
      (select max(decided_at) from public.dzoft_change_requests)));
end $f$;
revoke all on function public.owner_backup_status() from public, anon;
grant execute on function public.owner_backup_status() to authenticated;
