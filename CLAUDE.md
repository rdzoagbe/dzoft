# DZOFT : site, espace client et outil de gestion

Roland Dzoagbe a demandé (10 nov. 2026) des réponses en anglais, simples et sans jargon ; le site et l’admin restent en français.
Fusion (18 nov. 2026, choix de Roland) : quand tout est vert (CI, revue traitée, tests locaux), fusionner sans attendre son accord
et le prévenir ensuite ; demander d’abord pour ce qui touche ses comptes, les règles d’argent ou les textes juridiques. Il valide ce qui touche
à ses comptes (Google, Supabase, Revolut, OVH…) ; toi, tu fais le code et tu le guides pas à pas.

## L'entreprise
- **DZOFT** est le nom commercial de **Roland Dzoagbe, entrepreneur individuel** (micro-entreprise),
  93140 Bondy. SIREN 104 838 727, SIRET 104 838 727 00014. TVA non applicable, art. 293 B du CGI.
- Contact public : roland.dzoagbe@hotmail.com · 07 82 88 46 46 (WhatsApp). Choix de Roland (9 nov. 2026) :
  la même adresse partout (site, mentions, PDF). C’est aussi l’identifiant admin : le second facteur est indispensable.
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
  Un seul chemin (18 nov. 2026) : bouton principal « Envoyer ma demande », WhatsApp en second, « ou par e-mail » en simple lien ;
  colonne de droite = rendez-vous, téléphone, WhatsApp, e-mail. Carte de visite (recto/verso), contact .vcf et carte PDF sont sur
  « À propos » (`a-propos.html`, `en/a-propos.html`) ; la fiche de remise reste liée dans le brief et sur Méthode.
  Accueil (18 nov. 2026) : réalisations = Ahenora en avant (produit réalisé), puis StackLens, puis Le Fournil (démonstration, signalée).
  Accueil (21 nov. 2026, demande de Roland) : bloc « Une nouvelle idée en cours de route ? » sous les prix (3 étapes : le devis dit tout,
  le prix d’abord par écrit, rien sans votre « oui » écrit — 100 € / devis complémentaire, oral sans effet), lien CGV article 3 ;
  même règle dans Services, Méthode et FAQ (FR/EN). À garder aligné sur l’article 3 des CGV. Test `tests/extras-explained.test.cjs`.
- CGV version 2026-12 (21 nov. 2026, demande de Roland après un supplément contesté) : le devis liste ce qui est compris, accord écrit
  avant tout supplément (simple réponse écrite jusqu’à 100 €, devis complémentaire signé au-delà), demandes orales sans effet tant
  qu’elles ne sont pas confirmées par écrit, barème indicatif, livraison = version finale remise pour vérification (14 jours), sans
  attendre Apple ou Google. Versions archivées : `cgv-2026-10.html`, `cgv-2026-11.html` (+ `en/`) ; un devis signé garde sa version
  (`accepted_terms`). Nouvelle version = archiver l’actuelle, changer `TERMS` dans `espace/index.html`, compléter `OLD_TERMS` et les
  tests `tests/scope-change-terms.test.cjs`. Texte à faire relire par un juriste. Formulaire de devis : fonctions indispensables,
  comptes utilisateurs, mise en ligne, qui valide.
  Éditeur de devis (21 nov. 2026) : bloc « Ce devis ne comprend pas » (`f.excl`, une ligne par élément, boutons d’ajout rapide
  `EXCL_PRESETS`), repris dans la vue du client et le PDF du devis signé (version figée à la signature) ; vide = non imprimé.
- `cgv.html` · `confidentialite.html` · `404.html` ·
  `demos/{boulangerie,coiffure,plombier}/` (sites fictifs, `noindex`, bandeau `.demo`).
- `en/` : version anglaise page à page (index, services, methode, faq, realisations, cgv,
  confidentialite ; sélecteur « FR | EN » en haut à droite, balises hreflang, sitemap).
  **Toute modification de texte sur une page du site doit être reportée dans `en/`.** Dans le formulaire anglais, les valeurs envoyées restent en français (admin) ;
  seuls les libellés sont traduits. `en/cgv.html` : traduction des CGV, pour information (bandeau :
  la version française fait foi), idem `en/confidentialite.html` ; **toute modification de `cgv.html` ou
  `confidentialite.html` doit être reportée dans `en/`**. Démos : en français seulement.
