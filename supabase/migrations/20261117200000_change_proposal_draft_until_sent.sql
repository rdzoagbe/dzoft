-- DZOFT (17 Nov 2026): a priced proposal is a draft, seen only by the owner, until « Envoyer au client ».
-- * The client's lists (my_/portal_list_change_requests) never show a proposal that has not been sent:
--   one opened by DZOFT is hidden; a client's own request stays visible as « requested », without the draft price.
-- * No signing code can be issued, and no decision recorded, on a proposal that has not been sent.
-- * Repricing (owner_propose_change) makes it a draft again, like owner_price_change_request already does.

create or replace function private.dzoft_changes_for_client(p_client uuid, p_quote uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
 if not exists (select 1 from public.quotes q
   where q.id=p_quote and q.client_id=p_client and q.shared and q.deleted_at is null and q.accepted_at is not null)
 then raise exception 'Accepted project not found'; end if;
 return coalesce((select jsonb_agg(
   case when c.status='proposed' and c.sent_at is null then
     -- The client's own request, while DZOFT prepares the price: shown as still being studied.
     to_jsonb(c)||jsonb_build_object('status','requested','proposed_scope',null,'extra_price',null,'timeline_impact',null,
       'lines',null,'proposal_number',null,'proposal_version',0,'proposed_at',null,'already_done',false,
       'history',coalesce((select jsonb_agg(jsonb_build_object('event_type',e.event_type,'actor_type',e.actor_type,'at',e.created_at,
         'proposal_version',e.proposal_version) order by e.created_at,e.id)
        from public.dzoft_change_events e where e.request_id=c.id and e.event_type='requested'),'[]'::jsonb))
   else
     to_jsonb(c)||jsonb_build_object('history',coalesce((select jsonb_agg(jsonb_build_object(
       'event_type',e.event_type,'actor_type',e.actor_type,'at',e.created_at,'proposal_version',e.proposal_version)
       order by e.created_at,e.id) from public.dzoft_change_events e where e.request_id=c.id),'[]'::jsonb))
   end order by c.created_at desc,c.id)
   from public.dzoft_change_requests c
   where c.quote_id=p_quote and c.client_id=p_client
     -- A draft opened by DZOFT does not exist for the client until it is sent.
     and not (c.status='proposed' and c.sent_at is null and exists(select 1 from public.dzoft_change_events e
       where e.request_id=c.id and e.event_type='requested' and e.actor_type='owner'))),'[]'::jsonb);
end $function$;
revoke all on function private.dzoft_changes_for_client(uuid,uuid) from public,anon,authenticated;

create or replace function public.my_list_change_requests(p_quote uuid)
 returns jsonb language sql security definer set search_path to '' as $function$
 select private.dzoft_changes_for_client(private.dzoft_client_for_change(null,false),p_quote);
$function$;

create or replace function public.portal_list_change_requests(p_token uuid, p_quote uuid)
 returns jsonb language sql security definer set search_path to '' as $function$
 select private.dzoft_changes_for_client(private.dzoft_client_for_change(p_token,true),p_quote);
$function$;

create or replace function private.dzoft_decide_change(p_client uuid, p_request uuid, p_version integer, p_approve boolean, p_name text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare c public.dzoft_change_requests;
begin
 select * into c from public.dzoft_change_requests where id=p_request and client_id=p_client for update;
 if not found then raise exception 'Request not found';end if;
 if not exists(select 1 from public.quotes q where q.id=c.quote_id and q.client_id=p_client
  and q.deleted_at is null and q.shared and q.accepted_at is not null) then raise exception 'Project not available';end if;
 if c.status<>'proposed' or c.proposal_version<>p_version or p_version<1
 then raise exception 'Proposal changed or is no longer awaiting approval';end if;
 if c.sent_at is null then raise exception 'Proposal changed or is no longer awaiting approval';end if;
 if p_approve and coalesce(current_setting('dzoft.change_signed',true),'')<>'yes' then
   raise exception 'Approval requires the code sent by e-mail';
 end if;
 p_name:=btrim(coalesce(p_name,''));
 if char_length(p_name) not between 2 and 120 then raise exception 'Your name is required to confirm this decision';end if;
 update public.dzoft_change_requests
 set status=case when p_approve then 'approved' else 'declined' end,
  decision_name=p_name,decided_at=now(),updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,c.status,'client',c.proposal_version,
   jsonb_build_object('name',p_name,'scope',c.proposed_scope,'extra_price',c.extra_price,
    'timeline_impact',c.timeline_impact,'original_quote',c.quote_id));
 return to_jsonb(c);
end $function$;

create or replace function public.reserve_change_sign_code(p_change_id uuid, p_client_id uuid, p_salt text, p_code_hash text, p_target text, p_expires_at timestamp with time zone)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare c public.dzoft_change_requests; v_recent integer; v_daily integer; v_id uuid;
begin
 select * into c from public.dzoft_change_requests
  where id=p_change_id and client_id=p_client_id and status='proposed' and sent_at is not null for update;
 if not found then return jsonb_build_object('ok',false,'reason','change'); end if;
 select count(*) into v_recent from public.sign_codes where change_id=p_change_id and created_at>=now()-interval '15 minutes';
 select count(*) into v_daily from public.sign_codes where change_id=p_change_id and created_at>=now()-interval '24 hours';
 if v_recent>=3 or v_daily>=10 then return jsonb_build_object('ok',false,'reason','rate_limit'); end if;
 insert into public.sign_codes(quote_id,client_id,channel,target,salt,code_hash,expires_at,change_id)
 values(c.quote_id,p_client_id,'email',p_target,p_salt,p_code_hash,p_expires_at,p_change_id) returning id into v_id;
 return jsonb_build_object('ok',true,'id',v_id,'number',c.proposal_number,'amount',c.extra_price,'version',c.proposal_version);
end $function$;

create or replace function public.owner_propose_change(p_request uuid, p_scope text, p_extra_price numeric, p_timeline text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare c public.dzoft_change_requests; q public.quotes;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'Only open requests can receive a proposal';end if;
 select * into q from public.quotes where id=c.quote_id and client_id=c.client_id;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared then raise exception 'Accepted project required';end if;
 p_scope:=btrim(coalesce(p_scope,''));p_timeline:=btrim(coalesce(p_timeline,''));
 if char_length(p_scope) not between 10 and 2000 or p_extra_price is null or
  p_extra_price<0 or p_extra_price>1000000 or p_extra_price<>round(p_extra_price,2)
  or char_length(p_timeline)>600 then raise exception 'Invalid change proposal';end if;
 update public.dzoft_change_requests set status='proposed',proposed_scope=p_scope,
  extra_price=p_extra_price,timeline_impact=p_timeline,
  proposal_version=proposal_version+1,proposed_at=now(),decided_at=null,decision_name=null,sent_at=null,updated_at=now()
 where id=p_request returning * into c;
 update public.sign_codes set used_at=now() where change_id=c.id and used_at is null;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'proposed','owner',c.proposal_version,
 jsonb_build_object('scope',c.proposed_scope,'extra_price',c.extra_price,'timeline_impact',c.timeline_impact));
 return to_jsonb(c);
end $function$;
