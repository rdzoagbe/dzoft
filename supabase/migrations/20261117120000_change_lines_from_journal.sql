-- DZOFT: proposal lines can come from the project journal ("demande du client").
--  * each line may carry its origin ("journal:<date>:<hash>") so a request is never proposed twice;
--  * a commercial discount line (negative price) is allowed, the total stays positive;
--  * settings.default_line_price prices a request that matches nothing in the price list.
alter table public.settings add column if not exists default_line_price numeric(12,2);
alter table public.settings drop constraint if exists settings_default_line_price_check;
alter table public.settings add constraint settings_default_line_price_check
  check (default_line_price is null or (default_line_price>=0 and default_line_price<=1000000));

create or replace function private.change_lines_total(p_lines jsonb)
returns jsonb language plpgsql immutable set search_path='' as $fn$
declare l jsonb; label text; qty numeric; price numeric; total numeric:=0; positive numeric:=0;
  src text; cleaned jsonb:='[]'::jsonb;
begin
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 60 then
   raise exception 'Add between 1 and 60 lines';
 end if;
 for l in select value from jsonb_array_elements(p_lines) loop
   label:=btrim(coalesce(l->>'label',''));
   qty:=case when coalesce(l->>'qty','') ~ '^[0-9]+([.][0-9]{1,2})?$' then (l->>'qty')::numeric end;
   -- A negative price is a discount.
   price:=case when coalesce(l->>'price','') ~ '^-?[0-9]+([.][0-9]{1,2})?$' then (l->>'price')::numeric end;
   src:=nullif(btrim(coalesce(l->>'source','')),'');
   if char_length(label) not between 2 and 160 or qty is null or qty<=0 or qty>1000
      or price is null or abs(price)>1000000 then
     raise exception 'Each line needs a label, a quantity and a price';
   end if;
   if src is not null and src !~ '^journal:[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-z0-9]{1,16}$' then
     raise exception 'Invalid line origin';
   end if;
   total:=total+round(qty*price,2);
   if price>0 then positive:=positive+round(qty*price,2); end if;
   cleaned:=cleaned||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('label',label,'qty',qty,'price',price,
     'detail',nullif(left(btrim(coalesce(l->>'detail','')),300),''),'source',src)));
 end loop;
 if positive<=0 or total<0 then raise exception 'The total must be positive after the discount'; end if;
 if total>1000000 then raise exception 'Total too high'; end if;
 return jsonb_build_object('lines',cleaned,'total',round(total,2));
end $fn$;
revoke all on function private.change_lines_total(jsonb) from public,anon,authenticated;

alter table public.dzoft_change_requests drop constraint if exists dzoft_change_requests_lines_check;
alter table public.dzoft_change_requests add constraint dzoft_change_requests_lines_check
  check (lines is null or (jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 60));
