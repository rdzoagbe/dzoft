begin;

-- DZOFT owner sign-in policy:
-- (1) Password/OTP sign-ins with a verified TOTP factor still require fresh AAL2.
-- (2) A fresh, server-verified Supabase Passkey login is accepted directly.
-- This intentionally treats a phishing-resistant passkey as an alternative to
-- password + TOTP for the owner only, without changing Supabase's AAL claims.
-- Both paths require server-controlled app_metadata.dzoft_owner=true.
-- The signed JWT alone is not sufficient for the passkey branch: confirm the
-- same user's active Auth session has a matching server-created AMR record.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'dzoft_owner'), '') = 'true'
    and (
      not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      )
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
      or (
        -- Only Auth can create the AMR record after verifying WebAuthn.
        -- Tie it to the signed JWT's session_id and auth.uid(), not a client flag.
        exists (
          select 1
          from auth.sessions s
          join auth.mfa_amr_claims c on c.session_id = s.id
          where s.id::text = (select auth.jwt() ->> 'session_id')
            and s.user_id = (select auth.uid())
            and c.authentication_method = 'passkey'
            and c.created_at between now() - interval '12 hours'
                                 and now() + interval '2 minutes'
        )
        and exists (
          select 1
          from jsonb_array_elements(
            case when jsonb_typeof(auth.jwt() -> 'amr') = 'array'
              then auth.jwt() -> 'amr' else '[]'::jsonb end
          ) as amr(entry)
          where amr.entry ->> 'method' = 'passkey'
            and case when amr.entry ->> 'timestamp' ~ '^[0-9]{10}$' then
              to_timestamp((amr.entry ->> 'timestamp')::double precision)
                between now() - interval '12 hours' and now() + interval '2 minutes'
            else false end
        )
      )
    )
$function$;

-- No public or anonymous execute grants. Existing RLS continues calling is_owner().
revoke all on function public.is_owner() from public, anon, authenticated, service_role;
grant execute on function public.is_owner() to authenticated;

commit;
