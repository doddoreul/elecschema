# TESTS — Elexio

Cas de test **manuels**. À dérouler avant chaque version.

Tests **automatisés** (aucune dépendance) : `npm test` (`node --test`) couvre le
modèle (migrations legacy → v4), les **7** règles BE, les propriétés de layout, le
plan d'implantation (modèle, format `.elx` avec images) et le comptage des pages de plan ;
`npm run check` vérifie la syntaxe de tout le JS. CI : `.github/workflows/ci.yml`.
Les cas ci-dessous restent la référence pour l'UI et le bureau.

App : `npm start` (bureau) ou `node tools/serve-browser.js` (navigateur local).

## T1 — Démarrage

| # | Action | Attendu |
|---|---|---|
| T1.1 | `npm start` | Fenêtre ouverte, sans erreur console |
| T1.2 | Premier lancement (aucun autosave) | Le schéma par défaut (`DEFAULT_SCHEMA`) est chargé |
| T1.3 | Relancer après une modif non enregistrée | L'autosave local est restauré |

## T2 — Informations

| # | Action | Attendu |
|---|---|---|
| T2.1 | Remplir chantier, occupant, installateur, dessinateur | Valeurs conservées en changeant d'onglet |
| T2.2 | Passer « Type d'alimentation » à triphasé | En-tête du schéma passe en « triphasé » |
| T2.3 | Laisser adresse / société / dessinateur vides | Règle BE-08 signale les informations manquantes |

## T3 — Schéma (arbre d'éléments)

| # | Action | Attendu |
|---|---|---|
| T3.1 | Cliquer le « + » à droite du compteur | Menu contextuel (différentiel, disjoncteur…) |
| T3.2 | Poser un différentiel puis un disjoncteur | Chaîne compteur → diff → disjoncteur, lettres de circuit A, B… |
| T3.3 | Cliquer un symbole de la palette puis un « + » | Le symbole est armé (orange), chaque « + » pose une copie |
| T3.4 | `Échap` | Désarme le symbole puis désélectionne |
| T3.5 | Glisser-déposer un symbole de la palette vers un « + » | Élément posé au point d'ancrage visé |
| T3.6 | Poser un **node** (menu « + Node ») | Point de dérivation ramifiable (plusieurs enfants) |
| T3.7 | Sélectionner un élément, `Suppr` | Élément supprimé (le compteur est protégé) |
| T3.8 | `Ctrl+Z` / `Ctrl+Y` | Annuler / rétablir |
| T3.9 | `Maj + clic` sur plusieurs éléments | Sélection multiple |

## T4 — Propriétés

| # | Action | Attendu |
|---|---|---|
| T4.1 | Sélectionner une prise | Type de prise par défaut « terre + enfant », nombre de prises réglable |
| T4.2 | Changer le type de prise (double, triple…) | Le SVG affiché change |
| T4.3 | Sélectionner un fil | Câble, section, montage, conducteurs `1X…7X` / `2G…7G`, étiquette type `3G2,5mm²` |
| T4.4 | Modifier un repère | Repère verrouillé (ne suit plus l'auto-numérotation) |
| T4.5 | Cocher « Afficher le repère » | Le repère s'affiche sous le symbole |

## T5 — Mise en page (A4)

| # | Action | Attendu |
|---|---|---|
| T5.1 | Cocher « Activer la mise en page » | Cadre(s) A4 paysage + cartouche ; panneau droit = « Mise en page » |
| T5.2 | Zoom (curseur du panneau) | Le dessin grandit/rétrécit (défaut 60 %) |
| T5.3 | « Recentrer » | Le dessin se recentre sur la page courante, sans changer de taille |
| T5.4 | Glisser le dessin | Tout le dessin se déplace (curseur main) |
| T5.5 | Ajouter une page | Nouvelle page insérée à droite, **avec cartouche** |
| T5.6 | Cliquer le nom d'une page | Cette page devient la page courante (surlignée) |
| T5.7 | Supprimer une page (✕) | Page retirée ; la **dernière** page ne peut pas être supprimée |
| T5.8 | Dessin à cheval sur 2 pages | Le trait continue d'une page à la suivante (pas d'espace entre pages) |
| T5.9 | Cliquer un symbole en mode mise en page | Aucune sélection (le dessin reste déplaçable) |
| T5.10 | `espace` + glisser | Panoramique (curseur main) |

## T6 — Enregistrer / Exporter / PDF

