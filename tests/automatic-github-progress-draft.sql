-- Run only in one transaction: no live data, published updates or emails persist.
begin;
do $test$
declare
 qid uuid:='c8a50cee-3856-4539-98a3-f5df201dbff0';
 old_manual jsonb;
 old_total numeric;
 manual_after jsonb;
 total_after numeric;
 first_draft jsonb;
 repeated_draft jsonb;
 current_published integer;
begin
 perform set_config('request.jwt.claims',jsonb_build_object(
 'sub',gen_random_uuid(),'role','authenticated',
 'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
 select progress_draft,accepted_total into old_manual,old_total from public.quotes where id=qid;
 select count(*) into current_published from public.project_updates where quote_id=qid;
 first_draft:=public.owner_refresh_github_progress_draft(qid);
 repeated_draft:=public.owner_refresh_github_progress_draft(qid);
 if first_draft->>'configured'<>'true' then raise exception 'GitHub source not configured';end if;
 if first_draft->>'source_hash' is distinct from repeated_draft->>'source_hash'
 or first_draft->>'prepared' is distinct from repeated_draft->>'prepared'
 then raise exception 'Repeat refresh produced a different draft without new source data';end if;
 if not exists (select 1 from jsonb_array_elements(first_draft->'updates') x where x->>'status'='working')
 then raise exception 'No safe progress draft populated';end if;
 if exists (select 1 from jsonb_array_elements(first_draft->'updates') x where x->>'status'<>'working')
 then raise exception 'Detected GitHub activity was marked built or tested';end if;
 if jsonb_array_length(first_draft->'updates')>6 then raise exception 'Too many client draft entries';end if;
 select progress_draft,accepted_total into manual_after,total_after from public.quotes where id=qid;
 if manual_after is distinct from old_manual or total_after is distinct from old_total
 then raise exception 'Manual draft or accepted price was modified';end if;
 if (select count(*) from public.project_updates where quote_id=qid)<>current_published
 then raise exception 'Automatic import published to the client';end if;
end $test$;
rollback;
