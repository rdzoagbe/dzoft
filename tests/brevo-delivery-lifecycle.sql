-- Safe transaction-only test. No Brevo API calls, notifications or real payments.
begin;
do $tests$
declare
  event_uuid uuid;
  job_uuid uuid;
  one jsonb;
  current_status text;
  original_job_status text;
  n int;
  delivered_time timestamptz:=date_trunc('second',now()-interval '6 minutes');
  opened_time timestamptz:=date_trunc('second',now()-interval '4 minutes');
  bounced_time timestamptz:=date_trunc('second',now()-interval '2 minutes');
  hook_token text;
  setup_token text;
begin
  select decrypted_secret into hook_token from vault.decrypted_secrets where name='dzoft_brevo_webhook_token';
  select decrypted_secret into setup_token from vault.decrypted_secrets where name='dzoft_brevo_setup_token';
  if length(hook_token)<>64 or length(setup_token)<>64
    or hook_token=setup_token then raise exception 'Distinct strong Vault tokens missing'; end if;
  if not public.verify_brevo_delivery_token(hook_token,'webhook')
   or not public.verify_brevo_delivery_token(setup_token,'setup') then
    raise exception 'Delivery token verification failed'; end if;
  if public.verify_brevo_delivery_token('not-a-real-token','webhook')
    or public.verify_brevo_delivery_token(setup_token,'webhook') then
    raise exception 'Unauthorized token accepted'; end if;
  if public.brevo_delivery_setup_credential(setup_token)<>hook_token then
    raise exception 'Secure provisioning credential mismatch'; end if;

  insert into public.project_events(event_key,event_type,summary)
    values('synthetic-brevo-fixture:'||gen_random_uuid()::text,'payment_received','Synthetic email, rolled back')
    returning id into event_uuid;
  insert into public.email_outbox(event_id,recipient_role,recipient,status,provider_message_id,sent_at)
    values(event_uuid,'client','synthetic@example.invalid','sent','<dzoft-unique-synthetic-20261114@example.invalid>',now())
    returning id into job_uuid;
  select delivery_status into current_status from public.email_outbox where id=job_uuid;
  if current_status<>'unconfirmed' then raise exception 'Initial status cannot claim delivered'; end if;

  one:=public.record_brevo_delivery_event(
    '<dzoft-unique-synthetic-20261114@example.invalid>','other@example.invalid','delivered',delivered_time);
  if one->>'matched'<>'false' then raise exception 'Recipient substitution accepted'; end if;
  one:=public.record_brevo_delivery_event(
    '<unknown-dzoft-msg@example.invalid>','synthetic@example.invalid','delivered',delivered_time);
  if one->>'matched'<>'false' then raise exception 'Unknown provider message accepted'; end if;

  one:=public.record_brevo_delivery_event(
    '<dzoft-unique-synthetic-20261114@example.invalid>','synthetic@example.invalid','delivered',delivered_time);
  if one->>'matched'<>'true' or one->>'applied'<>'true' then raise exception 'Verified delivered event not applied';end if;
  one:=public.record_brevo_delivery_event(
    '<dzoft-unique-synthetic-20261114@example.invalid>','synthetic@example.invalid','opened',opened_time);
  if one->>'applied'<>'true' then raise exception 'Open tracking not recorded';end if;
  one:=public.record_brevo_delivery_event(
    '<dzoft-unique-synthetic-20261114@example.invalid>','synthetic@example.invalid','delivered',delivered_time);
  if one->>'applied'<>'false' then raise exception 'Old event regressed status';end if;
  select delivery_status into current_status from public.email_outbox where id=job_uuid;
  if current_status<>'opened' then raise exception 'Out of order callback regressed opened event';end if;

  one:=public.record_brevo_delivery_event(
    '<dzoft-unique-synthetic-20261114@example.invalid>','synthetic@example.invalid','hard_bounce',bounced_time);
  select delivery_status,status into current_status,original_job_status from public.email_outbox where id=job_uuid;
  if current_status<>'hard_bounce' or original_job_status<>'sent' then
    raise exception 'Delivery warning or immutable sending status incorrect';end if;
  select count(*) into n from private.brevo_delivery_events where outbox_id=job_uuid;
  if n<>3 then raise exception 'Duplicate callback was not deduplicated: %',n; end if;

  one:=public.record_brevo_delivery_event(
    '<dzoft-unique-synthetic-20261114@example.invalid>','synthetic@example.invalid','request',now());
  if one->>'ignored'<>'true' then raise exception 'Brevo acceptance was incorrectly delivery';end if;
  if (select count(*) from private.brevo_delivery_events where outbox_id=job_uuid)<>3 then
    raise exception 'Ignored event generated an audit record';end if;
  if has_function_privilege('anon','public.record_brevo_delivery_event(text,text,text,timestamptz)','execute')
     or has_function_privilege('authenticated','public.record_brevo_delivery_event(text,text,text,timestamptz)','execute')
     or not has_function_privilege('service_role','public.record_brevo_delivery_event(text,text,text,timestamptz)','execute')
  then raise exception 'Delivery RPC permissions incorrect';end if;
end
$tests$;
rollback;
