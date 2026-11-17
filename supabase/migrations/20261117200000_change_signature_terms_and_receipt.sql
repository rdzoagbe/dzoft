-- DZOFT: signing an extra-work proposal now
--  * requires the client to confirm the general terms (CGV) of the signed quote, whose version is
--    recorded on the proposal (Code civil art. 1119: general terms apply only if shown and accepted);
--  * sends the client an e-mail acknowledgement of the signature, as well as the owner
--    (Code civil art. 1127-2 al. 2: acknowledge receipt electronically without undue delay).
alter table public.dzoft_change_requests add column if not exists terms_version text;
alter table public.dzoft_change_requests drop constraint if exists dzoft_change_requests_terms_version_check;
alter table public.dzoft_change_requests add constraint dzoft_change_requests_terms_version_check
  check (terms_version is null or char_length(terms_version) between 1 and 40);

drop function if exists public.my_sign_change_request(uuid,integer,text,text);
drop function if exists public.portal_sign_change_request(uuid,uuid,integer,text,text);
drop function if exists private.dzoft_sign_change(uuid,uuid,integer,text,text);

create or replace function private.dzoft_sign_change(p_client uuid, p_request uuid, p_version integer, p_name text, p_code text, p_terms text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare sc public.sign_codes; r jsonb; c public.dzoft_change_requests; quote_terms text;
begin
 -- The proposal extends the signed quote: the client confirms that quote's general terms.
 select q.accepted_terms into quote_terms from public.dzoft_change_requests x
   join public.quotes q on q.id=x.quote_id where x.id=p_request and x.client_id=p_client;
 if coalesce(btrim(p_terms),'')='' or char_length(p_terms)>40
    or (quote_terms is not null and btrim(p_terms)<>quote_terms) then
   raise exception 'Please accept the general terms (CGV) before signing';
 end if;
 select * into sc from public.sign_codes
  where change_id=p_request and client_id=p_client and used_at is null
  order by created_at desc limit 1 for update;
 if not found then raise exception 'Request your code first'; end if;
 if sc.expires_at<now() then raise exception 'Code expired: request a new one'; end if;
 if sc.attempts>=5 then raise exception 'Too many attempts: request a new code'; end if;
 if encode(extensions.digest(sc.salt||btrim(coalesce(p_code,'')),'sha256'),'hex')<>sc.code_hash then
   update public.sign_codes set attempts=attempts+1 where id=sc.id;
   raise exception 'Incorrect code';
 end if;
 perform set_config('dzoft.change_signed','yes',true);
 r:=private.dzoft_decide_change(p_client,p_request,p_version,true,p_name);
 perform set_config('dzoft.change_signed','no',true);
 update public.sign_codes set used_at=now() where id=sc.id;
 update public.dzoft_change_requests set decision_method='email',decision_target=sc.target,terms_version=btrim(p_terms)
  where id=p_request returning * into c;
 -- notify_client = true: the client receives the acknowledgement too.
 perform private.queue_project_event('change-signed:'||c.id||':v'||c.proposal_version,'change_signed',
   left('Proposition '||coalesce(c.proposal_number,'complémentaire')||' signée par '||c.decision_name||
     ' · '||private.format_eur(coalesce(c.extra_price,0)),300),
   c.client_id,c.quote_id,null,null,null,true,true,false);
 return to_jsonb(c);
end $function$;
revoke all on function private.dzoft_sign_change(uuid,uuid,integer,text,text,text) from public,anon,authenticated;

create or replace function public.my_sign_change_request(p_request uuid, p_version integer, p_name text, p_code text, p_terms text)
 returns jsonb language sql security definer set search_path to '' as $function$
 select private.dzoft_sign_change(private.dzoft_client_for_change(null,false),p_request,p_version,p_name,p_code,p_terms);
$function$;
create or replace function public.portal_sign_change_request(p_token uuid, p_request uuid, p_version integer, p_name text, p_code text, p_terms text)
 returns jsonb language sql security definer set search_path to '' as $function$
 select private.dzoft_sign_change(private.dzoft_client_for_change(p_token,true),p_request,p_version,p_name,p_code,p_terms);
$function$;
revoke all on function public.my_sign_change_request(uuid,integer,text,text,text),
  public.portal_sign_change_request(uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.my_sign_change_request(uuid,integer,text,text,text) to authenticated;
grant execute on function public.portal_sign_change_request(uuid,uuid,integer,text,text,text) to anon;
