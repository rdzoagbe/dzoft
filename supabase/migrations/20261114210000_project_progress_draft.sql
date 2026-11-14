-- Owner-private draft of the next client update, prepared from the project journal. Never returned to clients:
-- client-facing functions build their answers field by field and the quotes table is readable by the owner only.
alter table public.quotes add column if not exists progress_draft jsonb;
