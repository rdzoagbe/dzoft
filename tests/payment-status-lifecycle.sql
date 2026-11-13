-- Live-safe integration verification. ALL fixture data is rolled back.
begin;
do $test$
declare
 owner_id uuid:=gen_random_uuid();
 client_user uuid:=gen_random_uuid();
 customer uuid:=gen_random_uuid();
 quote_key uuid:=gen_random_uuid();
 cash_receipt uuid:=gen_random_uuid();
 transfer_status uuid:=gen_random_uuid();
 cancelled_status uuid:=gen_random_uuid();
 state jsonb;
 n integer;
begin
 insert into public.clients(id,nom,email,user_id)
 values(customer,'Payment status test','payment-test@example.invalid',client_user);
 perform set_config('request.jwt.claims',jsonb_build_object(
  'sub',owner_id,'role','authenticated',
  'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
 insert into public.quotes
  (id,client_id,numero,total,accepted_total,accepted_at,shared,invoices)
 values(quote_key,customer,'PAY-STATUS-TEST',1500,1500,now(),true,'[]');

 -- Prior cash receipt is already real money.
 state:=public.record_project_payment_unbilled(
  quote_key,cash_receipt,450,current_date-5,'cash','old deposit',false);
 if (state->>'received')::numeric<>450 or (state->>'remaining')::numeric<>1050
 then raise exception 'Opening cash deposit totals incorrect'; end if;

 -- Client has not paid yet: pending cannot reduce the balance.
 state:=public.create_project_payment_status(
  quote_key,transfer_status,350,'transfer','pending',null,'bank reference');
 if (state->>'received')::numeric<>450 or (state->>'remaining')::numeric<>1050
 then raise exception 'Pending money was counted as received'; end if;
 if jsonb_array_length(state->'payment_statuses')<>1
 then raise exception 'Pending claim not visible in project tracking'; end if;
 select count(*) into n from public.project_receipts where quote_id=quote_key;
 if n<>1 then raise exception 'Pending status inserted a receipt'; end if;

 -- Client says sent; still not proof of bank clearance.
 state:=public.update_project_payment_status(
  quote_key,transfer_status,'sent_by_client',current_date);
 if (state->>'received')::numeric<>450
 then raise exception 'Client-reported transfer counted too early'; end if;
 if not exists(select 1 from public.project_payment_statuses
  where id=transfer_status and status='sent_by_client')
 then raise exception 'Report state did not change'; end if;

 -- Only owner can confirm and optionally send email.
 state:=public.confirm_project_payment_status(
  quote_key,transfer_status,current_date,false);
 if (state->>'received')::numeric<>800 or (state->>'remaining')::numeric<>700
 then raise exception 'Confirmed receipt did not update total correctly'; end if;
 if not exists(select 1 from public.project_receipts
  where id=transfer_status and amount=350 and method='transfer')
 then raise exception 'Confirmed transfer ledger row missing'; end if;
 if not exists(select 1 from public.project_payment_statuses
  where id=transfer_status and status='received' and receipt_id=transfer_status)
 then raise exception 'Payment status not marked received'; end if;

 -- Retry must not double count or duplicate the receipt event.
 perform public.confirm_project_payment_status(
  quote_key,transfer_status,current_date,true);
 select count(*) into n from public.project_receipts where quote_id=quote_key;
 if n<>2 then raise exception 'Duplicate payment on retry'; end if;
 select count(*) into n from public.project_events
  where event_key='receipt:'||transfer_status;
 if n<>1 then raise exception 'Duplicate payment notification event'; end if;

 -- Void pending report without altering received balance.
 perform public.create_project_payment_status(
  quote_key,cancelled_status,50,'transfer','pending',null,'cancel this');
 state:=public.update_project_payment_status(
  quote_key,cancelled_status,'cancelled',null);
 if (state->>'received')::numeric<>800 then
  raise exception 'Cancel altered confirmed balance'; end if;

 begin
  perform public.confirm_project_payment_status(
   quote_key,cancelled_status,current_date,true);
  raise exception 'FAIL: cancelled payment was received';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;

 begin
  perform public.create_project_payment_status(
   quote_key,gen_random_uuid(),701,'transfer','pending',null,'overclaim');
  raise exception 'FAIL: pending amount exceeded outstanding amount';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;

 -- Client can read states but cannot create/confirm them.
 perform set_config('request.jwt.claims',
  jsonb_build_object('sub',client_user,'role','authenticated')::text,true);
 state:=public.project_tracking(quote_key);
 if (state->>'received')::numeric<>800 or
  jsonb_array_length(state->'payment_statuses')<>2
 then raise exception 'Client tracking inaccessible or wrong'; end if;
 begin
  perform public.create_project_payment_status(
   quote_key,gen_random_uuid(),1,'transfer','pending',null,'unauthorized');
  raise exception 'FAIL: client could create a payment status';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
 end;
end $test$;
rollback;
