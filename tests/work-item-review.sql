-- Rollback-only integration suite. Absolutely no actual customer updates/emails persist.
begin;
do $test$
<<fixture>>
declare
 owner_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 client_id uuid:=gen_random_uuid(); quote_id uuid:=gen_random_uuid();
 task_id uuid; second_id uuid; batch_id uuid:=gen_random_uuid();
 ret jsonb; journal_before jsonb:='[{"d":"2026-11-13","k":"fait","t":"Historic note remains private"}]'::jsonb;
begin
 insert into public.clients(id,nom,email)
 values(client_id,'Synthetic review task client','review-task@example.invalid');
 perform set_config('request.jwt.claims',jsonb_build_object(
  'sub',owner_id,'role','authenticated',
  'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
 insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,shared,invoices,journal)
 values(quote_id,client_id,'ROLLBACK-TASK-ONLY',100,100,now(),true,'[]',journal_before);

 ret:=public.list_project_work_items(quote_id);
 if jsonb_array_length(ret)<>0 then raise exception 'Fixture tasks not empty'; end if;
 ret:=public.save_project_work_item(
  quote_id,null,'Fix mobile access errors','todo','safety',null,null);
 task_id:=(ret->>'id')::uuid;
 if ret->>'status'<>'todo' then raise exception 'Task status invalid'; end if;
 begin
  perform public.publish_project_work_item(quote_id,task_id,batch_id,
   'safety','Access errors corrected',false);
  raise exception 'FAIL: unfinished task published';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;

 ret:=public.save_project_work_item(
  quote_id,task_id,'Fix mobile access errors','done','safety',null,null);
 if ret->>'status'<>'done' then raise exception 'Task update did not persist'; end if;
 ret:=public.publish_project_work_item(
  quote_id,task_id,batch_id,'safety','Mobile access errors corrected and verified',false);
 if ret->>'published'<>'true' or ret->>'email_queued'<>'true' then
  raise exception 'Publication did not succeed'; end if;
 if not exists(select 1 from public.project_updates where quote_id=fixture.quote_id
    and batch_id=batch_id and summary='Mobile access errors corrected and verified'
    and status='built') then
  raise exception 'Client-safe progress update missing'; end if;
 if (select count(*) from public.email_outbox where quote_id=fixture.quote_id and recipient_role='client')<>1 then
  raise exception 'Must queue exactly one optional client notification'; end if;
 ret:=public.publish_project_work_item(
  quote_id,task_id,batch_id,'safety','Mobile access errors corrected and verified',false);
 if ret->>'already_published'<>'true' then raise exception 'Retry not idempotent'; end if;
 if (select count(*) from public.email_outbox where quote_id=fixture.quote_id and recipient_role='client')<>1 then
  raise exception 'Duplicate email on retry'; end if;
 if (select journal from public.quotes where id=quote_id) is distinct from journal_before then
  raise exception 'Manual project journal changed'; end if;
 begin
  perform public.save_project_work_item(
   quote_id,task_id,'Overwritten after release','working','other',null,null);
  raise exception 'FAIL: released task became editable';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;

 -- GitHub categories are a fixed allowlist and must be attached only to Rodney's quote.
 begin
  perform public.save_project_work_item(
   quote_id,null,'GitHub copied raw commit text','todo','other',
   current_date,'administration');
  raise exception 'FAIL: arbitrary project accepted GitHub provenance';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;
 -- Explicitly authorized project's source import contains only generic category/date.
 ret:=public.save_project_work_item(
 'c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid,null,
 'GitHub · QR codes et accès aux lieux (à examiner)','todo','venue',
 current_date,'qr');
 second_id:=(ret->>'id')::uuid;
 ret:=public.save_project_work_item(
 'c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid,null,
 'GitHub · QR codes et accès aux lieux (à examiner)','todo','venue',
 current_date,'qr');
 if second_id<>(ret->>'id')::uuid then
  raise exception 'Duplicate GitHub review task created'; end if;
 if (select count(*) from public.project_work_items
  where quote_id='c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid
   and source_date=current_date and source_group='qr')<>1 then
  raise exception 'GitHub source uniqueness failed'; end if;

 -- Neither client nor unauthenticated user can inspect the owner-only work tasks.
 perform set_config('request.jwt.claims',jsonb_build_object(
  'sub',outsider,'role','authenticated')::text,true);
 begin
  perform public.list_project_work_items(quote_id);
  raise exception 'FAIL: non-owner could read owner work tasks';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;
 begin
  perform public.save_project_work_item(
   quote_id,null,'Unauthorized write attempt','todo','other',null,null);
  raise exception 'FAIL: non-owner created work task';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;
end $test$;
rollback;
