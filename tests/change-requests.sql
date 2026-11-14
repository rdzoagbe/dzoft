begin;
do $test$
declare
  cid uuid:=gen_random_uuid();
  qid uuid:=gen_random_uuid();
  token_id uuid:=gen_random_uuid();
  owner_id uuid:=gen_random_uuid();
  req_id uuid;
  r jsonb;
  p jsonb;
  before_total numeric;
  after_total numeric;
  event_count integer;
begin
 insert into public.clients(id,nom,email,portal_token) values(cid,'CHANGE REQUEST SYNTHETIC','synthetic-change@example.invalid',token_id);
 insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,shared,invoices,accepted_data)
 values(qid,cid,'D-CHANGE-TEST',1500,1500,now(),true,'[]'::jsonb,'{"f":{"cname":"Synthetic Test","myaddr":"Paris","caddr":"Paris"}}'::jsonb);
 select accepted_total into before_total from public.quotes where id=qid;
 r:=public.portal_create_change_request(token_id,qid,'Add a page','Please add a seventh page with a contact form.');
 req_id:=(r->>'id')::uuid;
 if r->>'status'<>'requested' then raise exception 'Client request not recorded';end if;
 if jsonb_array_length(public.portal_list_change_requests(token_id,qid))<>1 then raise exception 'Client project list empty';end if;
 begin
   perform public.portal_list_change_requests(gen_random_uuid(),qid);
   raise exception 'FAIL wrong token allowed';
 exception when others then if sqlerrm like 'FAIL%' then raise;end if; end;
 begin
   perform public.portal_decide_change_request(token_id,req_id,0,true,'Synthetic Client');
   raise exception 'FAIL unpriced request accepted';
 exception when others then if sqlerrm like 'FAIL%' then raise;end if; end;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated',
       'app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
 p:=public.owner_propose_change(req_id,'Add a fully specified seventh page and contact form.',250,'Adds 3 business days');
 if p->>'status'<>'proposed' or (p->>'proposal_version')::int<>1 then raise exception 'First proposal not recorded';end if;
 p:=public.owner_propose_change(req_id,'Revised: seventh page plus an additional form field.',275,'Adds 4 business days');
 if (p->>'proposal_version')::int<>2 then raise exception 'Proposal version not incremented';end if;
 if jsonb_array_length(public.owner_list_change_requests(qid))<>1 then raise exception 'Owner list empty';end if;
 
 perform set_config('request.jwt.claims',jsonb_build_object('role','anon')::text,true);
 begin
   perform public.portal_decide_change_request(token_id,req_id,1,true,'Synthetic Client');
   raise exception 'FAIL outdated proposal approved';
 exception when others then if sqlerrm like 'FAIL%' then raise;end if; end;
 p:=public.portal_decide_change_request(token_id,req_id,2,true,'Synthetic Client');
 if p->>'status'<>'approved' or (p->>'extra_price')::numeric<>275 then raise exception 'Approval does not preserve accepted price';end if;
 begin
   perform public.portal_decide_change_request(token_id,req_id,2,true,'Synthetic Client');
   raise exception 'FAIL duplicate decision allowed';
 exception when others then if sqlerrm like 'FAIL%' then raise;end if; end;
 select accepted_total into after_total from public.quotes where id=qid;
 if after_total<>before_total or after_total<>1500 then raise exception 'Original quote changed';end if;
 select count(*) into event_count from public.dzoft_change_events where request_id=req_id;
 if event_count<>4 then raise exception 'Audit history incomplete %',event_count;end if;
 begin
   update public.dzoft_change_events set event_type='withdrawn' where request_id=req_id;
   raise exception 'FAIL audit edit permitted';
 exception when others then if sqlerrm like 'FAIL%' then raise;end if; end;
end $test$;
rollback;