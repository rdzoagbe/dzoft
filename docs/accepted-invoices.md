# DZOFT : factures créées depuis ce que le client a accepté

## À quoi ça sert

Créer une facture officielle en un clic, sans saisir ni montant ni numéro, puis l’envoyer au client.
Le montant vient toujours de ce que le client a accepté :

| Facture | D’où vient le montant | Quand le bouton apparaît |
|---|---|---|
| **Facture de solde** | Devis accepté, moins ce qui est déjà facturé et les paiements reçus en attente de facture | Projet accepté, tant qu’aucune facture de solde n’existe |
| **Facture complémentaire** | Supplément de la proposition approuvée par le client | Demande de modification approuvée **et** travaux marqués terminés, supplément > 0 |

Les **factures d’acompte** ne changent pas : elles sont émises quand l’acompte est reçu
(« Générer une facture » sur le paiement).

## Pourquoi ces règles

Code général des impôts, article 289 (lu sur Légifrance le 15 novembre 2026) : la facture est
« émise dès la réalisation de la livraison ou de la prestation de services », et une facture est due
« pour les acomptes qui lui sont versés ». D’où : solde à la livraison, complément quand les travaux
sont terminés, acompte quand il est versé. Ce n’est pas un avis d’expert-comptable : faire valider
les mentions obligatoires et les échéances par un professionnel.

## Parcours

1. **Complément** : fiche projet → « Demandes de modification » → « ＋ Proposer un complément au client »
   (ou le client fait sa demande depuis son espace, puis DZOFT propose un prix).
2. Le client **approuve lui-même** la proposition dans son espace (case à cocher + nom). Rien n’est dû avant.
3. DZOFT clique « Démarrer les travaux », puis « Marquer les travaux terminés ».
4. « Créer la facture complémentaire » : numéro officiel de la série F-AAAA-NNNN, PDF archivé dans le
   stockage privé du client, facture visible dans son espace.
5. Une fenêtre propose l’envoi par e-mail avec le PDF joint. Sinon : bouton « Envoyer au client » au-dessus
   de « Factures officielles et détails ».
6. Paiement reçu : « Enregistrer un paiement reçu » en choisissant cette facture, comme d’habitude.

## Garde-fous

- Le navigateur n’envoie jamais de montant ni de numéro : `issue_accepted_invoice(p_quote, p_basis, p_change)`
  les calcule côté serveur, réservé au propriétaire (`is_owner()`).
- Une seule facture de solde par devis, une seule facture par demande approuvée ; un second clic renvoie la
  facture déjà émise.
- `quotes.accepted_total` n’est jamais modifié. Le suivi affiche « devis accepté + compléments facturés »
  (`project_tracking` : `total`, `base_total`, `supplements`).
- Une facture complémentaire ne consomme pas le plafond du devis d’origine (les contrôles existants
  ignorent les factures marquées `change`).
- Une facture émise ne peut plus être retirée ni modifiée par un enregistrement de la page
  (déclencheur `dzoft_issued_invoice_amounts`), et son PDF archivé est immuable.
- Aucun e-mail ne part à la création : l’envoi reste un geste du propriétaire.
- La proposition ouverte par DZOFT (`owner_create_change_proposal`) reste une proposition : seul le client
  peut l’approuver.

## Vérification

- `tests/issue-accepted-invoices.test.cjs` : règles côté page et côté SQL, génération du PDF sans paiement.
- `tests/issue-accepted-invoices.sql` : scénario complet dans une transaction annulée (rien n’est conservé).
- Ordre de mise en service : migration `20261115190000_issue_accepted_invoices.sql` → test SQL → mise en ligne des pages.

## Factures à montant ajustable — préparation avant émission (15 novembre 2026)

Depuis la fiche projet, la carte **Factures** propose maintenant un champ **Montant à facturer (€)**. Le serveur calcule le plafond en déduisant les factures existantes et les paiements reçus encore non facturés ; le navigateur charge ce montant. Le propriétaire peut uniquement **le réduire avant émission** pour créer une facture intermédiaire, ou garder la totalité pour créer la facture de solde. Une facture complémentaire garde strictement le montant expressément approuvé par le client. Les factures d'acompte restent liées aux encaissements vérifiés.

Le nouveau numéro officiel `F-AAAA-NNNN` est alloué uniquement par la base PostgreSQL et verrouillé dans la même transaction que la facture. Une clé de requête unique empêche les doublons de facture intermédiaire lors des relances. Une fois émise, la facture conserve **définitivement son montant et son numéro**, y compris les factures liées à un encaissement. Les ajustements postérieurs se traitent selon le cas par facture rectificative/avoir, après avis comptable ; ils ne modifient jamais silencieusement le document historique.

