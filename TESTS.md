# TESTS — Elexio

Cas de test **manuels**. À dérouler avant chaque version.
État au 9 octobre 2026 : aucun cas déroulé automatiquement (pas de framework de test installé).

## T1 — Démarrage

| # | Action | Attendu |
|---|---|---|
| T1.1 | `npm start` | Fenêtre ouverte, onglet « Informations » actif, barre d'état « Prêt. » |
| T1.2 | Fermer / relancer | Aucune erreur en console |

## T2 — Onglet Informations

| # | Action | Attendu |
|---|---|---|
| T2.1 | Remplir chantier, occupant, installateur, dessinateur | Valeurs conservées en changeant d'onglet |
| T2.2 | Passer « Type d'alimentation » à Triphasé | En-tête du schéma passe en « triphasé » |
| T2.3 | Laisser des champs vides | Règle BE-08 signale les informations manquantes |

## T3 — Circuits

| # | Action | Attendu |
|---|---|---|
| T3.1 | « + Ajouter un circuit », type « Prises de courant » | Circuit créé avec protection 16 A courbe C et DDR 30 mA |
| T3.2 | Renommer le circuit | Nom propagé dans la liste, le schéma et la BOM |
| T3.3 | Créer 2 circuits de même nom | Règle BE-05 signale le doublon |
| T3.4 | ↑ / ↓ dans la liste | Ordre des colonnes inversé dans le schéma |
| T3.5 | Supprimer un circuit | Circuit et composants retirés, BOM à jour |

## T4 — Symboles et glisser-déposer

| # | Action | Attendu |
|---|---|---|
| T4.1 | Glisser « Disjoncteur » sur un circuit | Symbole ajouté, repère `Q1` |
| T4.2 | Ajouter un 2e disjoncteur | Repère `Q2` (auto-incrémenté) |
| T4.3 | Déposer un symbole hors d'une colonne | Refus avec message en barre d'état |
| T4.4 | Clic sur un symbole de la palette | Ajouté au dernier circuit |
| T4.5 | Glisser plusieurs symboles | Ordre vertical respecté, liaisons dessinées |
| T4.6 | Verrouiller un repère, ajouter un autre symbole | Le repère verrouillé ne change pas |
| T4.7 | Sélectionner un symbole, <kbd>Suppr</kbd> | Symbole retiré du circuit et de la BOM |

## T5 — Zoom et déplacement

| # | Action | Attendu |
|---|---|---|
| T5.1 | Molette vers le haut | Zoom avant, libellé de pourcentage à jour |
| T5.2 | Molette vers le bas | Zoom arrière |
| T5.3 | Alt + glisser | La vue se déplace |
| T5.4 | Bouton « Ajuster » | Retour à la vue complète |

## T6 — Triphasé

| # | Action | Attendu |
|---|---|---|
| T6.1 | Passer le projet en triphasé | Trois bus L1/L2/L3 + marqueur `3~` |
| T6.2 | Circuit en phases 3 | Marqueur ×N et `3~` sur chaque symbole |
| T6.3 | Mettre tous les circuits sur L1 | Avertissement de déséquilibre |
| T6.4 | Répartir L1/L2/L3 | Avertissement retiré |

## T7 — Validation (rules-be.js)

| # | Action | Attendu |
|---|---|---|
| T7.1 | Circuit sans calibre de protection | Erreur BE-01, listée en tête |
| T7.2 | Circuit vide | Erreur BE-02 |
| T7.3 | Cliquer une anomalie | Le circuit concerné est sélectionné |
| T7.4 | Projet conforme | Message « Aucune anomalie détectée (8 règles) » |
| T7.5 | Contrôler chaque règle | Chaque ligne du panneau affiche `id` + `source` |

## T8 — Liste des composants

| # | Action | Attendu |
|---|---|---|
| T8.1 | Remplir des symboles | Tableau trié par repère |
| T8.2 | Vérifier le bloc « Matériel regroupé » | Quantités correctes, tri décroissant |
| T8.3 | « Exporter CSV… » | Fichier `.csv` avec BOM UTF-8, séparateur `;` |
| T8.4 | Ouvrir le CSV dans Excel | Caractères accentués et colonnes corrects |

## T9 — Édition

| # | Action | Attendu |
|---|---|---|
| T9.1 | Ctrl+Z après ajout | Ajout annulé |
| T9.2 | Ctrl+Maj+Z | Ajout rétabli |
| T9.3 | Ctrl+C / Ctrl+V sur un symbole | Copie collée avec nouveau repère |
| T9.4 | Ctrl+C / Ctrl+V sur un circuit | Circuit copié, mention « (copie) » |
| T9.5 | Ctrl+S | Fichier enregistré, projet ajouté aux récents |
| T9.6 | Ctrl+N puis refuser | Rien n'est perdu |
| T9.7 | Sélectionner un projet récent | Projet rechargé |

## T10 — Fichiers

| # | Action | Attendu |
|---|---|---|
| T10.1 | Enregistrer, fermer, rouvrir | Projet identique, y compris repères et caractéristiques |
| T10.2 | Ouvrir un fichier corrompu | Message d'erreur clair, pas de plantage |

## Non couvert

- Export PDF (étape 7 en stand-by).
- Build installable / portable (étape 9).
- Tests automatisés.
