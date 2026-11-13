-- This integration suite runs only inside BEGIN/ROLLBACK; never emails a client.
begin;
do $test$
declare
  quote_key uuid := 'c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid;
  owner_id uuid := gen_random_uuid();
  fake_id uuid := gen_random_uuid();
  initial_rows int;
  initial_email_rows int;
  initial_updates int;
  saved jsonb;
  label text;
begin
  select count(*) into initial_rows from public.project_work_items where quote_id=quote_key;
  select count(*) into initial_email_rows from public.email_outbox;
  select count(*) into initial_updates from public.project_updates;
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',owner_id,'role','authenticated',
    'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);

  saved := public.sync_project_github_groups(quote_key,jsonb_build_array(
    jsonb_build_object('date',current_date::text,'group','qr'),
    jsonb_build_object('date',current_date::text,'group','securite')));
  if (saved->>'added')::int<>2 or saved->>'client_notified'<>'false' then
    raise exception 'Initial sync did not insert exactly two private tasks';
  end if;
  if not exists (
    select 1 from public.project_work_items
    where quote_id=quote_key and status='review'
     and source_date=current_date and source_group='qr'
     and title='GitHub · QR codes et accès aux lieux (à vérifier)'
     and published_at is null
  ) then
    raise exception 'GitHub task had wrong privacy, status or title';
  end if;
  saved := public.sync_project_github_groups(quote_key,jsonb_build_array(
    jsonb_build_object('date',current_date::text,'group','qr'),
    jsonb_build_object('date',current_date::text,'group','securite')));
  if (saved->>'added')::int<>0 then
    raise exception 'Repeated sync caused duplicate work items';
  end if;
  if (select count(*) from public.project_work_items where quote_id=quote_key)<>initial_rows+2 then
    raise exception 'Import modified existing tasks or inserted duplicates';
  end if;

  -- Reject extra keys, unapproved category, wrong project, and stale dates.
  begin
    perform public.sync_project_github_groups(quote_key,jsonb_build_array(
      jsonb_build_object('date',current_date::text,'group','qr',
       'author','Claude','session','private-session')));
    raise exception 'UNSAFE: AI attribution accepted';
  exception when others then if sqlerrm like 'UNSAFE:%' then raise; end if;
  end;
  begin
    perform public.sync_project_github_groups(quote_key,jsonb_build_array(
      jsonb_build_object('date',current_date::text,'group','Claude')));
    raise exception 'UNSAFE: AI category accepted';
  exception when others then if sqlerrm like 'UNSAFE:%' then raise; end if;
  end;
  begin
    perform public.sync_project_github_groups(gen_random_uuid(),jsonb_build_array(
      jsonb_build_object('date',current_date::text,'group','qr')));
    raise exception 'UNSAFE: wrong project accepted';
  exception when others then if sqlerrm like 'UNSAFE:%' then raise; end if;
  end;
  begin
    perform public.sync_project_github_groups(quote_key,jsonb_build_array(
      jsonb_build_object('date',(current_date-interval '25 days')::date::text,'group','qr')));
    raise exception 'UNSAFE: stale date accepted';
  exception when others then if sqlerrm like 'UNSAFE:%' then raise; end if;
  end;

  if (select count(*) from public.email_outbox)<>initial_email_rows or
     (select count(*) from public.project_updates)<>initial_updates then
    raise exception 'Silent automatic sync sent or published client updates';
  end if;
  if (select count(*) from public.project_work_items where quote_id=quote_key)<>initial_rows+2 then
    raise exception 'Rejected request had partial effects';
  end if;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',fake_id,'role','authenticated')::text,true);
  begin
    perform public.sync_project_github_groups(quote_key,jsonb_build_array(
      jsonb_build_object('date',current_date::text,'group','profils')));
    raise exception 'UNSAFE: non-owner wrote private tasks';
  exception when others then if sqlerrm like 'UNSAFE:%' then raise; end if;
  end;
end $test$;
rollback;