- `espace/` espace client (connexion par compte ou par lien secret `#<portal_token>`) :
  devis signé avec un code e-mail, avancement, validation des étapes, factures, documents,
  messages, suivi mensuel, avis (+ renvoi vers l'avis Google, proposé quelle que soit la note).
  Bilingue FR/EN (17 nov. 2026) : les phrases avec nom, montant ou date s’écrivent `L('français', 'English')`, l’écran
  est redessiné au changement de langue ; les libellés fixes passent par `assets/dzoft-language.js`. Le devis lui-même
  (`quoteView`) reste en français (fait foi) ; en anglais, les textes de signature montrent la traduction et le texte
  français « fait foi ». Les contenus saisis (noms de projet, notes, messages) restent tels quels (`data-no-translate`).
  Accueil : prochaine action, projet en cours (dernière avancée, « À régler maintenant »), accueil pas à pas pour un
  nouveau client. Fiche projet en onglets `#/projets/<id>[/avancement|/paiements|/documents]` (Vue d’ensemble ·
  Avancement et demandes · Paiements · Documents) ; Paiements : convenu, reçu, reste, à régler maintenant (factures
  ouvertes moins paiements confirmés). Mon compte : coordonnées, facturation du dernier devis, demande de correction,
  langue. Test `tests/client-portal-language.test.cjs`.
  Langue du client enregistrée sur sa fiche (`clients.lang` fr|en, `my_set_language` / `portal_set_language`) : les
  e-mails envoyés plus tard la suivent (projet : `eventCopyEn` dans `process-notification-outbox` ; relance de paiement :
  langue du client par défaut ; codes de signature : langue envoyée par la page). Les copies de Roland restent en français,
  les e-mails de paiement restent bilingues. Lien privé (sans compte) : chiffres et avancées via `portal_project_tracking`.
  Tout texte saisi s’affiche avec `raw()` (jamais réécrit par le dictionnaire). Tests `tests/client-email-language.test.cjs`,
  `tests/client-language-portal.sql`.
  Documents (17 nov. 2026) : d’abord « Documents officiels » par projet signé = contrat (devis signé en PDF + CGV acceptées),
  compléments signés, factures, paiements reçus (reçu PDF par paiement) ; puis fichiers du projet, puis fichiers envoyés par le client.
  PDF dessinés dans le navigateur depuis les enregistrements (`assets/dzoft-documents.js`, en français, rien n’est écrit) ;
  un reçu ne remplace jamais la facture. Même onglet dans l’admin (`suivi.html#documents`). Test `tests/official-documents.test.cjs`.
- `admin/` espace privé : `index.html` tableau de bord, `suivi.html` fiche projet,
  `devis.html` éditeur de devis ; `admin/sb.js` client Supabase partagé (`window.RDsb`).
  Une seule page par projet (17 nov. 2026) : `suivi.html`, cinq onglets Vue d’ensemble · Travail · Argent (factures, paiements,
  suppléments, suivi mensuel) · Documents · Messages ; au-dessus, des actions (Enregistrer un paiement, Publier une avancée,
  Écrire au client, Ajouter un supplément). Vue d’ensemble et documents officiels : `admin/project-summary.js` (lecture seule,
  chiffres du serveur ; suivi.html lui passe ses données par `window.DzoftProjectData`). `projet.html` ne fait plus que rediriger
  les anciens liens vers le bon onglet. Même menu partout (`editor-navigation.js` reprend `workspace-nav-v6.js`).
  Test `tests/admin-one-project-page.test.cjs`.
  Menu de la fiche projet et de l’éditeur sur téléphone (≤ 950 px, 18 nov. 2026) : fermé = `inert` (ni clavier ni lecteur d’écran),
  ouvert = focus dans le menu, Tab y reste, Échap le ferme et rend le focus au bouton ☰ ; jamais `inert` sur ordinateur (e2e).
  Fiche projet : carte « Journal du projet » (13 nov. 2026), privée : entrées datées {d, k, t} (fait, demande du client,
  décision, en attente) dans `quotes.journal`, collage de plusieurs lignes « date | type | texte », jamais renvoyée au client
  (test `tests/project-journal.test.cjs`). Ne jamais y mettre de journal dans le dépôt : il vit dans la base.
  Vue par défaut : frise par jour avec étiquettes de couleur et filtres (tout, fait, demandes du client, décisions, en attente) ;
  « Modifier » ouvre l’édition. L’assistant peut ajouter des entrées directement dans `quotes.journal` (SQL, à la fin d’un travail) ;
  la fiche relit le journal quand la fenêtre revient au premier plan, pour ne pas écraser ces ajouts.
  Brouillon de publication (14 nov. 2026) : `quotes.progress_draft` (privé, jamais renvoyé au client) = `{prepared, updates:[{category,status,summary≤220}], steps:[{t,s,done,d}]}`.
  L’assistant le prépare à la fin d’un travail, à partir du journal ; la fiche pré-remplit « Publier une avancée » et propose les étapes.
  Rien ne part au client sans le bouton « Publier et notifier » ni « Ajouter ces étapes » (test `tests/project-journal.test.cjs`).
  Admin installable sur téléphone (PWA, 10 nov. 2026) : `admin/manifest.webmanifest`, `admin/icons/`,
  `admin/sw.js` (portée `/dzoft/admin/`, ne met AUCUNE donnée Supabase en cache, seulement `admin/offline.html`),
  bouton « Installer l’app » affiché quand le navigateur le propose.
  Boutons rapides du tableau de bord (17 nov. 2026) : Enregistrer un paiement (`suivi.html?q=…#billing/pay`),
  Publier une avancée (`suivi.html?q=…#work/publish`) ; un supplément (`suivi.html?q=…#billing/new-extra`) se lance uniquement par
  « + Nouveau devis ou supplément » (pas de bouton en double, 18 nov. 2026) ; ils demandent le projet s’il y en a plusieurs
  et ouvrent seulement le formulaire, sans rien enregistrer (test `tests/admin-prices-quick-actions.test.cjs`).
  « + Nouveau devis ou supplément » (18 nov. 2026, demande de Roland) : demande d’abord « Nouveau projet » (devis habituel) ou
  « Supplément sur un projet en cours » (choix du projet puis calculateur : calcul depuis le suivi, remise au choix, brouillon à relire,
  « Envoyer au client », signature par code avant toute facture) ; ce choix ne crée ni n’envoie rien (e2e « asks first »).
  Une seule entrée par endroit (choix de Roland) : tableau de bord = ce bouton ; fiche projet = « ＋ Ajouter un supplément » des actions
  du haut (plus de second bouton dans la Vue d’ensemble). Ne pas ajouter de bouton qui refait une action déjà présente sur la même page.
  Nettoyage (18 nov. 2026) : fichiers admin jamais chargés supprimés (`workspace-home.js`, `workspace-panels-v6.js` remplacé par v7),
  redirection désactivée `routeToPrimaryWorkspace` retirée, règles CSS visant des éléments disparus supprimées (rendu identique au pixel
  sur 14 écrans, ordinateur et téléphone). `tests/no-dead-admin-files.test.cjs` : tout script ou style de `admin/` doit être chargé.
  Gardés exprès : logos et icônes de la marque.
  Pas de photo de Roland sur le site (choix de Roland, 18 nov. 2026) : le logo DZOFT (`dzoft-mark.svg`) tient lieu de visage dans
  « Votre développeur, en direct » ; `assets/profile.jpg` supprimé (test `tests/no-personal-photo.test.cjs`).
  Tableau de bord (17 nov. 2026) : chiffres (déjà encaissé dont ce mois-ci, reste à encaisser dont annoncé par le client,
  prêt à facturer = suppléments signés terminés sans facture, total des contrats, projets en cours), « Projets en cours » et « À faire » ;
  plus de « Dossier sélectionné » ni de « Raccourcis » (les outils d’un projet sont dans le projet).
  Menu à 7 entrées (17 nov. 2026, choix de Roland) : Tableau de bord, Clients, Devis, Projets, Comptabilité, Messages, Paramètres,
  identique partout (`workspace-nav-v6.js`, `editor-navigation.js`, menu de l’app installée) ; dans un projet, « Projets » est l’entrée active
  et les rubriques du projet sont ses onglets. Catalogue s’ouvre depuis Devis (« Catalogue et tarifs »). Anciennes adresses redirigées
  (`OLD_ROUTES` : paiements et factures → comptabilite, rapports → tableau-de-bord, journal et documents → projets).
  Comptabilité (`#/comptabilite`, vue `finance`) : chiffres, livre des recettes (paiements confirmés par date : date, client, devis, mode,
  référence, facture ; année, export CSV ; base du livre exigé par l’art. L123-28 du Code de commerce, sans prétendre être le livre officiel),
  soldes par projet, registre des factures. Test `tests/page-navigation-v6.test.cjs`.
  Finitions (17 nov. 2026) : admin au bleu de la charte (anciens violets convertis), barre du téléphone = 4 entrées + « Plus »,
  compteur de corbeille gris.
  Le « À faire » du tableau de bord rappelle : nouvelles demandes, relances (`next_at`), devis
  sans réponse (≥ 5 j) ou expirés, brouillons, acomptes, étapes validées par le client,
  factures de suivi dues, avis à publier, messages non lus.
- « Préparer l’e-mail » (`devis.html`) et « Mon e-mail » (`suivi.html`) ouvrent la boîte Hotmail de Roland (Outlook.com, page de rédaction
  pré-remplie), jamais l’application de messagerie par défaut de l’ordinateur (18 nov. 2026). Test `tests/email-buttons-hotmail.test.cjs`, e2e.
- Boutons Annuler / Retour (18 nov. 2026, choix de Roland : seulement les formulaires qui enregistrent sur un bouton, pas ceux qui
  enregistrent en direct) : activation du code (Annuler supprime le facteur inachevé), Moyens de paiement (Annuler les modifications),
  nouveau mot de passe (Retour à la connexion), tâches (Modifier / Relire et publier), demande de modification du client, signature
  d’une proposition (« Plus tard »), calculateur de supplément et motif de refus (`data-form-cancel` dans `assets/change-requests.js`,
  jamais d’appel au serveur), confirmation avant « + Facture du suivi ». Test `tests/cancel-back-buttons.test.cjs`.
  21 nov. 2026 : « Retirer cette proposition… » / « Ne pas retenir cette demande… » s’ouvre dans son propre volet ; boutons « Retirer la proposition »
  (ou « Ne pas retenir la demande ») et « Fermer sans rien changer » (« Annuler » était compris comme « annuler la proposition ») ;
  la fenêtre « Coller une demande » a son propre id (`m-paste-request`, `m-paste` = bouton du code de connexion) ; le calculateur du devis
  initial ne passe plus sous le menu latéral. Tests `tests/unique-page-ids.test.cjs` (aucun id en double), e2e « Cancel buttons close what they opened ».
- `assets/rd-booking.js` (lien Google Agenda), `assets/rd-reviews.js` (avis publiés),
  `assets/rd-steps.js`, `assets/dzoft-experience.css` (charte de l’espace client et de l’admin),
  `assets/dzoft-studio-pages.css` (style studio de Services, Méthode, FAQ, Devis et leurs versions `en/`), `assets/dzoft-motion.js` (apparitions au défilement, désactivées
  si l’utilisateur réduit les animations), logos `dzoft-*`, polices Sora auto-hébergées dans `assets/fonts`.
- SEO : JSON-LD dans `index.html` et `realisations.html`, `sitemap.xml`, `robots.txt`,
  balise de validation Search Console + `googlefe80f3bfe6ca8091.html`.

## Charte
- Marine `#0B1020`, marine 2 `#16204A`, bleu `#4361EE`, cyan `#22D3EE`, liens `#3448D6`.
- Boutons principaux : `linear-gradient(135deg,#4361EE,#3A4FE0)`, texte blanc.
- Titres Sora 600/700, texte system-ui. Signature : « Digital solutions, built for growth. »
- Textes en français soigné : apostrophe typographique ’, guillemets « », espaces avant : ; ? !

## Supabase (projet `rzghbvmszbjlqkdjzpxc`, Paris)
- Tables : leads, clients, quotes (steps, docs, env, invoices, care, ext_link…), messages,
  notifications, sign_codes, settings, reviews, project_receipts, project_updates. RLS partout.
- Suivi des demandes (`leads.status`) : nouvelle → contactée → devis envoyé → gagnée / perdue,
  plus archivée (« traitée » hérité) ; `leads.next_at` = date de relance, rappelée sur le tableau
  de bord. Côté client, « perdue » s'affiche « Close », jamais le statut interne.
- Conservation des prospects : le filtre « À revoir (3 ans+) » repère les demandes non converties
  arrivées à échéance ; l'archivage est manuel et réversible (`archived_at`, `archive_previous_status`).
  Aucune suppression automatique : examen puis suppression définitive manuels si approprié.
- Modèle des fonctions SQL `SECURITY DEFINER` : `client_*` internes (aucun droit),
  `my_*` pour le client connecté (authenticated), `portal_*` pour le lien secret (anon).
  L'admin est reconnu par son e-mail propriétaire.
- Fonctions Edge (`supabase/functions`) : `notify-client` (compatibilité historique), `sign-code`
  (code de signature) et `process-notification-outbox` (notifications importantes planifiées).
  Envoi par l'API Brevo ; secrets `BREVO_API_KEY`, `SENDER_EMAIL`, URL + clé de projet côté Vault.
  Le worker d'e-mails est déclenché chaque minute par pg_cron, possède son secret dans Vault et
  valide le rôle propriétaire depuis `app_metadata`. Redéployer une fonction après modification.
- Notifications projet : migration `20261030131831_project_email_outbox.sql`. Les actions
  importantes créent un événement et un e-mail dans la même transaction ; le contenu complet
  reste dans le portail. Les messages reçus sont regroupés pour éviter le bruit. Le journal est
  conservé 24 mois. Seul un PDF de facture choisi explicitement peut être joint.
- Paiements reçus et avancement (13 nov. 2026, `assets/project-tracking.js`, fiche projet + espace client) :
  `record_project_payment` enregistre un paiement vérifié sur le compte, en créant si besoin sa facture dans le même geste
  (paiements partiels, pas de doublon, pas de dépassement ; la facture passe « réglée » au solde ; e-mail au client
  facultatif pour ressaisir un paiement ancien) ; `record_project_receipt` (ancien appel) passe par la même fonction ;
  la carte se traduit elle-même (FR/EN, `data-no-translate`) ; `project_tracking` donne total, reçu, reste.
  Avancement : la fiche publie 1 à 6 groupes (Design, Comptes, Lieux, Conversations, Sécurité, Autres travaux ;
  état Prévu / En cours / Construit / Testé) d’un coup via `publish_project_updates` (`batch_id`) :
  une seule mise à jour dans le portail et UN seul e-mail (`progress_digest`), pour ne pas noyer le client.
  « Testé » = vérifié par DZOFT, jamais « validé par le client ». Test : `tests/project-tracking.sql`.
- Factures créées depuis ce que le client a accepté (15 nov. 2026, `docs/accepted-invoices.md`) : `issue_accepted_invoice` émet la
  facture de solde du devis accepté (à la livraison) ou la facture complémentaire d’une demande de modification approuvée dont les
  travaux sont terminés ; le serveur calcule montant et numéro (série F-AAAA-NNNN), la page archive le PDF puis propose l’envoi.
  Les factures d’acompte restent émises à réception du paiement (CGI art. 289).
  Envoi d’une facture (18 nov. 2026) : à la création, puis via « Envoyer (e-mail ou WhatsApp) » visible sur chaque facture, une fenêtre
  propose l’e-mail (PDF archivé + copie de Roland, file d’envoi habituelle) et/ou WhatsApp (message prêt, FR/EN, lien vers la facture
  dans l’espace client, Roland appuie sur Envoyer) ; rien ne part sans « Envoyer ». « Relancer le paiement (e-mail ou WhatsApp) » est
  aussi visible sur chaque facture impayée. Test e2e « Invoice send window ».
  Avoirs (18 nov. 2026, migration `20261118120000_credit_notes.sql`) : une facture émise ne se modifie ni ne se supprime ;
  « Annuler ou réduire (avoir) » sur chaque facture émise par DZOFT (reste à payer > 0) émet un avoir `issue_credit_note`
  (série A-AAAA-NNNN, cite numéro et date de la facture, motif obligatoire, total ou partiel, jamais plus que le reste impayé,
  immuable). Deux effets : « le client doit moins » (`reduce`, baisse le montant du projet) ou « erreur sur la facture »
  (`reissue`, facture entière sans paiement, libère la place pour la facture corrigée). `project_tracking` renvoie
  `credits` et `credit_notes` ; paiements et soldes en tiennent compte. PDF `DzoftDocuments.creditNote`, listé dans
  Documents (admin et client) et « Registre des avoirs » (Comptabilité). Tests `tests/credit-notes.{sql,test.cjs}`, e2e. `owner_create_change_proposal` : DZOFT ouvre
  lui-même une proposition, que seul le client peut approuver. Tests `tests/issue-accepted-invoices.{test.cjs,sql}`.
- Compléments chiffrés (17 nov. 2026, `docs/accepted-invoices.md`) : calculateur dans « Créer un supplément » (lignes ×
  prix, liste de prix `settings.price_blocks`), numéro `<devis>-C<n>` et total calculés par le serveur, « Envoyer au client »
  (e-mail `change_proposed`), signature du client par code e-mail (fonction Edge `change-sign-code`, aucune approbation sans
  code), puis facture complémentaire du montant signé. Test `tests/priced-change-proposals.sql`.
  Brouillon jusqu’à l’envoi (17 nov. 2026, migration `20261117200000_change_proposal_draft_until_sent.sql`) : une proposition
  chiffrée reste un brouillon visible par Roland seul (`sent_at` vide) ; le client ne la voit pas (sa propre demande reste
  « à l’étude », sans prix), ne peut ni recevoir de code ni la signer avant « Envoyer au client » ; la rechiffrer en refait un
  brouillon. Reste privé même retiré ou refusé sans avoir été envoyé (migration `20261117210000_…`).
  Tests `tests/change-proposal-draft.test.cjs`, `tests/change-draft-private-after-close.sql`.
  Archives (21 nov. 2026, demande de Roland) : une proposition retirée, non retenue ou refusée par le client n’est jamais supprimée ;
  elle passe sous « Archives (n) », section fermée en bas de la liste (admin et client), avec numéro, motif et historique. E2e « archived ».
  « ✎ Modifier ce brouillon » (18 nov. 2026) : un brouillon non envoyé se modifie sur place (lignes, prix, remise ; même numéro,
  reste brouillon, `owner_price_change_request`) ; Annuler remet ses lignes enregistrées. E2e « edited in place ».
  Textes envoyés au client toujours en français, quelle que soit la langue de l’admin (« Remise commerciale », titre par défaut).
  « ⚡ Calculer depuis le suivi » reprend les « demande » du journal réalisées depuis le dernier supplément en cours ou signé
  (sinon depuis la signature ; les plus anciennes sont listées à part, jamais ajoutées) ; « Du … Au … » (18 nov. 2026) permet de choisir la période (Au vide = aujourd’hui) ; les demandes déjà dans une autre proposition, brouillon compris, sont nommées avec cette proposition ; « Remise commerciale » en pourcentage des lignes (montant en euros calculé et envoyé, libellé « (10 %) ») ; niveaux de prix
  `settings.price_tiers` (retouche 10, petite 25, moyenne 50, importante 100, offert 0 ; « inclus » jamais facturé).
  En ajoutant une demande réalisée au journal, renseigner `lvl`, `qty` et `why` (commits, base, tests) d’après ces règles.
  Origine du prix (17 nov. 2026) : niveau noté au journal, sinon prestation de la liste dont les mots sont dans la demande, sinon prix par défaut ;
  une note privée sous chaque ligne le dit (jamais envoyée). Prix et quantités acceptent la virgule ; « Prix libre » vide le prix ; sur téléphone,
  chaque ligne tient dans l’écran (test `tests/calculator-free-price.test.cjs`).
  « Mes tarifs » (niveaux, prestations connues, prix par défaut) se modifie uniquement dans Catalogue (Prestations)
  (`admin/#/catalogue`, `DzoftChanges.prices`) ; le calculateur du projet les lit et renvoie vers cette page (17 nov. 2026).
- Sécurité client : la liaison d'un compte révoque le jeton d'accès secret ; les RPC publiques
  n'acceptent ces jetons que pour les fiches sans compte. Les codes de signature sont réservés
  sous verrou SQL avant l'envoi, afin que les quotas résistent aux appels simultanés.
- L'administrateur doit porter le marqueur Auth `app_metadata.dzoft_owner=true` (jamais
  `user_metadata`). L'interface et les fonctions vérifient ce rôle et le MFA (code TOTP ou clé d’accès
  WebAuthn, au choix, redemandé tous les 7 jours sur le même navigateur, choix de Roland du 18 nov. 2026 (auparavant 12 h) ; test `tests/owner-mfa-window.test.cjs` : `is_owner()`, `admin/sb.js` `mfaFresh`, `notify-client`).
  Clés d’accès en second facteur : code prêt mais masqué (`PASSKEY_MFA = false` dans `admin/index.html`),
  car Supabase hébergé ne permet pas encore le facteur MFA `webauthn` (nov. 2026 : Multi-Factor = TOTP et SMS
  seulement). Passer à `true` quand Supabase l’ouvrira ; RP ID `rdzoagbe.github.io`, à refaire si le domaine change.
