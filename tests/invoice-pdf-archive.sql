-- Run on a controlled Supabase project, in one transaction. Synthetic rows
-- and private storage metadata are rolled back; no customer PDFs or mail are sent.
begin;
do $test$
declare
  own uuid:=gen_random_uuid();
  cl uuid:=gen_random_uuid();
  qid uuid:=gen_random_uuid();
  rid uuid:=gen_random_uuid();
  existing_user uuid;
  x jsonb;
  numbered text;
  inv_id text;
  path text;
  old_received numeric;
  after_received numeric;
  n integer;
begin
  select id into existing_user from auth.users order by created_at limit 1;
  if existing_user is null then raise exception 'Fixture requires a valid auth user FK';end if;
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',own,'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true)
  )::text,true);
  insert into public.clients(id,nom,email,user_id)
    values(cl,'INVOICE ARCHIVE ROLLBACK TEST','archive-rollback@example.invalid',existing_user);
  insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,shared,invoices,accepted_data)
    values(qid,cl,'TEST-ARCHIVE-ROLLBACK',1500,1500,now(),true,'[]',
      '{"f":{"myaddr":"Test seller, France","cname":"Test buyer","caddr":"Test buyer address, France","novat":true}}'::jsonb);
  perform public.record_project_payment_unbilled(qid,rid,350,current_date,'transfer','',false);
  x:=public.auto_issue_project_receipt_invoice(qid,rid,'deposit');
  numbered:=x->>'number';
  inv_id:=x->>'invoice_id';
  path:='u/'||existing_user::text||'/factures/'||qid::text||'/'||numbered||'.pdf';
  select (private.project_tracking(qid)->>'received')::numeric into old_received;
  begin
    perform public.attach_generated_invoice_pdf(qid,inv_id,path,1650);
    raise exception 'FAIL: linked missing PDF object';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise;end if;
  end;
  insert into storage.objects(bucket_id,name,metadata)
    values('client-files',path,'{"mimetype":"application/pdf","size":1650}'::jsonb);
  x:=public.attach_generated_invoice_pdf(qid,inv_id,path,1650);
  if x->>'already_archived'<>'false' then raise exception 'Archive not attached';end if;
  x:=public.attach_generated_invoice_pdf(qid,inv_id,path,1650);
  if x->>'already_archived'<>'true' then raise exception 'Retry should be idempotent';end if;
  if not exists (select 1 from public.quotes qq,
    jsonb_array_elements(qq.invoices) i where qq.id=qid and
    i->>'id'=inv_id and i->>'file'=path and i->>'fileSize'='1650')
    then raise exception 'Invoice JSON missing PDF link';end if;
  begin
   update public.quotes set invoices=jsonb_set(invoices,'{0,file}','"different.pdf"'::jsonb)
     where id=qid;
   raise exception 'FAIL: PDF replacement accepted';
  exception when others then if sqlerrm like 'FAIL:%' then raise;end if;end;
  begin
   update public.quotes set invoices=jsonb_set(invoices,'{0,n}','"Modified title"'::jsonb)
     where id=qid;
   raise exception 'FAIL: issued title changed';
  exception when others then if sqlerrm like 'FAIL:%' then raise;end if;end;
  select (private.project_tracking(qid)->>'received')::numeric into after_received;
  select count(*) into n from public.project_receipts where quote_id=qid;
  if n<>1 or old_received<>after_received or after_received<>350 then
    raise exception 'PDF archive duplicated or modified money';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',gen_random_uuid(),'role','authenticated')::text,true);
  begin
    perform public.attach_generated_invoice_pdf(qid,inv_id,path,1650);
    raise exception 'FAIL: unauthorized PDF link';
  exception when others then if sqlerrm like 'FAIL:%' then raise;end if;end;
end $test$;
rollback;
