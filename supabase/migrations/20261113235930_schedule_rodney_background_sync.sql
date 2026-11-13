-- Activate recurring *server-side* synchronization after the Edge Function is deployed.
-- PostgreSQL Cron runs even when all client PWAs are closed.
-- Only a purpose-specific random token (kept in Supabase Vault) is sent.
-- No Supabase service-role key, GitHub PAT or client details are embedded here.
select cron.schedule(
  'dzoft_rodney_background_git',
  '17,47 * * * *',
  $cron$
    select net.http_post(
      url := 'https://rzghbvmszbjlqkdjzpxc.supabase.co/functions/v1/sync-rodney-github',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'X-DZOFT-Cron-Secret',
        (select decrypted_secret from vault.decrypted_secrets
         where name='dzoft_rodney_sync_token' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 12000
    );
  $cron$
);
