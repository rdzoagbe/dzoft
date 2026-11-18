-- DZOFT (18 Nov 2026) — « Sauvegarder sur Google Drive ».
-- The Google OAuth « client ID » the admin uses to ask Google for access to the owner's Drive (scope drive.file).
-- A client ID is public by design (it is sent to Google in the browser); it is not a secret. settings is owner-only (RLS).
alter table public.settings add column if not exists google_client_id text
  check (google_client_id is null or google_client_id ~ '^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$');
