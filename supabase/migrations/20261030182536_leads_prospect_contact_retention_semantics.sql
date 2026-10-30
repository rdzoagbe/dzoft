-- Only a contact initiated by the prospect resets the three-year review clock.
begin;

alter table public.leads
  rename column last_contact_at to last_prospect_contact_at;

comment on column public.leads.last_prospect_contact_at is
  'Date of the latest contact initiated by the prospect, recorded by the owner and used as the retention review reference date. Outbound owner follow-ups do not reset this date.';

-- Keep the owner-maintained prospect-contact date inaccessible to public submissions.
alter policy "anyone can submit a new lead" on public.leads
  with check (
    status = 'nouvelle'
    and client_id is null
    and (user_id is null or user_id = (select auth.uid()))
    and archived_at is null
    and archive_previous_status is null
    and last_prospect_contact_at is null
  );

commit;
