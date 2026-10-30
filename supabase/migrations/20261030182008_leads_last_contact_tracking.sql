-- Record prospect-initiated follow-up dates for the reversible retention review.
begin;

alter table public.leads
  add column if not exists last_contact_at timestamptz;

comment on column public.leads.last_contact_at is
  'Last meaningful lead exchange recorded by the owner; used as the retention review reference date.';

-- Public quote requests must not set owner-maintained contact metadata.
alter policy "anyone can submit a new lead" on public.leads
  with check (
    status = 'nouvelle'
    and client_id is null
    and (user_id is null or user_id = (select auth.uid()))
    and archived_at is null
    and archive_previous_status is null
    and last_contact_at is null
  );

commit;
