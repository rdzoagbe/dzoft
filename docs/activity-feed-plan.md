# Plan : fil d’activité de la fiche projet (à faire après le test pilote du 14 novembre 2026)

Décidé avec Roland le 13 novembre 2026. Outil interne DZOFT : ne touche le devis d’aucun client.

## Étape 1 : le fil
- Dans « Travaux & demandes » de la fiche projet (`admin/suivi.html`), un seul fil, du plus récent au plus ancien.
- Sources :
  - événements déjà enregistrés (`project_events` : devis accepté, étape validée, message, fichier, facture, avis) ;
  - actions de Roland (tâche mise à jour, paiement confirmé), avec la date et l’auteur ;
  - entrées du journal privé (`quotes.journal`), reprises dans le même fil pour n’avoir qu’un endroit à regarder ;
  - changements publiés sur le dépôt GitHub public d’un projet (adresse du dépôt saisie sur la fiche) ;
  - résultat de chaque mise en ligne : « Publié » ou « Mise en ligne échouée », affiché à part.
- GitHub : lecture de l’API publique par une fonction planifiée (toutes les quelques minutes), sans clé secrète dans le
  dépôt du client. Le fil peut donc avoir quelques minutes de retard.
- Tout ce qui vient de GitHub reste privé : jamais dans l’espace client, jamais d’e-mail automatique.

## Étape 2 : avancement par fonction et résumé pour le client
- Chaque fonction suit : Prévu → En cours → Construit → Testé → Validé par le client.
- Règle : publier du code ne vaut jamais validation. Seul Roland, ou le client dans son espace, passe à « Validé par le client ».
- Résumé pour le client : Roland choisit des éléments du fil, relit un brouillon court et sans jargon, puis l’envoie lui-même.
- Le fil indique pour chaque élément si le client a été informé.

## À vérifier avant de livrer
- Test : aucune fonction côté client (`my_*`, `portal_*`) ne renvoie le fil privé.
- Rendu ordinateur et téléphone (390 px), données fictives.
- Limites de l’API publique GitHub (nombre d’appels par heure) : garder un intervalle raisonnable et mettre en cache.