- `supabase/schema.sql` : copie de référence du schéma (tables, index, RLS, fonctions SQL,
  stockage, déclencheurs, droits), régénérée depuis la base réelle le 2026-11-17 ; à régénérer après toute migration.
- Sauvegardes : le schéma est dans Git, pas les données. Conserver les exports JSON chiffrés
  hors du dépôt public et les mettre à jour après chaque signature ou changement important.
  Sauvegarde rapide (18 nov. 2026) : Paramètres › Sauvegardes et données › « Télécharger la sauvegarde chiffrée »
  (`admin/backup.js`) : `owner_backup_export()` (propriétaire + second facteur ; sans `portal_token` ni `sign_codes`), chiffrement
  dans le navigateur (PBKDF2-SHA-256 310 000 tours → AES-256-GCM, mot de passe jamais envoyé), fichier `.dzoftbak` ;
  « Vérifier une sauvegarde » l’ouvre localement. L’export lit tout en une seule requête (instantané cohérent) et n’enregistre rien ;
  la page appelle `owner_backup_confirm()` une fois le fichier chiffré et téléchargé (migration `20261118170000_…`). Journal privé `private.owner_backup_log` ; `owner_backup_status()` alimente le
  rappel « Sauvegarde » de « À faire » (aucune, plus vieille qu’une signature / un paiement / une facture / un avoir, ou > 30 jours).
  Google Drive (18 nov. 2026, demande de Roland) : « Sauvegarder sur Google Drive » envoie le même fichier chiffré dans le dossier
  « DZOFT – Sauvegardes » de son Drive (Google Identity Services, portée `drive.file` : seulement les fichiers créés par DZOFT) ;
  réglage unique « Relier Google Drive » = ID client OAuth (public, colonne `settings.google_client_id`, migration `20261118180000_…`),
  à créer dans son compte Google Cloud : guide `docs/google-drive-backup.md` (origine `https://rdzoagbe.github.io`, à compléter si
  le domaine change). Jamais de « client secret ». « Télécharger le fichier chiffré » reste possible. E2e « Google Drive backup ».
  Pas de restauration depuis le site (volontaire). La sauvegarde complète Windows (`tools/backup-dzoft-windows.ps1`, PDF et comptes
  de connexion compris) reste à part. Tests `tests/owner-backup.sql`, e2e « Quick backup ».
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

