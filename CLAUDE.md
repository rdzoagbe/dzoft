# DZOFT : site, espace client et outil de gestion

Roland Dzoagbe parle français : réponds en français, simplement, sans jargon. Il valide ce qui touche
à ses comptes (Google, Supabase, Revolut, OVH…) ; toi, tu fais le code et tu le guides pas à pas.

## L'entreprise
- **DZOFT** est le nom commercial de **Roland Dzoagbe, entrepreneur individuel** (micro-entreprise),
  93140 Bondy. SIREN 104 838 727, SIRET 104 838 727 00014. TVA non applicable, art. 293 B du CGI.
- Contact public : rolanddzoagbe@gmail.com · 07 82 88 46 46 (WhatsApp).
  Compte propriétaire (admin, Supabase) : roland.dzoagbe@hotmail.com.
- Offres : page de présentation dès 200 €, site vitrine dès 400 €, PWA dès 700 €,
  application mobile dès 1 500 €, suivi mensuel dès 15 €/mois.
- Ancien nom : RD Créations (abandonné en octobre 2026, ne plus l'utiliser).

## Le site
- HTML/CSS/JS sans framework ni build, servi par **GitHub Pages** depuis `main` (racine) :
  https://rdzoagbe.github.io/dzoft/ . On pousse directement sur `main`.
- `index.html` accueil court : héros, 2 réalisations, CTA. Les anciennes ancres `#services`,
  `#methode`, `#faq`, `#devis` redirigent chacune vers sa page (petit script dans le `<head>`).
- Une page par onglet : `services.html` (forfaits complets), `realisations.html`, `methode.html`,
  `faq.html` (JSON-LD FAQPage) ; même modèle : bandeau héros, section CTA, nav avec `aria-current`.
- `devis.html` (et `en/quote.html`) : formulaire de devis avec brief adapté au type de projet ;
  le brief part dans `leads.message` en lignes « Libellé : valeur », que l'admin regroupe par rubriques.
- `cgv.html` · `confidentialite.html` · `404.html` ·
  `demos/{boulangerie,coiffure,plombier}/` (sites fictifs, `noindex`, bandeau `.demo`).
- `en/` : version anglaise page à page (index, services, methode, faq, realisations, cgv,
  confidentialite ; sélecteur « FR | EN » en haut à droite, balises hreflang, sitemap).
  **Toute modification de texte sur une page du site doit être reportée dans `en/`.** Dans le formulaire anglais, les valeurs envoyées restent en français (admin) ;
  seuls les libellés sont traduits. `en/cgv.html` : traduction des CGV, pour information (bandeau :
  la version française fait foi), idem `en/confidentialite.html` ; **toute modification de `cgv.html` ou
  `confidentialite.html` doit être reportée dans `en/`**. Espace client, admin et démos : en français seulement.
- `espace/` espace client (connexion par compte ou par lien secret `#<portal_token>`) :
  devis signé avec un code e-mail, avancement, validation des étapes, factures, documents,
  messages, suivi mensuel, avis (+ renvoi vers l'avis Google, proposé quelle que soit la note).
- `admin/` espace privé : `index.html` tableau de bord, `suivi.html` fiche projet,
  `devis.html` éditeur de devis ; `admin/sb.js` client Supabase partagé (`window.RDsb`).
  Le « À faire » du tableau de bord rappelle : nouvelles demandes, relances (`next_at`), devis
  sans réponse (≥ 5 j) ou expirés, brouillons, acomptes, étapes validées par le client,
  factures de suivi dues, avis à publier, messages non lus.
- `assets/rd-booking.js` (lien Google Agenda), `assets/rd-reviews.js` (avis publiés),
  `assets/rd-steps.js`, logos `dzoft-*`, polices Sora auto-hébergées dans `assets/fonts`.
- SEO : JSON-LD dans `index.html` et `realisations.html`, `sitemap.xml`, `robots.txt`,
  balise de validation Search Console + `googlefe80f3bfe6ca8091.html`.

## Charte
- Marine `#0B1020`, marine 2 `#16204A`, bleu `#4361EE`, cyan `#22D3EE`, liens `#3448D6`.
- Boutons principaux : `linear-gradient(135deg,#4361EE,#3A4FE0)`, texte blanc.
- Titres Sora 600/700, texte system-ui. Signature : « Digital solutions, built for growth. »
- Textes en français soigné : apostrophe typographique ’, guillemets « », espaces avant : ; ? !

## Supabase (projet `rzghbvmszbjlqkdjzpxc`, Paris)
- Tables : leads, clients, quotes (steps, docs, env, invoices, care, ext_link…), messages,
  notifications, sign_codes, settings, reviews. RLS partout.
- Suivi des demandes (`leads.status`) : nouvelle → contactée → devis envoyé → gagnée / perdue,
  plus archivée (« traitée » hérité) ; `leads.next_at` = date de relance, rappelée sur le tableau
  de bord. Côté client, « perdue » s'affiche « Close », jamais le statut interne.
- Modèle des fonctions SQL `SECURITY DEFINER` : `client_*` internes (aucun droit),
  `my_*` pour le client connecté (authenticated), `portal_*` pour le lien secret (anon).
  L'admin est reconnu par son e-mail propriétaire.
- Fonctions edge (source dans `supabase/functions`, `verify_jwt: true`) : `notify-client`
  (e-mails projet) et `sign-code` (code de signature). Envoi par l'API Brevo, expéditeur « DZOFT ».
  Secrets : `BREVO_API_KEY`, `SENDER_EMAIL`. Redéployer après chaque modification du code.
- `supabase/schema.sql` : copie de référence du schéma (tables, index, RLS, fonctions SQL,
  stockage, droits), générée le 2026-10-28 ; à régénérer après toute modification de la base.
- Sauvegarde des données : le schéma est dans Git, PAS les données. Export JSON complet remis
  à Roland en privé le 2026-10-29 (hors dépôt public) ; à refaire après chaque signature ou
  changement important — demander l'export à Claude.
- Modèles d'e-mails d'authentification : `docs/emails-supabase.md` (à recoller à la main dans
  Supabase, Authentication → Emails).

## Liens externes
- Réservation d'appel : https://calendar.app.google/6VXsMWzwNMWer3de8
- Avis Google : https://g.page/r/CYguS5Uj8gxpECE/review
- Paiement Revolut Pro : revolut.me/rolandgoug (les devis et factures officiels se font aussi
  dans Revolut Pro ; le lien du devis Revolut se colle dans la fiche projet).
- Portfolio personnel : https://rdzoagbe.github.io/Portfolio.RDzoagbe/

## Vérifier
- `python3 -m http.server` à la racine, puis Playwright (déjà installé, `NODE_PATH=/opt/node22/lib/node_modules`).
- Pour l'espace client et l'admin, intercepter `*.supabase.co` avec `context.route` et renvoyer
  des données fictives (session dans localStorage : `rd-client-session` / `rd-admin-session`).
- Toujours regarder le rendu (ordinateur et téléphone 390 px) avant de pousser.

## En attente côté Roland
- Nom de domaine `dzoft.fr` + `dzoft.com` (libres, chez OVHcloud) : plus tard, quand le premier
  client aura payé. Ensuite : fichier `CNAME`, DNS, remplacer l'adresse partout, e-mail
  contact@dzoft.fr, expéditeur Brevo sur le domaine.
- Médiateur de la consommation (CM2C) : adhésion, puis compléter l'article 16 de `cgv.html`
  (nom, site et adresse du médiateur, actuellement « à compléter »).
- Prospection locale : kit + liste de départ (Bondy : boulangeries, coiffeurs, plombiers,
  sans site d'après PagesJaunes) livrés le 2026-10-28 en privé, volontairement HORS du dépôt
  (public). À lui de contacter ; vérifier chaque fiche sur Google avant contact.
- Devis D-2026-001 (Rodney, application mobile, 1 500 €) : envoyé le 28/10/2026, visible dans
  son espace, valable jusqu'au 25/11/2026 ; en attente d'acceptation en ligne (le tableau de
  bord relancera tout seul après 5 jours sans réponse).
