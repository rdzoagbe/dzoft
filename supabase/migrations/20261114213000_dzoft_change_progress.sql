-- An accepted amendment authorizes work; record start and delivery separately.
alter table public.dzoft_change_requests drop constraint if exists dzoft_change_requests_status_check;
alter table public.dzoft_change_requests add constraint dzoft_change_requests_status_check
 check(status in ('requested','proposed','approved','declined','rejected','withdrawn','in_progress','completed'));
alter table public.dzoft_change_events drop constraint if exists dzoft_change_events_event_type_check;
alter table public.dzoft_change_events add constraint dzoft_change_events_event_type_check
 check(event_type in ('requested','proposed','approved','declined','rejected','withdrawn','in_progress','completed'));

create or replace function public.owner_progress_change(p_request uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.dzoft_change_requests;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or not (
   (c.status='approved' and p_status='in_progress')
   or (c.status='in_progress' and p_status='completed')
 ) then raise exception 'Only approved changes may start, then be completed';end if;
 update public.dzoft_change_requests set status=p_status,updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version)
 values(c.id,p_status,'owner',c.proposal_version);
 return to_jsonb(c);
end $fn$;
revoke all on function public.owner_progress_change(uuid,text) from public,anon,authenticated;
grant execute on function public.owner_progress_change(uuid,text) to authenticated;
