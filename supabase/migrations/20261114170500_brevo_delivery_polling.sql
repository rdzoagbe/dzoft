-- Brevo account's webhook-management API returns HTTP 400; event-reporting
-- API works. Enable safe, server-side polling as an alternative.
alter table private.brevo_delivery_setup
 add column if not exists polling_active boolean not null default false,
 add column if not exists last_polled_at timestamptz;

create or replace function private.brevo_delivery_recent_candidates(p_setup_token text)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare items jsonb;
begin
 if not private.verify_brevo_delivery_token(p_setup_token,'setup') then
  raise exception 'Unauthorized delivery reconciliation';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'message_id',x.provider_message_id,'email',x.recipient)),'[]'::jsonb)
 into items from (
   select provider_message_id,recipient
   from public.email_outbox
   where status='sent' and provider_message_id is not null and recipient is not null
     and created_at>=now()-interval '14 days'
     and delivery_status not in ('hard_bounce','blocked','invalid','spam')
   order by created_at desc limit 18
 ) x;
 return items;
end $fn$;
create or replace function public.brevo_delivery_recent_candidates(p_setup_token text)
 returns jsonb language sql security invoker set search_path='' as $fn$
 select private.brevo_delivery_recent_candidates(p_setup_token);
$fn$;

create or replace function private.mark_brevo_delivery_polling(p_backfill boolean default false)
 returns boolean language plpgsql security definer set search_path='' as $fn$
begin
 insert into private.brevo_delivery_setup(singleton,polling_active,last_polled_at,backfilled_at)
 values(true,true,now(),case when p_backfill then now() else null end)
 on conflict(singleton) do update
 set polling_active=true,
     last_polled_at=now(),
     backfilled_at=coalesce(excluded.backfilled_at,private.brevo_delivery_setup.backfilled_at);
 return true;
end $fn$;
create or replace function public.mark_brevo_delivery_polling(p_backfill boolean default false)
 returns boolean language sql security invoker set search_path='' as $fn$
 select private.mark_brevo_delivery_polling(p_backfill);
$fn$;

create or replace function private.brevo_delivery_monitor()
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare data private.brevo_delivery_setup%rowtype;
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 select * into data from private.brevo_delivery_setup where singleton=true;
 return jsonb_build_object(
  'webhook_configured',coalesce(data.active,false),
  'poll_enabled',coalesce(data.polling_active,false) and exists(
    select 1 from cron.job where jobname='dzoft_brevo_delivery_reconcile' and active
  ),
  'last_polled_at',data.last_polled_at,
  'backfilled_at',data.backfilled_at,
  'received_events',(select count(*) from private.brevo_delivery_events)
 );
end $fn$;
create or replace function public.brevo_delivery_monitor()
 returns jsonb language sql security invoker set search_path='' as $fn$
 select private.brevo_delivery_monitor();
$fn$;

revoke all on function
 private.brevo_delivery_recent_candidates(text),
 public.brevo_delivery_recent_candidates(text),
 private.mark_brevo_delivery_polling(boolean),
 public.mark_brevo_delivery_polling(boolean),
 private.brevo_delivery_monitor(),
 public.brevo_delivery_monitor()
 from public,anon,authenticated;
grant execute on function
 private.brevo_delivery_recent_candidates(text),
 public.brevo_delivery_recent_candidates(text),
 private.mark_brevo_delivery_polling(boolean),
 public.mark_brevo_delivery_polling(boolean)
 to service_role;
grant execute on function private.brevo_delivery_monitor(),public.brevo_delivery_monitor()
 to authenticated;
