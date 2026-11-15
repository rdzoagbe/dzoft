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
