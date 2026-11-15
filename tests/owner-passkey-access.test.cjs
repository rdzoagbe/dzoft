const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261115123000_allow_recent_owner_passkey_login.sql'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../admin/index.html'),'utf8');
const sb=fs.readFileSync(path.join(__dirname,'../admin/sb.js'),'utf8');

test('owner passkey authorization is bound to real Supabase Auth session evidence',()=>{
 assert.match(sql,/auth\.jwt\(\) -> 'app_metadata' ->> 'dzoft_owner'/);
 assert.match(sql,/auth\.sessions s/);
 assert.match(sql,/auth\.mfa_amr_claims c/);
 assert.match(sql,/c\.session_id = s\.id/);
 assert.match(sql,/s\.id::text = \(select auth\.jwt\(\) ->> 'session_id'\)/);
 assert.match(sql,/s\.user_id = \(select auth\.uid\(\)\)/);
 assert.match(sql,/c\.authentication_method = 'passkey'/);
 assert.match(sql,/amr\.entry ->> 'method' = 'passkey'/);
 assert.match(sql,/c\.created_at between now\(\) - interval '12 hours'/);
 assert.match(sql,/to_timestamp\(\(amr\.entry ->> 'timestamp'\)::double precision\)/);
});
test('password + TOTP still needs AAL2; no public owner escalation',()=>{
 assert.match(sql,/auth\.jwt\(\) ->> 'aal'\), 'aal1'\) = 'aal2'/);
 assert.match(sql,/auth\.mfa_factors f[\s\S]*?f\.status = 'verified'/);
 assert.match(sql,/revoke all on function public\.is_owner\(\) from public, anon, authenticated, service_role/);
 assert.match(sql,/grant execute on function public\.is_owner\(\) to authenticated/);
 assert.doesNotMatch(sql,/user_metadata/);
 assert.doesNotMatch(sql,/alter table .* disable row level security/i);
});
test('Admin asks for passkey or authenticator; only server RPC grants access',()=>{
 assert.match(html,/id="m-passkey-go"/);
 assert.match(html,/sb\.devicePasskey\.signIn\(\)/);
 assert.match(html,/sb\.rpc\('is_owner', \{\}, true\)/);
 assert.match(html,/sb\.ownerAccessFresh\(MFA_WINDOW\)/);
 assert.match(sb,/return mfaFresh\(maxAgeSeconds\) \|\| passkeyFresh\(maxAgeSeconds\)/);
 assert.match(sb,/if \(!getSession\(\) \|\| !p\.session_id/);
 assert.match(sb,/if \(!getSession\(\) \|\| !mfaFresh\(12 \* 60 \* 60\)\)/);
});
