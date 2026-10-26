# RD Créations

Site de l'activité de création de sites web, d'applications web installables (PWA) et d'applications mobiles de Roland Dzoagbe, entrepreneur individuel.

- Site public : https://rdzoagbe.github.io/rd-creations/
- Espace privé (connexion requise) : `/admin/` — demandes, clients et devis, stockés dans Supabase (projet RD-Clients, région Paris), protégés par row level security.
- Suivi client (privé) : `/admin/suivi.html?q=…` — rendre un devis visible, envoyer le lien, étapes, documents, messages.
- Espace client : `/espace/#<lien secret>` — le client voit ses devis, les accepte en ligne, suit l’avancement et écrit. Aucun compte : un lien secret par client, lu uniquement via les fonctions `portal_get`, `portal_accept` et `portal_message`.
- Formulaire de devis : Formspree (`xrpppprj`) et enregistrement de la demande dans Supabase.

Le logo utilise la police Cinzel (licence SIL Open Font, voir `assets/`).
