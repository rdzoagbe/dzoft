-- Brevo reporting API is available even when webhook-management API is not.
-- Poll the limited set of recent DZOFT message IDs once an hour, entirely
-- server-side, with a Vault token. No email is generated or resent.
select cron.schedule(
 'dzoft_brevo_delivery_reconcile',
 '25 * * * *',
 $job$
 select net.http_post(
   url := 'https://rzghbvmszbjlqkdjzpxc.supabase.co/functions/v1/brevo-delivery-events/reconcile',
   headers := jsonb_build_object(
     'Content-Type','application/json',
     'X-DZOFT-Setup-Token',
     (select decrypted_secret from vault.decrypted_secrets
       where name='dzoft_brevo_setup_token' limit 1)
   ),
   body := '{}'::jsonb,
   timeout_milliseconds := 55000
 );
 $job$
);
