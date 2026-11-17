-- DZOFT: the owner is e-mailed when a client sends a change request, declines a proposal or
-- withdraws a request (signing already sends change_signed). Built on the change log, so every
-- path (client account or secret link) is covered, and owner actions never e-mail the owner.
alter table public.project_events drop constraint if exists project_events_event_type_check;
alter table public.project_events add constraint project_events_event_type_check CHECK (event_type = ANY (ARRAY[
  'quote_published','quote_accepted','client_message','owner_message','step_validation_requested','step_progress',
  'client_step_validated','invoice_shared','client_file_uploaded','review_submitted','payment_reported','progress_digest',
  'payment_received','payment_reopened','change_proposed','change_signed',
  'change_requested','change_declined','change_withdrawn']::text[]));

create or replace function private.capture_client_change_event()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare c public.dzoft_change_requests; kind text; label text;
begin
  if new.actor_type<>'client' or new.event_type not in ('requested','declined','withdrawn') then return new; end if;
  select * into c from public.dzoft_change_requests where id=new.request_id;
  if not found then return new; end if;
  kind:=case new.event_type when 'requested' then 'change_requested' when 'declined' then 'change_declined' else 'change_withdrawn' end;
  label:=case new.event_type
    when 'requested' then 'Nouvelle demande de modification du client · '||left(c.title,160)
    when 'declined' then 'Proposition '||coalesce(c.proposal_number,'complémentaire')||' refusée par le client'||
      coalesce(' · '||private.format_eur(c.extra_price),'')
    else 'Demande retirée par le client · '||left(c.title,160) end;
  perform private.queue_project_event('change-'||new.event_type||':'||c.id||':v'||new.proposal_version||':'||new.id,
    kind,left(label,300),c.client_id,c.quote_id,null,null,null,false,true,false);
  return new;
end $function$;
revoke all on function private.capture_client_change_event() from public,anon,authenticated;

drop trigger if exists dzoft_change_events_notify_owner on public.dzoft_change_events;
create trigger dzoft_change_events_notify_owner after insert on public.dzoft_change_events
  for each row execute function private.capture_client_change_event();

-- Open extra-work items for the dashboard "to do" list (owner only).
create or replace function public.owner_open_change_requests()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'quote_id',c.quote_id,'client_id',c.client_id,'status',c.status,'title',c.title,
      'proposal_number',c.proposal_number,'extra_price',c.extra_price,'sent_at',c.sent_at,
      'updated_at',c.updated_at,'created_at',c.created_at,
      'invoiced',exists(select 1 from private.dzoft_issued_invoice_registry r where r.change_id=c.id))
      order by c.updated_at desc)
    from public.dzoft_change_requests c join public.quotes q on q.id=c.quote_id and q.deleted_at is null
    where c.status in ('requested','proposed','approved','in_progress','completed')),'[]'::jsonb);
end $function$;
revoke all on function public.owner_open_change_requests() from public,anon;
grant execute on function public.owner_open_change_requests() to authenticated;
