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
- `index.html` accueil (services, démos, avis, méthode, FAQ, devis via Formspree) ·
  `realisations.html` · `cgv.html` · `confidentialite.html` · `404.html` ·
  `demos/{boulangerie,coiffure,plombier}/` (sites fictifs, `noindex`, bandeau `.demo`).
- `espace/` espace client (connexion par compte ou par lien secret `#<portal_token>`) :
  devis signé avec un code e-mail, avancement, validation des étapes, factures, documents,
  messages, suivi mensuel, avis (+ renvoi vers l'avis Google, proposé quelle que soit la note).
- `admin/` espace privé : `index.html` tableau de bord, `suivi.html` fiche projet,
  `devis.html` éditeur de devis ; `admin/sb.js` client Supabase partagé (`window.RDsb`).
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
- Modèle des fonctions SQL `SECURITY DEFINER` : `client_*` internes (aucun droit),
  `my_*` pour le client connecté (authenticated), `portal_*` pour le lien secret (anon).
  L'admin est reconnu par son e-mail propriétaire.
- Fonctions edge (source dans `supabase/functions`, `verify_jwt: true`) : `notify-client`
  (e-mails projet) et `sign-code` (code de signature). Envoi par l'API Brevo, expéditeur « DZOFT ».
  Secrets : `BREVO_API_KEY`, `SENDER_EMAIL`. Redéployer après chaque modification du code.
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
- Recoller les modèles d'e-mails Supabase et mettre le nom d'expéditeur SMTP sur DZOFT.
- Fiche Google : produits, lien de réservation, premier post.
- Revolut Pro : nom commercial DZOFT. Médiateur de la consommation (CM2C).
- Liste de prospects locaux + kit de prospection : en pause, à sa demande.
- Devis D-2026-001 (Rodney) : brouillon, il en parle d'abord avec lui.
