-- Run after migration 20261117120000, inside BEGIN/ROLLBACK. No fixture survives.
do $test$
declare
  guest uuid := gen_random_uuid(); guest_token uuid := gen_random_uuid();
  other uuid := gen_random_uuid(); other_token uuid := gen_random_uuid();
  member uuid := gen_random_uuid(); member_user uuid := gen_random_uuid(); member_token uuid := gen_random_uuid();
  q_guest uuid := gen_random_uuid(); q_other uuid := gen_random_uuid(); q_draft uuid := gen_random_uuid();
  r jsonb; n integer;
begin
  insert into auth.users(id, aud, role, email, email_confirmed_at) values (member_user, 'authenticated', 'authenticated', 'member@example.invalid', now());
  insert into public.clients(id, nom, email, portal_token) values (guest, 'Guest test', 'guest@example.invalid', guest_token);
  insert into public.clients(id, nom, email, portal_token) values (other, 'Other test', 'other@example.invalid', other_token);
  insert into public.clients(id, nom, email, portal_token, user_id) values (member, 'Member test', 'member@example.invalid', member_token, member_user);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'app_metadata', jsonb_build_object('dzoft_owner', true))::text, true);
  insert into public.quotes(id, client_id, numero, total, accepted_total, accepted_at, shared, invoices)
    values (q_guest, guest, 'TEST-G', 1000, 1000, now(), true, '[{"id":"g1","num":"TEST-G-1","amt":300,"paid":true}]'),
           (q_other, other, 'TEST-O', 500, 500, now(), true, '[]'),
           (q_draft, guest, 'TEST-D', 200, null, null, true, '[]');

  -- Anonymous caller with the private link.
  perform set_config('request.jwt.claims', '{}', true);
  r := public.portal_project_tracking(guest_token, q_guest);
  if (r->>'received')::numeric <> 300 or (r->>'remaining')::numeric <> 700 then raise exception 'Guest figures wrong: %', r; end if;
  if coalesce(current_setting('dzoft.portal_client', true), '') <> '' then raise exception 'Portal marker left set'; end if;
  begin perform public.portal_project_tracking(guest_token, q_other); raise exception 'FAIL: another client''s project read';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin perform public.portal_project_tracking(guest_token, q_draft); raise exception 'FAIL: unaccepted quote read';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin perform public.portal_project_tracking(member_token, q_guest); raise exception 'FAIL: token of a client with an account accepted';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin perform public.portal_project_tracking(gen_random_uuid(), q_guest); raise exception 'FAIL: unknown link accepted';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin perform private.project_tracking(q_guest); raise exception 'FAIL: anonymous direct read';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;

  -- Language: private link.
  perform public.portal_set_language(guest_token, 'en');
  if (select lang from public.clients where id = guest) <> 'en' then raise exception 'Guest language not saved'; end if;
  if (public.portal_get(guest_token)->>'lang') <> 'en' then raise exception 'portal_get must return the language'; end if;
  begin perform public.portal_set_language(guest_token, 'de'); raise exception 'FAIL: unsupported language saved';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin perform public.portal_set_language(member_token, 'en'); raise exception 'FAIL: link of a client with an account changed language';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;

  -- Language: signed-in client, own record only.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_user, 'role', 'authenticated')::text, true);
  perform public.my_set_language('en');
  if (select lang from public.clients where id = member) <> 'en' then raise exception 'Member language not saved'; end if;
  if (select lang from public.clients where id = other) <> 'fr' then raise exception 'Another client changed'; end if;
  if (public.my_space()->>'lang') <> 'en' then raise exception 'my_space must return the language'; end if;
  -- Signed-in clients still read only their own projects.
  begin perform public.project_tracking(q_guest); raise exception 'FAIL: member read a guest project';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
end $test$;
