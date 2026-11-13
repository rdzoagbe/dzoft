-- The built-in service_role can call the owner-isolated private wrappers.
-- No rights are granted to anon or normal authenticated users.
-- service_role already bypasses RLS: schema USAGE merely resolves these
-- specifically granted functions; it does not grant table SELECT.
grant usage on schema private to service_role;
