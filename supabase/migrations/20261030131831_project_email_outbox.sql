-- DZOFT project activity and transactional email outbox.
-- Events are inserted in the same transaction as the action that created them.
-- The outbox contains references only; message bodies and documents stay in
-- their existing protected tables/storage until the worker sends an email.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.notification_settings (
  singleton boolean primary key default true check (singleton),
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_email text,
  updated_at timestamptz not null default now()
);
revoke all on private.notification_settings from public, anon, authenticated, service_role;

-- Keep internal invoice-email controls and attachment metadata out of the
-- client-facing JSON returned by the private portal RPCs.
create or replace function public.portal_data(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare c public.clients; has_accepted boolean;
begin
  select * into c from public.clients where id = p_client;
  if not found then return null; end if;
  select exists(select 1 from public.quotes where client_id = c.id and shared and deleted_at is null and accepted_at is not null) into has_accepted;
  return jsonb_build_object(
    'client', jsonb_build_object('nom', c.nom, 'entreprise', c.entreprise, 'phone', case when c.contact ~ '^[+0-9 .()-]{8,}$' then c.contact else '' end),
    'payment', case when has_accepted then (select payment from public.settings where id = 1) else null end,
    'quotes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'numero', q.numero, 'status', q.status, 'sent_at', q.sent_at, 'created_at', q.created_at,
        'accepted_at', q.accepted_at, 'accepted_name', q.accepted_name, 'accepted_terms', q.accepted_terms,
        'accepted_early_start', q.accepted_early_start, 'accepted_method', q.accepted_method, 'accepted_target', q.accepted_target,
        'data', coalesce(q.accepted_data, q.data) - 'lead', 'total', coalesce(q.accepted_total, q.total),
        'note', q.client_note, 'steps', q.steps, 'docs', q.docs, 'env', q.env,
        'invoices', coalesce((select jsonb_agg(i.value - array['id','emailAt','attachPdf','fileSize'] order by i.ordinality)
          from jsonb_array_elements(coalesce(q.invoices, '[]'::jsonb)) with ordinality as i(value, ordinality)), '[]'::jsonb),
        'ext_link', q.ext_link,
        'care', case when q.accepted_at is not null then q.care end,
        'review', (select jsonb_build_object('rating', r.rating, 'body', r.body, 'name', r.name, 'activity', r.activity,
                     'consent', r.consent, 'published', r.published, 'at', r.updated_at, 'reply', r.reply)
                   from public.reviews r where r.quote_id = q.id)) order by q.created_at desc)
      from public.quotes q where q.client_id = c.id and q.shared and q.deleted_at is null), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'at', l.created_at, 'projet', l.projet, 'budget', l.budget, 'message', l.message, 'status', l.status) order by l.created_at desc)
      from public.leads l where l.client_id = c.id and l.status <> 'archivée' and l.deleted_at is null), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'at', m.created_at, 'author', m.author, 'body', m.body, 'quote_id', m.quote_id) order by m.created_at)
      from public.messages m where m.client_id = c.id), '[]'::jsonb));
end
$function$;
revoke all on function public.portal_data(uuid) from public, anon, authenticated, service_role;

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) between 1 and 512),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in (
    'quote_published', 'quote_accepted', 'client_message', 'owner_message',
    'step_validation_requested', 'step_progress', 'client_step_validated',
    'invoice_shared', 'client_file_uploaded', 'review_submitted'
  )),
  summary text not null check (char_length(summary) between 1 and 300),
  client_id uuid references public.clients(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  invoice_id text check (invoice_id is null or char_length(invoice_id) <= 100),
  file_name text check (file_name is null or char_length(file_name) <= 180)
);
create index project_events_quote_created_idx on public.project_events (quote_id, created_at desc);
create index project_events_client_created_idx on public.project_events (client_id, created_at desc);
alter table public.project_events enable row level security;
revoke all on public.project_events from anon, authenticated;
grant select on public.project_events to authenticated;
create policy "owner reads project events" on public.project_events for select to authenticated
  using ((select public.is_owner()));

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.project_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  client_id uuid references public.clients(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  recipient_role text not null check (recipient_role in ('owner', 'client')),
  recipient text,
  invoice_id text,
  attach_invoice_pdf boolean not null default false,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  unique (event_id, recipient_role)
);
create index email_outbox_queue_idx on public.email_outbox (status, next_attempt_at, created_at);
create index email_outbox_quote_idx on public.email_outbox (quote_id, created_at desc);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select on public.email_outbox to authenticated;
create policy "owner reads email delivery log" on public.email_outbox for select to authenticated
  using ((select public.is_owner()));