Le bouton **Envoyer le PDF + ma copie** enfile un e-mail pour le client **et un autre pour l'adresse du propriétaire configurée dans les notifications**, chacun avec la facture PDF du stockage privé en pièce jointe (7 Mo maximum). Si le PDF n'est pas archivé, l'envoi est désactivé et il faut l'archiver d'abord. Le texte « envoi demandé » ne prouve pas une livraison ; le suivi affiche séparément « en cours », « accepté par le fournisseur », « livré » ou « échec ». L'historique détaillé conserve les deux destinataires.

### Mise en service

Ne pas livrer l'interface révisée avant application de la migration `20261115221000_interim_invoice_amount_preview.sql`, validation du schéma, des droits des RPC, des tests de non-régression, et contrôle des configurations d'envoi et de l'adresse de notification du propriétaire. La migration ne crée aucune facture, ne modifie aucun prix accepté et n'expédie aucun e-mail.

## Compléments chiffrés et signés (17 novembre 2026)

Migration `20261117090000_priced_change_proposals.sql`, fonction Edge `change-sign-code`.

1. **Chiffrer** : fiche projet → « ＋ Créer un supplément » → « ＋ Proposer un complément chiffré ».
   Lignes depuis « Ma liste de prix » (avec repérage dans le texte de la demande) ou lignes libres ;
   quantité × prix unitaire, total affiché. Le serveur recalcule le total (`private.change_lines_total`)
   et numérote la proposition `<n° du devis>-C1`, `-C2`… Une demande envoyée par le client se chiffre
   de la même façon (`owner_price_change_request`, nouvelle version : un ancien code ne vaut plus).
2. **Envoyer** : « Envoyer au client par e-mail » (`owner_send_change_proposal`) met un e-mail en file
   (`change_proposed`, lien vers l’espace client). Chaque clic envoie un e-mail.
3. **Signer** : dans son espace, le client lit les lignes, coche son accord, reçoit un code à 6 chiffres
   par e-mail (`change-sign-code`, même règles que la signature du devis : adresse de sa fiche, 10 min,
   5 essais, 3 codes / 15 min) et signe (`my_sign_change_request` / `portal_sign_change_request`).
   Sans code, l’approbation est refusée par le serveur ; le refus reste possible sans code.
   DZOFT reçoit un e-mail `change_signed`.
4. **Facturer** : « Marquer les travaux terminés » (directement si « travaux déjà réalisés »), puis
   « Créer la facture complémentaire » : la page de facturation s’ouvre et émet la facture du montant
   signé, avec les lignes et la mention de la signature par code sur le PDF, puis propose l’envoi.

Liste de prix : `settings.price_blocks` (propriétaire seulement). Tests : `tests/priced-change-proposals.sql`.

### « ⚡ Calculer depuis le suivi du projet » (17 novembre 2026)

Migration `20261117120000_change_lines_from_journal.sql`.

- Reprend les entrées « demande du client » du journal privé, datées depuis la signature du devis et marquées
  « fait » ; une ligne par demande (« Demandé et réalisé le … »). Les demandes « pas encore construites » sont
  listées à part, jamais facturées.
- Prix : liste de prix (mots repérés), sinon « prix par défaut d’une demande » (réglage), sinon vide et en rouge :
  il faut le saisir avant de créer la proposition.
- Chaque ligne garde son origine (`journal:<date>:<empreinte>`) : une demande déjà dans une proposition vivante
  (ni refusée, ni retirée) n’est plus reprise.
- « － Remise commerciale » ajoute une ligne négative ; le total doit rester positif (contrôlé par le serveur).
- L’activité Git (`project_work_items`) n’est donnée qu’en indication (nombre de jours de travail) : elle ne dit ni
  ce qui a été fait fonctionnalité par fonctionnalité, ni ce qui était prévu au devis.
- À vérifier avant l’envoi : retirer ce que le devis couvrait déjà ou ce qui venait de DZOFT (ex. vidéo, nom).

### Niveaux de prix (17 novembre 2026)

Migration `20261117150000_price_tiers.sql`. Chaque ligne porte un niveau ; le client voit sous la ligne le niveau et sa règle.

| Niveau | Règle montrée au client | Prix par défaut |
|---|---|---|
| Retouche | texte, couleur ou taille, sans nouvelle logique | 10 € |
| Petite évolution | un écran ou un comportement, sans nouvelle donnée | 25 € |
| Évolution moyenne | nouvelle donnée ou plusieurs écrans, avec tests | 50 € |
| Évolution importante | donnée protégée côté serveur (confidentialité ou sécurité), plusieurs écrans, tests | 100 € |
| Offert | proposé par DZOFT, non facturé | 0 € |
| Inclus (journal seulement) | prévu au devis, ou correction | jamais facturé |

Prix proportionnels au premier devis client signé (le détail reste hors du dépôt).
Modifiables dans « Ma liste de prix ». Dans le journal privé, une entrée « demande » peut porter
`lvl` (clé de niveau ou `inclus`), `qty` et `why` (preuve : commits, base de données, tests) : « Calculer depuis
le suivi » s’en sert. L’assistant renseigne ces champs quand il ajoute une demande réalisée au journal.
