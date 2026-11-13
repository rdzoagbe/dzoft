-- Rollback-only verification: no real client notifications or data writes persist.
begin;
do $test$
declare
  q uuid := 'c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid;
  before_tasks int;before_outbox int;before_updates int;
  result jsonb;
  token text;
begin
  select count(*) into before_tasks from public.project_work_items where quote_id=q;
  select count(*) into before_outbox from public.email_outbox;
  select count(*) into before_updates from public.project_updates;

  select decrypted_secret into token from vault.decrypted_secrets where name='dzoft_rodney_sync_token';
  if token is null or length(token)<>64 then raise exception 'Cron token missing'; end if;
  if not private.verify_rodney_sync_token(token) then
    raise exception 'Vault token verification failed';
  end if;
  if private.verify_rodney_sync_token('wrong') then
    raise exception 'Invalid cron token accepted';
  end if;

  result:=private.background_import_rodney_groups(jsonb_build_array(
    jsonb_build_object('date',current_date::text,'group','qr'),
    jsonb_build_object('date',current_date::text,'group','securite')
  ));
  if (result->>'added')::int<>2 or result->>'client_notified'<>'false' then
    raise exception 'Background import failed or attempted a client notification';
  end if;
  result:=private.background_import_rodney_groups(jsonb_build_array(
    jsonb_build_object('date',current_date::text,'group','qr'),
    jsonb_build_object('date',current_date::text,'group','securite')
  ));
  if (result->>'added')::int<>0 then raise exception 'Duplicate background groups'; end if;
  if (select count(*) from public.project_work_items where quote_id=q)<>before_tasks+2 then
    raise exception 'Private task count wrong';
  end if;

  begin
    perform private.background_import_rodney_groups(jsonb_build_array(
      jsonb_build_object('date',current_date::text,'group','qr',
        'author','AI assistant','session','private-link')));
    raise exception 'UNSAFE: raw author/session accepted';
  exception when others then if sqlerrm like 'UNSAFE:%' then raise; end if;
  end;
  begin
    perform private.background_import_rodney_groups(jsonb_build_array(
      jsonb_build_object('date',current_date::text,'group','openai_prompt')));
    raise exception 'UNSAFE: unapproved category accepted';
  exception when others then if sqlerrm like 'UNSAFE:%' then raise; end if;
  end;
  if (select count(*) from public.project_updates)<>before_updates or
     (select count(*) from public.email_outbox)<>before_outbox then
    raise exception 'Automatic sync wrote client updates or emails';
  end if;
end
$test$;
rollback;