| # | Action | Attendu |
|---|---|---|
| T6.1 | `Ctrl+S` ou « Enregistrer » | Sauvegarde dans le stockage local, statut « Enregistré » |
| T6.2 | « Exporter… » | Télécharge `<nom>.elx` (JSON enveloppé, encodé en base64) |
| T6.3 | « Ouvrir… » un `.elx` exporté | Projet rechargé à l'identique |
| T6.4 | « PDF… » (bureau) | Dossier : cartouche général, schéma (1 page A4 / page de mise en page), circuits, matériaux |
| T6.5 | « PDF… » (navigateur) | Impressions via `window.print()` |
| T6.6 | Schéma qui débordait des pages | Un avertissement signale le débordement |
| T6.7 | Ouvrir un `.elx` de version ancienne / récente | Migration auto (ancienne) ; avertissement puis ouverture au choix (récente) |

## T7 — Validation

| # | Action | Attendu |
|---|---|---|
| T7.1 | Schéma sans élément | BE-01 (erreur) |
| T7.2 | Prise sans DDR 30 mA en amont | BE-03 (avertissement) |
| T7.3 | Protection sans calibre | BE-04 |
| T7.4 | Deux éléments avec le même repère | BE-05 |
| T7.5 | Symbole sans repère | BE-06 |
| T7.6 | Cliquer une anomalie | L'élément concerné est sélectionné |

## T8 — Liste des matériaux

| # | Action | Attendu |
|---|---|---|
| T8.1 | Onglet « Composants » | Tableau regroupe par désignation, quantités correctes |

## T9 — Build

| # | Action | Attendu |
|---|---|---|
| T9.1 | `npm run build` | Installeur NSIS + portable dans `dist/` |
| T9.2 | Lancer l'exe portable | Données dans `Projets\` à côté de l'exe ; pas d'installation |
| T9.3 | Lancer l'installeur | Données dans `Documents\Elexio` |

## T10 — Schéma d'implantation (onglet « Implantation »)

| # | Action | Attendu |
|---|---|---|
| T10.1 | Onglet « Implantation » | Un niveau « Rez-de-chaussée », grille 5 cm, plan vide |
| T10.2 | Outil **Mur**, clics successifs | Polyligne orthogonale ; `Alt` = angle libre ; `Entrée`/`Échap`/double-clic terminent |
| T10.3 | Sélectionner un mur | Longueur en cm + équivalent papier à l'échelle ; épaisseur réglable |
| T10.4 | Outil **Porte** puis clic près d'un mur | Porte posée (arc), mur interrompu ; glisser = déplacement le long des murs |
| T10.5 | Outil **Fenêtre** | Double trait ; largeur réglable dans le panneau |
| T10.6 | Outil **Pièce**, clic | Libellé « Pièce » ; renommable, déplaçable (flèches) |
| T10.7 | Panneau « Non placés » : glisser un élément sur le plan | Symbole posé ; l'élément disparaît de la liste |
| T10.8 | Clic simple sur un élément de la liste puis clic sur le plan | Symbole posé (mode clic-armer) |
| T10.9 | Cliquer un symbole posé | Sélection sur le plan **et** dans le schéma ; anneau de sélection |
| T10.10 | `R` ou champ Rotation | Symbole tourné de 90° |
| T10.11 | `Suppr` sur un symbole posé | Retiré du plan (l'élément du schéma est conservé) |
| T10.12 | Ajouter un étage (bouton), double-clic sur l'onglet d'étage | Nouvel étage ; renommage au double-clic |
| T10.13 | Importer un fond (`png`/`jpg`/`webp`) | Fond réduit affiché ; calibrage à 2 points ; le projet reste léger |
| T10.14 | « PDF… » avec au moins un étage tracé | Une page A4 paysage par étage non vide, après le schéma : titre, échelle + barre, légende, cartouche |
| T10.15 | Étages sans tracé | Aucune page de plan générée pour eux |
| T10.16 | Plan vide | Aucune page de plan ; PDF sinon inchangé |
| T10.17 | Élément du schéma non posé (plan non vide) | Alerte **BE-09** ; clic → onglet Implantation |
| T10.18 | Bouton « Masquer les éléments » puis « Afficher les éléments » | Les symboles posés disparaissent puis réapparaissent ; murs, ouvertures, pièces et fond restent visibles |
| T10.19 | Importer un fond, puis **actualiser la page** et reprendre | Le fond est toujours là (miroir disque en bureau, IndexedDB en navigateur) |
