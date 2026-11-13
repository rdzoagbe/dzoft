-- Integration test for audited receipt method corrections.
-- All fixtures and changes are rolled back; real client data is untouched.
begin;
do $test$
declare
 owner_key uuid:=gen_random_uuid();
 customer_key uuid:=gen_random_uuid();
 quote_key uuid:=gen_random_uuid();
 receipt_key uuid:=gen_random_uuid();
 state jsonb;
 meta jsonb;
 before_events integer;
 before_outbox integer;
begin
 insert into public.clients(id,nom,email)
 values(customer_key,'Payment correction test','payment-correction@example.invalid');
 perform set_config('request.jwt.claims',jsonb_build_object(
  'sub',owner_key,'role','authenticated',
  'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
 insert into public.quotes
  (id,client_id,numero,total,accepted_total,accepted_at,shared,invoices)
 values(quote_key,customer_key,'METHOD-CORRECTION-TEST',1500,1500,now(),true,'[]');

 state:=public.record_project_payment_unbilled(
  quote_key,receipt_key,450,current_date-3,'transfer','Original receipt',false);
 if (state->>'received')::numeric<>450 then
  raise exception 'Fixture payment missing'; end if;
 select count(*) into before_events from public.project_events where quote_id=quote_key;
 select count(*) into before_outbox from public.email_outbox where quote_id=quote_key;

 meta:=public.project_payment_admin_meta(quote_key);
 if jsonb_array_length(meta->'notifications')<>1
  or meta->'notifications'->0->>'email_status'<>'not_queued' then
  raise exception 'Owner email status not displayed correctly'; end if;
 if jsonb_array_length(meta->'corrections')<>0 then
  raise exception 'Unexpected correction audit row'; end if;

 state:=public.correct_project_receipt_method(
  quote_key,receipt_key,'cash','The client originally paid in cash');
 if (state->>'received')::numeric<>450 or (state->>'remaining')::numeric<>1050 then
  raise exception 'Correction changed financial figures'; end if;
 if not exists(select 1 from public.project_receipts
  where id=receipt_key and method='cash' and amount=450
   and received_on=current_date-3) then
  raise exception 'Correction did not preserve original cash receipt'; end if;
 meta:=public.project_payment_admin_meta(quote_key);
 if jsonb_array_length(meta->'corrections')<>1
  or meta->'corrections'->0->>'old_method'<>'transfer'
  or meta->'corrections'->0->>'new_method'<>'cash' then
  raise exception 'Audit history is missing or incorrect'; end if;
 if (select count(*) from public.project_events where quote_id=quote_key)<>before_events
  or (select count(*) from public.email_outbox where quote_id=quote_key)<>before_outbox then
  raise exception 'Correction duplicated notification or receipt events'; end if;

 begin
  perform public.correct_project_receipt_method(
   quote_key,receipt_key,'cash','Repeat correction must be blocked');
  raise exception 'FAIL: duplicate correction accepted';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;

 perform set_config('request.jwt.claims',
  jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin
  perform public.correct_project_receipt_method(
    quote_key,receipt_key,'transfer','Unauthorized attempt must fail');
  raise exception 'FAIL: client edited confirmed payment';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;
 begin
  perform public.project_payment_admin_meta(quote_key);
  raise exception 'FAIL: client read private audit data';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;
end $test$;
rollback;
