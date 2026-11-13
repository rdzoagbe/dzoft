-- Private project journal on the project sheet (admin/suivi.html): dated entries {d, k, t}.
-- Admin only: the client functions (my_*, portal_*) build their answers field by field and never return this column.
alter table public.quotes add column if not exists journal jsonb not null default '[]'::jsonb;
