-- DZOFT Brevo delivery tracking: additive, owner-private, no sending/payment changes.
-- "sent" in email_outbox continues to mean Brevo accepted the API request.
-- Only a verified Brevo event can establish delivered, opened, or bounced.

alter table public.email_outbox
  add column if not exists delivery_status text not null default 'unconfirmed'
    check (delivery_status in ('unconfirmed','delivered','opened','deferred',
      'soft_bounce','hard_bounce','blocked','invalid','spam','error')),
  add column if not exists delivery_event_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists delivery_updated_at timestamptz;

create table if not exists private.brevo_delivery_events (
  outbox_id uuid not null references public.email_outbox(id) on delete cascade,
  event_type text not null
    check (event_type in ('delivered','opened','proxy_open','unique_opened','soft_bounce',
      'hard_bounce','blocked','invalid','spam','deferred','error')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  primary key (outbox_id,event_type,occurred_at)
);
revoke all on private.brevo_delivery_events from public,anon,authenticated;

create table if not exists private.brevo_delivery_setup (
  singleton boolean primary key default true check (singleton),
  webhook_id bigint,
  active boolean not null default false,
  configured_at timestamptz,
  backfilled_at timestamptz
);
revoke all on private.brevo_delivery_setup from public,anon,authenticated;

do $setup$
begin
 if not exists (select 1 from vault.secrets where name='dzoft_brevo_webhook_token') then
   perform vault.create_secret(encode(gen_random_bytes(32),'hex'),
     'dzoft_brevo_webhook_token','Brevo transactional webhook to DZOFT Edge; kept server-only');
 end if;
 if not exists (select 1 from vault.secrets where name='dzoft_brevo_setup_token') then
   perform vault.create_secret(encode(gen_random_bytes(32),'hex'),
     'dzoft_brevo_setup_token','One-time service-to-service Brevo webhook provisioning');
 end if;
end $setup$;

create or replace function private.verify_brevo_delivery_token(p_token text,p_kind text)
 returns boolean language sql security definer set search_path='' as $fn$
 select p_token is not null
    and p_token ~ '^[0-9a-f]{64}$'
    and p_kind in ('webhook','setup')
    and coalesce(p_token = (
      select s.decrypted_secret from vault.decrypted_secrets s
      where s.name=case p_kind when 'webhook' then 'dzoft_brevo_webhook_token'
                                     else 'dzoft_brevo_setup_token' end
      limit 1
    ),false);
$fn$;
create or replace function public.verify_brevo_delivery_token(p_token text,p_kind text)
 returns boolean language sql security invoker set search_path='' as $fn$
 select private.verify_brevo_delivery_token(p_token,p_kind);
$fn$;

create or replace function private.brevo_delivery_setup_credential(p_setup_token text)
 returns text language plpgsql security definer set search_path='' as $fn$
declare secret text;
begin
 if not private.verify_brevo_delivery_token(p_setup_token,'setup') then
  raise exception 'Invalid delivery provisioning token';
 end if;
 select decrypted_secret into secret from vault.decrypted_secrets
 where name='dzoft_brevo_webhook_token' limit 1;
 if secret is null then raise exception 'Webhook secret unavailable'; end if;
 return secret;
end $fn$;
create or replace function public.brevo_delivery_setup_credential(p_setup_token text)
 returns text language sql security invoker set search_path='' as $fn$
 select private.brevo_delivery_setup_credential(p_setup_token);
$fn$;

create or replace function private.record_brevo_delivery_event(
 p_message_id text,p_recipient text,p_event text,p_occurred_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 normalized_id text:=lower(btrim(coalesce(p_message_id,''),' <>'));
 normalized_email text:=lower(btrim(coalesce(p_recipient,'')));
 normalized_event text:=lower(btrim(coalesce(p_event,'')));
 job public.email_outbox%rowtype;
 target text;
 applied boolean:=false;
 existing_rank int;
 incoming_rank int;
 other_match boolean;
begin
 if length(normalized_id)<10 or length(normalized_id)>250
    or length(normalized_email)<5 or length(normalized_email)>320
    or position('@' in normalized_email)=0
    or p_occurred_at is null
    or p_occurred_at>now()+interval '1 day'
    or p_occurred_at<now()-interval '180 days' then
  raise exception 'Invalid delivery event';
 end if;
 if normalized_event in ('request','sent','click','unsubscribed') then
  return jsonb_build_object('matched',false,'ignored',true);
 end if;
 if normalized_event not in (
    'delivered','opened','open','proxy_open','unique_opened','unique_proxy_open',
    'soft_bounce','hard_bounce','blocked','invalid','invalid_email','spam','deferred','error'
 ) then return jsonb_build_object('matched',false,'ignored',true); end if;

 select * into job from public.email_outbox o
  where lower(btrim(coalesce(o.provider_message_id,''),' <>'))=normalized_id
    and lower(btrim(coalesce(o.recipient,'')))=normalized_email
    and o.status='sent'
  order by o.created_at desc limit 1 for update;
 if not found then return jsonb_build_object('matched',false,'ignored',false); end if;
 select exists(
   select 1 from public.email_outbox o where o.id<>job.id
     and lower(btrim(coalesce(o.provider_message_id,''),' <>'))=normalized_id
     and lower(btrim(coalesce(o.recipient,'')))=normalized_email and o.status='sent'
 ) into other_match;
 if other_match then raise exception 'Ambiguous provider delivery identifier'; end if;

 normalized_event:=case normalized_event
  when 'open' then 'opened'
  when 'unique_opened' then 'opened'
  when 'unique_proxy_open' then 'proxy_open'
  when 'invalid_email' then 'invalid'
  else normalized_event end;
 target:=case normalized_event when 'proxy_open' then 'opened' else normalized_event end;

 insert into private.brevo_delivery_events(outbox_id,event_type,occurred_at)
 values(job.id,normalized_event,p_occurred_at)
 on conflict do nothing;
 -- Delivery events can arrive out of order. Use the latest event, but avoid
 -- downgrading "opened" to "delivered" from a delayed callback.
 existing_rank:=case job.delivery_status
   when 'opened' then 3 when 'delivered' then 2
   when 'unconfirmed' then 0 else 1 end;
 incoming_rank:=case target
   when 'opened' then 3 when 'delivered' then 2 else 1 end;
 applied:=job.delivery_event_at is null
   or p_occurred_at>job.delivery_event_at
   or (p_occurred_at=job.delivery_event_at and incoming_rank>existing_rank);

 update public.email_outbox
 set
  delivered_at=case when target='delivered' then coalesce(delivered_at,p_occurred_at) else delivered_at end,
  opened_at=case when target='opened' then coalesce(opened_at,p_occurred_at) else opened_at end,
  bounced_at=case when target in ('hard_bounce','soft_bounce','blocked','invalid','spam','error')
                   then coalesce(bounced_at,p_occurred_at) else bounced_at end,
  delivery_status=case
   when not applied then delivery_status
   when delivery_status='opened' and target='delivered' then 'opened'
   else target end,
  delivery_event_at=case when applied then p_occurred_at else delivery_event_at end,
  delivery_updated_at=now()
 where id=job.id;

 return jsonb_build_object('matched',true,'applied',applied);
end $fn$;
create or replace function public.record_brevo_delivery_event(
 p_message_id text,p_recipient text,p_event text,p_occurred_at timestamptz
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.record_brevo_delivery_event(p_message_id,p_recipient,p_event,p_occurred_at);
$fn$;

create or replace function private.mark_brevo_delivery_setup(p_webhook_id bigint,p_backfill boolean default false)
returns boolean language plpgsql security definer set search_path='' as $fn$
begin
 if p_webhook_id is null or p_webhook_id<1 then raise exception 'Bad webhook id'; end if;
 insert into private.brevo_delivery_setup(singleton,webhook_id,active,configured_at,backfilled_at)
 values(true,p_webhook_id,true,now(),case when p_backfill then now() else null end)
 on conflict(singleton) do update set
  webhook_id=excluded.webhook_id,active=true,configured_at=excluded.configured_at,
  backfilled_at=coalesce(excluded.backfilled_at,private.brevo_delivery_setup.backfilled_at);
 return true;
end $fn$;
create or replace function public.mark_brevo_delivery_setup(p_webhook_id bigint,p_backfill boolean default false)
returns boolean language sql security invoker set search_path='' as $fn$
 select private.mark_brevo_delivery_setup(p_webhook_id,p_backfill);
$fn$;

-- Only the trusted provisioning Edge worker can inspect provider IDs for a
-- bounded one-time reconciliation. Never sent to a browser, webhook caller or log.
create or replace function private.brevo_delivery_candidates(p_setup_token text)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare items jsonb;
begin
 if not private.verify_brevo_delivery_token(p_setup_token,'setup') then
  raise exception 'Invalid delivery provisioning token';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('message_id',x.provider_message_id,
   'email',x.recipient)),'[]'::jsonb) into items
 from (select provider_message_id,recipient from public.email_outbox
   where status='sent' and provider_message_id is not null
     and recipient is not null and created_at>=now()-interval '85 days'
   order by created_at desc limit 60) x;
 return items;
end $fn$;
create or replace function public.brevo_delivery_candidates(p_setup_token text)
 returns jsonb language sql security invoker set search_path='' as $fn$
 select private.brevo_delivery_candidates(p_setup_token);
$fn$;

create or replace function private.brevo_delivery_monitor()
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare enabled boolean; last_configured timestamptz;
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 select active,configured_at into enabled,last_configured
   from private.brevo_delivery_setup where singleton=true;
 return jsonb_build_object(
  'webhook_configured',coalesce(enabled,false),
  'configured_at',last_configured,
  'received_events',(select count(*) from private.brevo_delivery_events)
 );
end $fn$;
create or replace function public.brevo_delivery_monitor()
 returns jsonb language sql security invoker set search_path='' as $fn$
 select private.brevo_delivery_monitor();
$fn$;

revoke all on function
 private.verify_brevo_delivery_token(text,text),
 public.verify_brevo_delivery_token(text,text),
 private.brevo_delivery_setup_credential(text),
 public.brevo_delivery_setup_credential(text),
 private.record_brevo_delivery_event(text,text,text,timestamptz),
 public.record_brevo_delivery_event(text,text,text,timestamptz),
 private.mark_brevo_delivery_setup(bigint,boolean),
 public.mark_brevo_delivery_setup(bigint,boolean),
 private.brevo_delivery_candidates(text),
 public.brevo_delivery_candidates(text),
 private.brevo_delivery_monitor(),
 public.brevo_delivery_monitor()
 from public,anon,authenticated;
grant execute on function
 private.verify_brevo_delivery_token(text,text),
 public.verify_brevo_delivery_token(text,text),
 private.brevo_delivery_setup_credential(text),
 public.brevo_delivery_setup_credential(text),
 private.record_brevo_delivery_event(text,text,text,timestamptz),
 public.record_brevo_delivery_event(text,text,text,timestamptz),
 private.mark_brevo_delivery_setup(bigint,boolean),
 public.mark_brevo_delivery_setup(bigint,boolean),
 private.brevo_delivery_candidates(text),
 public.brevo_delivery_candidates(text)
 to service_role;
grant execute on function private.brevo_delivery_monitor(),public.brevo_delivery_monitor()
 to authenticated;
