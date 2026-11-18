-- Manual sharing of extra-work proposals. Security and financial invariants:
-- - Owner-only, current proposal version, accepted existing project.
-- - No queue_project_event, email_outbox, HTTP, notification, invoice or payment mutations.
-- - Opens the proposal in the client portal only after the owner explicitly
--   confirms they have sent the explanation themselves in Outlook/WhatsApp.
-- - Previous 'sent' events and delivery history remain immutable and auditable.
create or replace function public.owner_mark_change_shared_manually(
  p_request uuid, p_version integer
) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare
  c public.dzoft_change_requests;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Owner access required';
  end if;
  select * into c from public.dzoft_change_requests
    where id=p_request for update;
  if not found or c.status<>'proposed'
    or c.proposal_version<>p_version or p_version<1
    or c.sent_at is not null then
    raise exception 'Proposal is already shared or was revised';
  end if;
  if not exists (
    select 1 from public.quotes q
    where q.id=c.quote_id and q.client_id=c.client_id
      and q.accepted_at is not null and q.deleted_at is null and q.shared
  ) then
    raise exception 'Accepted project required';
  end if;

  update public.dzoft_change_requests
    set sent_at=now(),updated_at=now() where id=c.id
    returning * into c;
  insert into public.dzoft_change_events(
    request_id,event_type,actor_type,proposal_version,details
  ) values(
    c.id,'sent','owner',c.proposal_version,
    jsonb_build_object('channel','manual','confirmation','owner_attested',
      'delivery_verification','not_available','automatic_email',false)
  );
  return to_jsonb(c);
end $fn$;

-- Disable the historical one-click RPC that enqueued both client and owner
-- transactional emails. Existing sent messages and statuses are preserved.
revoke execute on function public.owner_send_change_proposal(uuid)
  from public,anon,authenticated;
revoke all on function public.owner_mark_change_shared_manually(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.owner_mark_change_shared_manually(uuid,integer)
  to authenticated;
