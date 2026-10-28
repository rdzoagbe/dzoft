# DZOFT

Site de l'activité de création de sites web, d'applications web installables (PWA) et d'applications mobiles de Roland Dzoagbe, entrepreneur individuel.

- Site public : https://rdzoagbe.github.io/dzoft/
- Espace privé (connexion requise) : `/admin/` — demandes, clients et devis, stockés dans Supabase (projet RD-Clients, région Paris), protégés par row level security.
- Suivi client (privé) : `/admin/suivi.html?q=…` — rendre un devis visible, envoyer le lien, étapes, documents, messages.
- Espace client : `/espace/` — le client se connecte (e-mail et mot de passe, compte créé en envoyant sa demande depuis le site) ou ouvre son lien privé `/espace/#<lien secret>` (demandes reçues par WhatsApp ou e-mail). Il voit ses demandes et ses devis, les accepte en ligne, suit l’avancement et écrit. Accès uniquement via les fonctions `my_*` (compte) et `portal_*` (lien).
- E-mails de confirmation et de mot de passe : voir `docs/emails-supabase.md` (envoi via le SMTP Brevo configuré dans Supabase).
- Formulaire de devis : Formspree (`xrpppprj`) et enregistrement de la demande dans Supabase.

Le logo DZOFT utilise la police Unbounded (convertie en tracés) et le site la police Sora, toutes deux sous licence SIL Open Font (voir `assets/fonts/`).
