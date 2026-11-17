-- DZOFT (17 Nov 2026): a draft stays private even once it is closed.
-- Before: the client view only redacted/hid unsent drafts while status='proposed'; rejecting or withdrawing
-- an unsent draft (status 'rejected' / 'withdrawn') showed its unsent price and scope to the client.
-- Now, for every status:
-- * a proposal opened by DZOFT that was never sent (no 'sent' event) does not exist for the client;
-- * a proposal whose current version was not sent (sent_at is null) shows no draft scope, price or lines;
--   while still open it reads « requested » (being studied);
-- * history shows no 'proposed' event, nor the number, of a version that was never sent.

create or replace function private.dzoft_changes_for_client(p_client uuid, p_quote uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
 if not exists (select 1 from public.quotes q
   where q.id=p_quote and q.client_id=p_client and q.shared and q.deleted_at is null and q.accepted_at is not null)
 then raise exception 'Accepted project not found'; end if;
 return coalesce((select jsonb_agg(
   case when c.sent_at is null and c.proposal_version>0 then
     to_jsonb(c)||jsonb_build_object(
       'status',case when c.status='proposed' then 'requested' else c.status end,
       'proposed_scope',null,'extra_price',null,'timeline_impact',null,'lines',null,'proposal_number',null,
       'proposal_version',coalesce(s.last_sent,0),'proposed_at',null,'already_done',false)
   else to_jsonb(c) end
   ||jsonb_build_object('history',coalesce((select jsonb_agg(jsonb_build_object('event_type',e.event_type,
       'actor_type',e.actor_type,'at',e.created_at,
       'proposal_version',case when c.sent_at is null then least(e.proposal_version,coalesce(s.last_sent,0)) else e.proposal_version end)
       order by e.created_at,e.id)
     from public.dzoft_change_events e where e.request_id=c.id
       and (c.sent_at is not null or e.event_type<>'proposed' or e.proposal_version<=coalesce(s.last_sent,0))),'[]'::jsonb))
   order by c.created_at desc,c.id)
   from public.dzoft_change_requests c
   cross join lateral (select max(e.proposal_version) last_sent from public.dzoft_change_events e
     where e.request_id=c.id and e.event_type='sent') s
   where c.quote_id=p_quote and c.client_id=p_client
     -- Opened by DZOFT and never sent: it does not exist for the client, whatever its status.
     and not (c.sent_at is null and s.last_sent is null and c.proposal_version>0 and exists(select 1 from public.dzoft_change_events e
       where e.request_id=c.id and e.event_type='requested' and e.actor_type='owner'))),'[]'::jsonb);
end $function$;
revoke all on function private.dzoft_changes_for_client(uuid,uuid) from public,anon,authenticated;