create or replace function private.queue_project_event(
  p_event_key text,
  p_event_type text,
  p_summary text,
  p_client_id uuid,
  p_quote_id uuid,
  p_message_id uuid default null,
  p_invoice_id text default null,
  p_file_name text default null,
  p_notify_client boolean default false,
  p_notify_owner boolean default false,
  p_attach_invoice_pdf boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_owner_email text;
  v_client_email text;
begin
  insert into public.project_events (
    event_key, event_type, summary, client_id, quote_id, message_id, invoice_id, file_name
  ) values (
    left(p_event_key, 512), p_event_type, left(p_summary, 300), p_client_id, p_quote_id,
    p_message_id, p_invoice_id, left(p_file_name, 180)
  ) on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from public.project_events where event_key = left(p_event_key, 512);
    return v_event_id;
  end if;

  if p_notify_client then
    select nullif(btrim(email), '')
      into v_client_email
      from public.clients where id = p_client_id;
    if coalesce(v_client_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      select nullif(btrim(contact), '') into v_client_email from public.clients where id = p_client_id;
    end if;
    if coalesce(v_client_email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      insert into public.email_outbox (
        event_id, client_id, quote_id, recipient_role, recipient, invoice_id, attach_invoice_pdf
      ) values (
        v_event_id, p_client_id, p_quote_id, 'client', v_client_email, p_invoice_id, p_attach_invoice_pdf
      ) on conflict (event_id, recipient_role) do nothing;
    else
      insert into public.email_outbox (
        event_id, client_id, quote_id, recipient_role, invoice_id, attach_invoice_pdf, status, next_attempt_at, last_error
      ) values (
        v_event_id, p_client_id, p_quote_id, 'client', p_invoice_id, p_attach_invoice_pdf,
        'failed', now(), 'Client email address is missing or invalid.'
      ) on conflict (event_id, recipient_role) do nothing;
    end if;
  end if;

  if p_notify_owner then
    select owner_email into v_owner_email from private.notification_settings where singleton;
    if coalesce(v_owner_email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      insert into public.email_outbox (
        event_id, client_id, quote_id, recipient_role, recipient, invoice_id, attach_invoice_pdf
      ) values (
        v_event_id, p_client_id, p_quote_id, 'owner', v_owner_email, p_invoice_id, p_attach_invoice_pdf
      ) on conflict (event_id, recipient_role) do nothing;
    else
      insert into public.email_outbox (
        event_id, client_id, quote_id, recipient_role, invoice_id, attach_invoice_pdf, status, next_attempt_at, last_error
      ) values (
        v_event_id, p_client_id, p_quote_id, 'owner', p_invoice_id, p_attach_invoice_pdf,
        'failed', now(), 'Owner notification address has not been registered.'
      ) on conflict (event_id, recipient_role) do nothing;
    end if;
  end if;

  return v_event_id;
end
$function$;
revoke all on function private.queue_project_event(text, text, text, uuid, uuid, uuid, text, text, boolean, boolean, boolean) from public, anon, authenticated, service_role;

create or replace function public.register_notification_owner()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_email text;
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if coalesce(v_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'owner email address unavailable';
  end if;
  insert into private.notification_settings (singleton, owner_user_id, owner_email, updated_at)
    values (true, auth.uid(), v_email, now())
    on conflict (singleton) do update set owner_user_id = excluded.owner_user_id,
      owner_email = excluded.owner_email, updated_at = excluded.updated_at;
  update public.email_outbox set recipient = v_email, status = 'queued', attempts = 0,
      next_attempt_at = now(), lease_until = null, last_error = null
    where recipient_role = 'owner' and status = 'failed'
      and last_error = 'Owner notification address has not been registered.';
  return jsonb_build_object('ok', true);
end
$function$;
revoke all on function public.register_notification_owner() from public, anon, authenticated, service_role;
grant execute on function public.register_notification_owner() to authenticated;

create or replace function public.admin_notify_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare q public.quotes; v_event_id uuid; v_key text;
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;
  select * into q from public.quotes where id = p_quote_id and shared and deleted_at is null;
  if not found then raise exception 'quote is not visible to the client'; end if;
  if q.accepted_at is not null then raise exception 'quote has already been accepted'; end if;
  if exists (
    select 1 from public.email_outbox o join public.project_events e on e.id = o.event_id
    where o.quote_id = q.id and e.event_type = 'quote_published'
      and o.status in ('queued', 'processing', 'sent') and o.created_at > now() - interval '30 minutes'
  ) then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;
  v_key := 'quote:' || q.id::text || ':manual:' || gen_random_uuid()::text;
  v_event_id := private.queue_project_event(v_key, 'quote_published', 'E-mail du devis renvoyé · ' || q.numero,
    q.client_id, q.id, null, null, null, true, true, false);
  return jsonb_build_object('ok', true, 'event_id', v_event_id);
end
$function$;
revoke all on function public.admin_notify_quote(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_notify_quote(uuid) to authenticated;

create or replace function public.log_client_upload(p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_client_id uuid; v_uid uuid := auth.uid(); v_name text; v_quote_id uuid; v_notify_owner boolean;
begin
  if v_uid is null or public.is_owner() then raise exception 'not authorized'; end if;
  v_client_id := public.my_client();
  if p_path is null or char_length(p_path) > 500
     or p_path !~ ('^u/' || v_uid::text || '/[^/].*$')
     or p_path ~* '/factures/' then raise exception 'invalid client file path'; end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'client-files' and o.name = p_path
  ) then raise exception 'uploaded file not found'; end if;
  if (select count(*) from public.project_events where client_id = v_client_id
        and event_type = 'client_file_uploaded' and created_at > now() - interval '1 day') >= 100 then
    raise exception 'too many file notifications';
  end if;
  v_name := regexp_replace(p_path, '^.*/', '');
  select id into v_quote_id from public.quotes where client_id = v_client_id and shared and deleted_at is null
    order by created_at desc limit 1;
  v_notify_owner := not exists (
    select 1 from public.project_events e where e.client_id = v_client_id
      and e.event_type = 'client_file_uploaded' and e.created_at > now() - interval '10 minutes'
  );
  perform private.queue_project_event('upload:' || p_path, 'client_file_uploaded', 'Fichier déposé par le client · ' || v_name,
    v_client_id, v_quote_id, null, null, v_name, false, v_notify_owner, false);
  return jsonb_build_object('ok', true);
end
$function$;
revoke all on function public.log_client_upload(text) from public, anon, authenticated, service_role;
grant execute on function public.log_client_upload(text) to authenticated;

create or replace function private.capture_message_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_type text; v_summary text; v_to_client boolean; v_to_owner boolean; v_quote_id uuid;
begin
  v_type := case when new.author = 'client' then 'client_message' else 'owner_message' end;
  v_summary := case when new.author = 'client' then 'Nouveau message du client' else 'Réponse envoyée au client' end;
  v_to_client := new.author = 'moi';
  v_to_owner := new.author = 'client' and not exists (
    select 1 from public.project_events e where e.client_id = new.client_id
      and e.event_type = 'client_message' and e.created_at > now() - interval '10 minutes'
  );
  v_quote_id := new.quote_id;
  perform private.queue_project_event('message:' || new.id::text, v_type, v_summary,
    new.client_id, v_quote_id, new.id, null, null, v_to_client, v_to_owner, false);
  return new;
end
$function$;
revoke all on function private.capture_message_event() from public, anon, authenticated, service_role;
create trigger messages_notify_project_event after insert on public.messages
  for each row execute function private.capture_message_event();

create or replace function private.capture_quote_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s jsonb;
  old_s jsonb;
  inv jsonb;
  old_inv jsonb;
  v_step_key text;
  v_step_title text;
  v_stamp text;
  v_file_name text;
begin
  if new.shared and not old.shared and new.client_id is not null and new.deleted_at is null then
    perform private.queue_project_event('quote:' || new.id::text || ':published', 'quote_published',
      'Devis rendu visible · ' || new.numero, new.client_id, new.id, null, null, null, true, true, false);
  end if;
  if old.accepted_at is null and new.accepted_at is not null and new.client_id is not null then
    perform private.queue_project_event('quote:' || new.id::text || ':accepted:' || new.accepted_at::text,
      'quote_accepted', 'Devis accepté · ' || new.numero, new.client_id, new.id, null, null, null, true, true, false);
  end if;

  for s in select value from jsonb_array_elements(coalesce(new.steps, '[]'::jsonb)) loop
    select value into old_s from jsonb_array_elements(coalesce(old.steps, '[]'::jsonb))
      where value ->> 'k' = s ->> 'k' limit 1;
    v_step_key := left(coalesce(s ->> 'k', 'step'), 80);
    v_step_title := left(coalesce(nullif(btrim(s ->> 't'), ''), v_step_key), 120);

    if nullif(s ->> 'emailValidateAt', '') is not null
       and s ->> 'emailValidateAt' is distinct from old_s ->> 'emailValidateAt' then
      v_stamp := s ->> 'emailValidateAt';
      perform private.queue_project_event('step:' || new.id::text || ':' || v_step_key || ':validate:' || v_stamp,
        'step_validation_requested', 'Validation demandée au client · ' || v_step_title,
        new.client_id, new.id, null, null, null, true, true, false);
    end if;

    if nullif(s ->> 'emailProgressAt', '') is not null
       and s ->> 'emailProgressAt' is distinct from old_s ->> 'emailProgressAt' then
      v_stamp := s ->> 'emailProgressAt';
      perform private.queue_project_event('step:' || new.id::text || ':' || v_step_key || ':progress:' || v_stamp,
        'step_progress', 'Étape terminée · ' || v_step_title,
        new.client_id, new.id, null, null, null, true, true, false);
    end if;

    if nullif(s ->> 'vby', '') is not null and s ->> 'vby' is distinct from old_s ->> 'vby' then
      v_stamp := coalesce(nullif(s ->> 'vat', ''), now()::text);
      perform private.queue_project_event('step:' || new.id::text || ':' || v_step_key || ':validated:' || v_stamp,
        'client_step_validated', 'Étape validée par le client · ' || v_step_title,
        new.client_id, new.id, null, null, null, true, true, false);
    end if;
  end loop;

  for inv in select value from jsonb_array_elements(coalesce(new.invoices, '[]'::jsonb)) loop
    if nullif(inv ->> 'id', '') is null then continue; end if;
    select value into old_inv from jsonb_array_elements(coalesce(old.invoices, '[]'::jsonb))
      where value ->> 'id' = inv ->> 'id' limit 1;
    if nullif(inv ->> 'emailAt', '') is not null
       and inv ->> 'emailAt' is distinct from old_inv ->> 'emailAt' then
      v_stamp := inv ->> 'emailAt';
      v_file_name := case when coalesce((inv ->> 'attachPdf')::boolean, false)
          and nullif(inv ->> 'file', '') is not null then coalesce(nullif(inv ->> 'fileName', ''), 'facture.pdf') else null end;
      perform private.queue_project_event('invoice:' || new.id::text || ':' || (inv ->> 'id') || ':' || v_stamp,
        'invoice_shared', 'Facture envoyée · ' || left(coalesce(nullif(inv ->> 'n', ''), inv ->> 'num', 'facture'), 100),
        new.client_id, new.id, null, inv ->> 'id', v_file_name, true, true,
        coalesce((inv ->> 'attachPdf')::boolean, false) and nullif(inv ->> 'file', '') is not null);
    end if;
  end loop;
  return new;
end
$function$;
revoke all on function private.capture_quote_events() from public, anon, authenticated, service_role;
create trigger quotes_notify_project_events after update of shared, accepted_at, steps, invoices on public.quotes
  for each row execute function private.capture_quote_events();

create or replace function private.capture_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.queue_project_event('review:' || new.quote_id::text || ':' || new.updated_at::text,
    'review_submitted', 'Avis reçu · ' || new.rating || '/5',
    new.client_id, new.quote_id, null, null, null, false, true, false);
  return new;
end
$function$;
revoke all on function private.capture_review_event() from public, anon, authenticated, service_role;
create trigger reviews_notify_project_event after insert on public.reviews
  for each row execute function private.capture_review_event();

create or replace function private.requeue_client_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_email text;
begin
  if new.email is not distinct from old.email and new.contact is not distinct from old.contact then return new; end if;
  v_email := coalesce(nullif(btrim(new.email), ''), nullif(btrim(new.contact), ''));
  if coalesce(v_email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    update public.email_outbox set recipient = v_email, status = 'queued', attempts = 0,
        next_attempt_at = now(), lease_until = null, last_error = null
      where client_id = new.id and recipient_role = 'client' and status = 'failed'
        and last_error = 'Client email address is missing or invalid.';
  end if;
  return new;
end
$function$;
revoke all on function private.requeue_client_notifications() from public, anon, authenticated, service_role;
create trigger clients_requeue_email_notifications after update of email, contact on public.clients
  for each row execute function private.requeue_client_notifications();

create or replace function public.claim_email_outbox(p_limit integer default 10)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $function$
  with picked as (
    select o.id from public.email_outbox o
    where (o.status = 'queued' and o.next_attempt_at <= now())
       or (o.status = 'processing' and o.lease_until < now())
    order by o.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 10), 1), 20)
  )
  update public.email_outbox o
    set status = 'processing', attempts = least(o.attempts + 1, 6), lease_until = now() + interval '5 minutes'
    from picked where o.id = picked.id
  returning o.*;
$function$;
revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_email_outbox(integer) to service_role;

create or replace function public.finish_email_outbox(
  p_id uuid, p_success boolean, p_provider_message_id text default null, p_error text default null,
  p_retryable boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_attempts integer; v_status text; v_delay interval;
begin
  select attempts into v_attempts from public.email_outbox where id = p_id for update;
  if not found then raise exception 'email job not found'; end if;
  if p_success then
    v_status := 'sent'; v_delay := null;
  elsif not coalesce(p_retryable, true) or v_attempts >= 6 then
    v_status := 'failed'; v_delay := null;
  else
    v_status := 'queued';
    v_delay := case v_attempts
      when 1 then interval '1 minute'
      when 2 then interval '5 minutes'
      when 3 then interval '30 minutes'
      when 4 then interval '2 hours'
      else interval '12 hours'
    end;
  end if;
  update public.email_outbox set status = v_status,
    sent_at = case when p_success then now() else sent_at end,
    provider_message_id = case when p_success then left(p_provider_message_id, 250) else provider_message_id end,
    next_attempt_at = case when v_status = 'queued' then now() + v_delay else next_attempt_at end,
    lease_until = null,
    last_error = case when p_success then null else left(coalesce(p_error, 'Email delivery failed.'), 500) end
  where id = p_id;
  return jsonb_build_object('ok', true, 'status', v_status);
end
$function$;
revoke all on function public.finish_email_outbox(uuid, boolean, text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.finish_email_outbox(uuid, boolean, text, text, boolean) to service_role;

create or replace function public.retry_email_outbox(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare o public.email_outbox; v_email text;
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;
  select * into o from public.email_outbox where id = p_id for update;
  if not found or o.status <> 'failed' then raise exception 'email is not failed'; end if;
  if o.recipient_role = 'owner' then
    select owner_email into v_email from private.notification_settings where singleton;
  elsif o.client_id is not null then
    select coalesce(nullif(btrim(email), ''), nullif(btrim(contact), '')) into v_email
      from public.clients where id = o.client_id;
  end if;
  if coalesce(v_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid recipient email is required before retrying';
  end if;
  update public.email_outbox set recipient = v_email, status = 'queued', attempts = 0,
    next_attempt_at = now(), lease_until = null, last_error = null where id = p_id;
  return jsonb_build_object('ok', true);
end
$function$;
revoke all on function public.retry_email_outbox(uuid) from public, anon, authenticated, service_role;
grant execute on function public.retry_email_outbox(uuid) to authenticated;

create or replace function public.verify_email_outbox_cron(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select coalesce((select decrypted_secret = p_secret from vault.decrypted_secrets
    where name = 'dzoft_email_outbox_cron'), false)
$function$;
revoke all on function public.verify_email_outbox_cron(text) from public, anon, authenticated, service_role;
grant execute on function public.verify_email_outbox_cron(text) to service_role;

-- The secret is generated directly inside Vault and is never committed or
-- returned by this migration. pg_cron wakes the worker once per minute.
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'dzoft_email_outbox_cron', 'Authentication for the DZOFT email worker cron job');
select vault.create_secret('https://rzghbvmszbjlqkdjzpxc.supabase.co', 'dzoft_email_project_url', 'DZOFT Supabase project URL');
select vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z2hidm1zemJqbHFrZGp6cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDQ0MTEsImV4cCI6MjEwODU4MDQxMX0.LtN4aeyRY8Xf7s6vmoLU1QfRl_aCXOdtyAGSYdgHkZM', 'dzoft_email_publishable_key', 'Public project key used by pg_net to call the email worker');

select cron.schedule(
  'dzoft-email-outbox',
  '* * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'dzoft_email_project_url') || '/functions/v1/process-notification-outbox',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'dzoft_email_publishable_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'dzoft_email_publishable_key'),
        'x-dzoft-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dzoft_email_outbox_cron')
      ),
      body := jsonb_build_object('source', 'scheduled-worker')
    );
  $cron$
);

select cron.schedule(
  'dzoft-prune-email-history',
  '35 3 * * *',
  $prune$
    delete from public.project_events where created_at < now() - interval '24 months';
    delete from public.notifications where created_at < now() - interval '24 months';
  $prune$
);

commit;

