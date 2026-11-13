-- Payment journey: no real client, money or notification survives this test.
-- The email_outbox row created here is rolled back before the worker can read it.
begin;
do $test$
declare
 owner_key uuid:=gen_random_uuid();
 client_key uuid:=gen_random_uuid();
 quote_key uuid:=gen_random_uuid();
 cash_key uuid:=gen_random_uuid();
 transfer_key uuid:=gen_random_uuid();
 state jsonb;
 messages_before integer;
begin
 insert into public.clients(id,nom,email)
 values(client_key,'Rollback-only payment test','test-only@example.invalid');
 perform set_config('request.jwt.claims',jsonb_build_object(
  'sub',owner_key,'role','authenticated',
  'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
 insert into public.quotes
  (id,client_id,numero,total,accepted_total,accepted_at,shared,invoices)
 values(quote_key,client_key,'ROLLBACK-EMAIL-TEST',1500,1500,now(),true,'[]');

 state:=public.record_project_payment_unbilled(
  quote_key,cash_key,450,current_date-3,'cash','Earlier deposit',false);
 if (state->>'received')::numeric<>450 or (state->>'remaining')::numeric<>1050 then
  raise exception 'Earlier cash receipt totals incorrect'; end if;
 select count(*) into messages_before from public.email_outbox where quote_id=quote_key;
 if messages_before<>0 then raise exception 'Unrequested email was queued'; end if;

 state:=public.create_project_payment_status(
  quote_key,transfer_key,350,'transfer','pending',null,'Bank transfer pending');
 if (state->>'received')::numeric<>450 or (state->>'remaining')::numeric<>1050 then
  raise exception 'Pending transfer counted as money'; end if;
 state:=public.update_project_payment_status(
  quote_key,transfer_key,'sent_by_client',current_date);
 if (state->>'received')::numeric<>450 then
  raise exception 'Client-reported transfer counted as money'; end if;

 state:=public.confirm_project_payment_status(
  quote_key,transfer_key,current_date,true);
 if (state->>'received')::numeric<>800 or (state->>'remaining')::numeric<>700 then
  raise exception 'Verified bank transfer did not update totals'; end if;
 if not exists(select 1 from public.project_receipts
  where quote_id=quote_key and id=transfer_key and amount=350
    and method='transfer') then raise exception 'Missing confirmed transfer'; end if;
 if not exists(select 1 from public.email_outbox o
  join public.project_events e on e.id=o.event_id
  where o.quote_id=quote_key and o.recipient_role='client'
    and o.status='queued' and e.event_key='receipt:'||transfer_key) then
  raise exception 'Optional payment confirmation was not queued'; end if;
 if not exists(select 1 from public.project_events e
  where e.event_key='receipt:'||transfer_key
  and e.summary like '%800%' and e.summary like '%700%') then
  raise exception 'Receipt email summary lacks updated balance'; end if;

 perform public.confirm_project_payment_status(
  quote_key,transfer_key,current_date,true);
 if (select count(*) from public.project_receipts where quote_id=quote_key)<>2 then
  raise exception 'Duplicate receipt after client retry'; end if;
 if (select count(*) from public.email_outbox where quote_id=quote_key and recipient_role='client')<>1 then
  raise exception 'Duplicate client confirmation queued'; end if;

 -- Invoice association must not change received-money totals or resend confirmation.
 state:=public.link_project_receipt_invoice(quote_key,cash_key,'cash-invoice',
  '{"n":"Facture d’acompte","num":"ROLLBACK-CASH-001","amt":450}'::jsonb);
 if (state->>'received')::numeric<>800 or (state->>'remaining')::numeric<>700 then
  raise exception 'Invoice association changed financial totals'; end if;
 if (select count(*) from public.email_outbox where quote_id=quote_key and recipient_role='client')<>1 then
  raise exception 'Invoice association duplicated client notification'; end if;
end $test$;
rollback;
