-- Run after the migration, inside BEGIN/ROLLBACK. No fixture or email survives.
do $test$
declare owner_id uuid:=gen_random_uuid(); client_user uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 c uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); receipt uuid:=gen_random_uuid(); update_id uuid:=gen_random_uuid(); batch uuid:=gen_random_uuid(); items jsonb; state jsonb; n integer;
begin
 insert into auth.users(id,aud,role) values(client_user,'authenticated','authenticated');
 insert into public.clients(id,nom,user_id,email) values(c,'Tracking test',client_user,'tracking@example.invalid');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
 insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,shared,invoices)
 values(q,c,'TEST',1500,1500,now(),true,
 '[{"id":"legacy","num":"TEST-1","amt":450,"paid":true},{"id":"balance","num":"TEST-2","amt":1050,"paid":false},{"id":"care","num":"TEST-3","amt":15,"paid":true,"care":"2026-11"}]');
 state:=public.project_tracking(q);
 if (state->>'received')::numeric<>450 or (state->>'remaining')::numeric<>1050 then raise exception 'Legacy/maintenance baseline failed'; end if;
 state:=public.record_project_receipt(q,receipt,'balance',200,current_date,'transfer','test');
 if (state->>'received')::numeric<>650 or (state->>'remaining')::numeric<>850 then raise exception 'Partial receipt failed'; end if;
 perform public.record_project_receipt(q,receipt,'balance',200,current_date,'transfer','test');
 select count(*) into n from public.project_receipts where quote_id=q;
 if n<>1 then raise exception 'Duplicate receipt'; end if;
 select count(*) into n from public.project_events where quote_id=q and event_key='receipt:'||receipt;
 if n<>1 then raise exception 'Duplicate receipt email event'; end if;
 begin
  perform public.record_project_receipt(q,gen_random_uuid(),'balance',851,current_date,'transfer','');
  raise exception 'FAIL: overpayment accepted';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
 begin
  update public.quotes set invoices='[]' where id=q;
  raise exception 'FAIL: receipt invoice removed';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
 state:=public.record_project_receipt(q,gen_random_uuid(),'balance',850,current_date,'card','');
 if (state->>'received')::numeric<>1500 or (state->>'remaining')::numeric<>0 then raise exception 'Full receipt double counted'; end if;
 if not exists(select 1 from public.quotes,jsonb_array_elements(invoices) i where id=q and i->>'id'='balance' and i->>'paid'='true') then raise exception 'Invoice not marked paid'; end if;
 perform public.publish_project_update(q,update_id,'design','tested','Reviewed screens');
 perform public.publish_project_update(q,update_id,'design','tested','Reviewed screens');
 select count(*) into n from public.project_updates where quote_id=q;
 if n<>1 then raise exception 'Duplicate publication'; end if;
 -- Grouped publication: three summaries, one event, one client email and one owner copy, no duplicate on retry.
 items:='[{"category":"design","status":"tested","summary":"Logo, couleurs et profils mis à jour."},{"category":"accounts","status":"built","summary":"Comptes et accès au lieu."},{"category":"safety","status":"built","summary":"Consentement, signalement et blocage."}]';
 perform public.publish_project_updates(q,batch,items);
 perform public.publish_project_updates(q,batch,items);
 select count(*) into n from public.project_updates where batch_id=batch;
 if n<>3 then raise exception 'Grouped publication count %',n; end if;
 select count(*) into n from public.project_events where event_key='digest:'||batch;
 if n<>1 then raise exception 'Grouped publication must create one event'; end if;
 select count(*) into n from public.email_outbox o join public.project_events e on e.id=o.event_id where e.event_key='digest:'||batch;
 if n<>2 then raise exception 'Grouped publication must queue one client email and one owner copy, got %',n; end if;
 begin
  perform public.publish_project_updates(q,gen_random_uuid(),'[{"category":"hacking","status":"built","summary":"x"}]');
  raise exception 'FAIL: unknown group accepted';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
 begin
  perform public.publish_project_updates(q,gen_random_uuid(),(select jsonb_agg(items->0) from generate_series(1,7)));
  raise exception 'FAIL: more than six summaries accepted';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',client_user,'role','authenticated')::text,true);
 state:=public.project_tracking(q);
 if (state->>'received')::numeric<>1500 then raise exception 'Client balance differs'; end if;
 begin
  perform public.publish_project_updates(q,gen_random_uuid(),items);
  raise exception 'FAIL: client published grouped update';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
 begin
  perform public.publish_project_update(q,gen_random_uuid(),'design','tested','Unauthorized');
  raise exception 'FAIL: client published update';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
 begin
  perform public.project_tracking(q);
  raise exception 'FAIL: cross-client read';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
 perform set_config('request.jwt.claims','{}',true);
 begin
  perform private.project_tracking(q);
  raise exception 'FAIL: anonymous read';
 exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
end $test$;
