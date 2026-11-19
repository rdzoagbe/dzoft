# Calculateur de devis initial — DZOFT (19 novembre 2026)

## Où se trouve le nouveau parcours

**Admin → Devis → ouvrir/créer un devis → « Calculer un devis »**. Le bouton ouvre
un panneau privé, en dehors du PDF officiel. Il est désactivé pendant le chargement
d'un devis existant et sur un devis déjà accepté. Aucun message, devis complémentaire,
reçu ou facture n'est créé par le calculateur.

**Admin → Devis → Catalogue et tarifs** contient désormais, pour chaque prestation :
- Nom, description, prix et mots-clés ;
- Position dans les forfaits : **toujours en supplément**, **inclus dans PWA**,
  **inclus dans application mobile**, ou **inclus dans les deux** ;
- Un formulaire d'ajout de prestation, avec validations des prix et noms.
Les anciens éléments sans position sont **toujours en supplément** par défaut :
on ne suppose jamais gratuitement qu'ils étaient compris.

Ces champs complètent les objets existants de `settings.price_blocks` (JSONB),
sans migration de schéma ni modification des numéros de factures. Le calculateur
de **suppléments après signature** conserve ses propres prix et son contrôle de
consentement : l'étiquette « inclus » ne rend pas un supplément déjà approuvé gratuit.

## Fonctionnement

1. Choisir le forfait (PWA, application mobile, site vitrine ou page de présentation).
   Les montants de base reprennent les lignes du modèle de devis existant.
2. Coller ou saisir la demande du client. « Analyser la demande » compare uniquement
   les mots-clés de la liste de prix ; **aucun modèle IA n'invente le périmètre ni le prix**.
3. Relire séparément les demandes **incluses dans le forfait** (0 € en plus)
   et les **prestations supplémentaires** (prix du Catalogue). Rien n'est déduit
   automatiquement pour les demandes inconnues. Celles-ci doivent être chiffrées
   manuellement dans le devis ou ajoutées au Catalogue.
4. Cocher les éléments à intégrer. Par sécurité les suppléments ne sont pas
   précochés ; les prestations reconnues incluses sont proposées cochées.
5. « Ajouter au devis » remplit les lignes classiques du devis courant et recalcule
   les totaux existants, avec TVA et acompte appliqués par l'éditeur historique.
   Les éléments inclus sont documentés dans des lignes à 0 € ; les extras apparaissent
   à leur tarif. Le texte et les lignes restent modifiables par le propriétaire.

### Protections

- **Pas de réécriture d'un contrat accepté** et pas de migration financière.
- Aucune écriture de donnée en ouvrant, analysant ou annulant le panneau.
- Refus d'appliquer lorsque la liste de prix n'est pas accessible, lorsque le devis
  est signé/en chargement ou qu'un forfait incompatible est déjà présent.
- Les éléments déjà présents ne sont pas facturés une deuxième fois.
- Les modifications de prix au Catalogue ne recalculent pas les devis historiques.
- L'enregistrement du devis suit le circuit existant d'édition locale ou Supabase.
  Une fois accepté, l'avenant reste le seul circuit pour facturer de nouvelles demandes.
- La liste de prix ne remplace pas un contrat ni un expert-comptable.
- Les services de publication (hébergement, comptes de stores, SMS, tiers) ne sont
  pas ajoutés au devis à l'insu du propriétaire.

### À vérifier avant usage avec de vrais clients

- Ajouter 2 ou 3 prestations avec descriptions, prix, périmètres et mots-clés,
  puis confirmer les classifications sur un **brouillon** de devis.
- Vérifier à l'écran et dans le PDF le total à payer, l'acompte, la TVA et les lignes
  incluses à 0 €. Les bases du devis existant sont actuellement des modèles à
  200 €, 400 €, 700 € et 1 500 € ; les tarifs contractuels peuvent être adaptés
  manuellement dans l'éditeur avant toute signature.
- Confirmer sur un navigateur authentifié que l'éditeur charge et enregistre les
  mêmes données qu'avant ; vérifier les affichages à 390 px.
- Ne jamais utiliser un projet client signé ni une facture officielle comme
  jeu de test.

## Tests

- `tests/initial-quote-pricing.test.cjs` : classification explicite par forfait,
  refus des prix invalides, limites de correspondance, garde du devis signé et
  persistence du Catalogue existant.
- `e2e/initial-quote-pricing.spec.mjs` : analyse, sélection, annulation,
  erreurs du Catalogue, verrouillage, aperçu sur téléphone, sans identifiants client.
- CI UI et Chromium existante : données synthétiques uniquement ; un passage au
  vert n'est **pas** une validation authentifiée en production.
