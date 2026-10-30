begin;

-- pg_net cannot be relocated; Supabase recommends recreating it in extensions.
-- The async request queue was confirmed empty before applying this migration.
create schema if not exists extensions;
drop extension pg_net;
create extension pg_net with schema extensions;

commit;