## Prévu
- Fil d’activité de la fiche projet (événements, journal, changements GitHub, mises en ligne, avancement par fonction,
  résumé relu avant envoi au client) : plan dans `docs/activity-feed-plan.md`, à commencer après le test pilote du 14 novembre 2026.

## En attente côté Roland
- Nom de domaine `dzoft.fr` + `dzoft.com` (libres, chez OVHcloud) : plus tard, quand le premier
  client aura payé. Ensuite : fichier `CNAME`, DNS, remplacer l'adresse partout, e-mail
  contact@dzoft.fr, expéditeur Brevo sur le domaine.
- Médiateur de la consommation (CM2C) : adhésion, puis compléter l'article 16 de `cgv.html`
  (nom, site et adresse du médiateur, actuellement « à compléter »).
- Prospection locale : kit + liste de départ (Bondy : boulangeries, coiffeurs, plombiers,
  sans site d'après PagesJaunes) livrés le 2026-10-28 en privé, volontairement HORS du dépôt
  (public). À lui de contacter ; vérifier chaque fiche sur Google avant contact.
- Le dépôt GitHub est public : ne jamais y inscrire de nom de client, contenu de devis,
  export de données, adresse de compte privé ou identifiant secret. Garder les notes commerciales
  et les sauvegardes hors Git.

