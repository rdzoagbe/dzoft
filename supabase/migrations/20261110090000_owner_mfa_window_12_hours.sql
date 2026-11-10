begin;

-- Roland's choice (10 Nov 2026): the second factor (TOTP code or passkey) is asked again every 12 hours
-- instead of 8. Same rule otherwise: owner marker in app_metadata, aal2 session, recent second factor.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'dzoft_owner'), '') = 'true'
    and (
      not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
      or (
        coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
        and exists (
          select 1
          from jsonb_array_elements(
            case when jsonb_typeof(auth.jwt() -> 'amr') = 'array'
              then auth.jwt() -> 'amr' else '[]'::jsonb end
          ) as amr(entry)
          where amr.entry ->> 'method' in ('totp', 'mfa/totp', 'mfa/webauthn', 'webauthn')
            and case when amr.entry ->> 'timestamp' ~ '^[0-9]{10}$' then
              to_timestamp((amr.entry ->> 'timestamp')::double precision)
                between now() - interval '12 hours' and now() + interval '2 minutes'
            else false end
        )
      )
    )
$function$;
revoke all on function public.is_owner() from public, anon, authenticated, service_role;
grant execute on function public.is_owner() to authenticated;

commit;
