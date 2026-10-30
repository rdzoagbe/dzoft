-- Reversible retention review for unconverted quote requests.
-- This migration adds review metadata only; it does not archive or delete rows.
begin;

alter table public.leads
  add column if not exists archived_at timestamptz,
  add column if not exists archive_previous_status text;

comment on column public.leads.archived_at is
  'When an owner moved an old, unconverted lead to the reversible archive.';
comment on column public.leads.archive_previous_status is
  'Lead status to restore when an archived lead is restored by its owner.';

-- Public quote submissions must not set owner-only archive metadata.
alter policy "anyone can submit a new lead" on public.leads
  with check (
    status = 'nouvelle'
    and client_id is null
    and (user_id is null or user_id = (select auth.uid()))
    and archived_at is null
    and archive_previous_status is null
  );

commit;
