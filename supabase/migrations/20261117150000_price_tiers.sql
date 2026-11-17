-- DZOFT: price levels for extra work. Each level has a rule the client can read on the
-- proposal, and a price the owner sets. Defaults are proportional to the first signed client quote
-- (one feature stays below the price of a whole module of that quote).
alter table public.settings add column if not exists price_tiers jsonb not null default '[
 {"key":"retouche","label":"Retouche","rule":"texte, couleur ou taille, sans nouvelle logique","price":10},
 {"key":"petite","label":"Petite évolution","rule":"un écran ou un comportement, sans nouvelle donnée","price":25},
 {"key":"moyenne","label":"Évolution moyenne","rule":"nouvelle donnée ou plusieurs écrans, avec tests","price":50},
 {"key":"importante","label":"Évolution importante","rule":"donnée protégée côté serveur (confidentialité ou sécurité), plusieurs écrans, tests","price":100},
 {"key":"offert","label":"Offert","rule":"proposé par DZOFT, non facturé","price":0}
]'::jsonb;
alter table public.settings drop constraint if exists settings_price_tiers_check;
alter table public.settings add constraint settings_price_tiers_check
  check (jsonb_typeof(price_tiers)='array' and jsonb_array_length(price_tiers)<=12);

-- An offered line (price 0) may sit beside billed lines; the total must still be positive.
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
     'detail',nullif(left(btrim(coalesce(l->>'detail','')),300),''),'source',src,
     'level',nullif(left(btrim(coalesce(l->>'level','')),20),''))));
 end loop;
 if positive<=0 or total<=0 then raise exception 'The total must be positive after the discount'; end if;
 if total>1000000 then raise exception 'Total too high'; end if;
 return jsonb_build_object('lines',cleaned,'total',round(total,2));
end $fn$;
revoke all on function private.change_lines_total(jsonb) from public,anon,authenticated;
