-- Roland's choice (18 Nov 2026): the second factor (authenticator-app code) is asked again every 7 days
-- instead of 12 hours, on the same browser. Same rule otherwise: owner marker in app_metadata,
-- aal2 session, second factor used within the window. Matches admin/sb.js and notify-client.
create or replace function public.is_owner()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
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
                between now() - interval '7 days' and now() + interval '2 minutes'
            else false end
        )
      )
    )
$function$;
