# TESTS — Elexio

Cas de test **manuels**. À dérouler avant chaque version.

Tests **automatisés** (aucune dépendance) : `npm test` (`node --test`) couvre le
modèle (migrations legacy → **v5**), la cohérence `APP_VERSION`/`package.json`, les **7**
règles BE, les propriétés de layout, le plan d'implantation (géométrie mm, `fitScale`,
migration `'auto'`, format `.elx` avec images) et le comptage des pages de plan ;
`npm run check` vérifie la syntaxe de tout le JS. CI : `.github/workflows/ci.yml`
(déclenchée sur **toutes les branches**). Les distances du PDF se mesurent au repère papier
(1 mm = 2,8346 pt) : mur de 1000 cm à 1:100 = **100,0 ±0,5 mm** ; barre 1 m = **10,0 ±0,3 mm**.
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
| T3.10 | « Recentrer » (barre de zoom) | Le schéma se recentre dans la fenêtre **sans changer le zoom** |
| T3.11 | `Ctrl+A` (focus hors champ de saisie) | Le texte de la page n'est **plus** sélectionné ; dans un champ de saisie, `Ctrl+A` sélectionne toujours le contenu du champ |
| T3.12 | Ouvrir un onglet, puis **actualiser la page** (`F5`) et « Reprendre » | On revient sur l'onglet qui était ouvert (Informations / Schéma unifilaire / Implantation / Composants) |
| T3.13 | Taille des « + » (ancrage **vert** et insertion **gris**) | **Demi-taille** : cercle de rayon 5 (au lieu de 10), barres ±2,5, zone cliquable 7,5 |
| T3.14 | Repère d'un **fil** vertical (orienté 0°) | Le texte longe le conducteur, **centré** sur sa longueur et **resserré** contre lui (plus de décalage vers le haut ni de grand écart) |
| T3.15 | **Carrefour** (node) redessiné en **5×5** | Le point de dérivation est rendu à sa taille réelle (plus d'étirement ×4) ; la place réservée (grille), la hitbox et les « + » d'ancrage suivent la nouvelle taille (≈ +8,5 px du centre, collés au point) |

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
| T10.4 | Outil **Porte** puis clic près d'un mur | Porte posée (battant + arc d'ouverture), mur interrompu ; glisser = déplacement le long des murs |
| T10.5 | Outil **Fenêtre** | Double trait ; largeur réglable dans le panneau |
| T10.6 | Outil **Texte**, clic sur le plan | Une **boîte de saisie** s'ouvre ; le contenu saisi devient le texte posé (annuler ne pose rien). **Double-clic** sur un texte : rouvre la boîte pour le modifier |
| T10.7 | Panneau « Non placés » : glisser un élément sur le plan | Symbole posé ; l'élément disparaît de la liste |
| T10.8 | Clic simple sur un élément de la liste puis clic sur le plan | Symbole posé (mode clic-armer) |
| T10.9 | Cliquer un symbole posé | Sélection sur le plan **et** dans le schéma ; anneau de sélection |
| T10.10 | `R` ou champ Rotation | Symbole tourné de 90° |
| T10.11 | `Suppr` sur un symbole posé | Retiré du plan (l'élément du schéma est conservé) |
| T10.12 | Ajouter un étage (bouton), double-clic sur l'onglet d'étage | Nouvel étage ; renommage au double-clic |
| T10.13 | Importer un fond (`png`/`jpg`/`webp`) | Fond réduit affiché ; calibrage à 2 points ; le projet reste léger |
| T10.14 | « PDF… » avec au moins un étage tracé | Une page A4 paysage par étage non vide, après le schéma : titre, échelle + barre, légende, cartouche. **Échelle exacte** (à 1:100, un mur de 1000 cm mesure 100 mm ; ce qui dépasse la zone de tracé est coupé) |
| T10.15 | Étages sans tracé | Aucune page de plan générée pour eux |
| T10.16 | Plan vide | Aucune page de plan ; PDF sinon inchangé |
| T10.17 | Élément du schéma non posé (plan non vide) | Alerte **BE-09** ; clic → onglet Implantation |
| T10.18 | Bouton « Afficher / masquer le dessin » (actif) | **Tout** disparaît sauf l'arrière-plan (murs, ouvertures, textes, symboles, grille) ; second clic : tout revient |
| T10.19 | Importer un fond, puis **actualiser la page** (voire fermer/rouvrir, ou actualiser aussitôt après l'import) et reprendre | Le fond est toujours là (miroir disque **et** IndexedDB ; écriture immédiate à l'import) |
| T10.20 | Curseur « Opacité des éléments » (barre d'outils du haut) | Murs, ouvertures, pièces et symboles deviennent plus / moins transparents (l'arrière-plan n'est pas touché) ; le curseur n'est plus dans le panneau de droite |
| T10.21 | Sélectionner une porte : « Miroir horizontal » (barre d'outils) | La porte se reflète le long du mur (arc centré sur l'autre bord de l'ouverture) |
| T10.22 | Sélectionner une porte : « Miroir vertical » (barre d'outils) | Le battant et l'arc basculent de l'autre côté du mur |
| T10.23 | Sélectionner une fenêtre | Pas de réglages de porte (miroirs) : le groupe « Porte » reste masqué |
| T10.24 | Sélectionner une ouverture | Le champ **« Largeur (cm) »** apparaît dans la barre d'outils du haut (il n'est plus dans le panneau de droite) ; le modifier change la largeur |
| T10.25 | Bouton « Recentrer » (barre d'outils) | La vue cadre **toute la feuille A4** (et non le seul dessin), recentrée |
| T10.26 | Cliquer un symbole posé (fond présent, verrouillé **ou** déverrouillé) | Sélection + anneau de sélection, **sans erreur console** ; les autres éléments restent sélectionnables même fond déverrouillé |
| T10.27 | Fond **déverrouillé** : boutons « − » / « + » (panneau « Fond de plan ») | L'arrière-plan rétrécit / s'agrandit autour de son centre (définir la taille) ; boutons **désactivés** quand le fond est verrouillé |
| T10.28 | Volet « Non placés » | La liste est dans un **volet à gauche** de la zone de travail (elle n'est plus dans le panneau de droite) ; glisser-déposer / clic-armer inchangés |
| T10.29 | Barre d'outils du plan | **Trois lignes** : (1) étages puis, après un **séparateur**, les outils **Sélection / Mur / Porte / Fenêtre / Texte** ; (2) réglages d'ouverture (ligne **masquée** si aucune ouverture n'est sélectionnée) ; (3) Afficher-masquer / **Afficher le cadre A4** / Recentrer / Centrer le cadre / Ajuster au dessin / zoom − + / opacité |
| T10.30 | Boutons **zoom − / +** (barre d'outils) | Le dessin se dézoome / zoome autour du **centre de la zone de travail** (le curseur d'opacité et « Recentrer » restent inchangés) |
| T10.31 | Barre dédiée « Texte » (taille, **G**, *I*, <u>S</u>) | N'apparaît **que** quand un texte est sélectionné ; disparaît à la désélection |
| T10.32 | Réglages de la barre « Texte » | « Taille » (Petite / Normale / Grande / Très grande) change la taille du texte ; G / I / S activent/désactivent gras / italique / souligné (bouton surligné si actif) |
| T10.33 | Boutons d'outils (Sélection, Mur, Porte, Fenêtre, Texte) | Affichés en **icônes** ; l'outil actif est surligné en bleu avec l'icône **inversée** (blanche) ; infobulle + `aria-label` conservés |
| T10.34 | Champ **échelle 1:N** (barre, ligne 1) : saisir 50, puis `+` / `−` | La valeur est bornée à 10…1000 ; `+` / `−` passent au palier suivant (`PLAN_SCALES` ou ±10) ; la vue se recale sur la feuille |
| T10.35 | Suggestions du champ échelle | Les échelles `PLAN_SCALES` (20, 25, 50, 75, 100, 125, 150, 200, 250, 500) sont proposées |
| T10.36 | Case « Afficher le cadre A4 » | Affiche / masque feuille, zone imprimable, zone de tracé, cartouche et étiquette « {étage} — 1:N » ; l'état survit à un rechargement (`localStorage 'elexio.planFrame'`) |
| T10.37 | Élément hors de la zone de tracé | **Atténué à l'écran** par un voile ; **coupé dans le PDF** (WYSIWYG) |
| T10.38 | Poignée au centre de la zone de tracé (outil Sélection) | Glisser déplace le cadre (réglage `printCenter`, enregistré dans le projet) ; le cadre suit le curseur ; la poignée est **masquée** si la mise en page est verrouillée |
| T10.39 | Bouton « Centrer le cadre » | Recentre la vue sur le cadre **sans** changer le zoom |
| T10.40 | Bouton « Ajuster au dessin » | Choisit l'échelle entière qui fait tenir le tracé à la page, puis recentre |
| T10.41 | Exporter en PDF alors qu'un tracé déborde de la zone | Une **confirmation** prévient du débordement avant l'export |
| T10.42 | Exporter en PDF un projet **volumineux** (fond de plan) | L'export aboutit (rendu via fichier temporaire ; plus d'échec lié à la taille du HTML) |
| T10.43 | Ouvrir un projet par **dialogue** (« Ouvrir… ») | Le projet apparaît dans **Récents** (l'export PDF, lui, n'ajoute aucun chemin) |
| T10.44 | Ancien `localStorage` (`elecschema.*`) présent | Au 1er chargement, `autosave`, `tab`, `printPreview` et `favorites` sont **repris** dans `elexio.*` ; les clés d'origine sont **conservées** (rien supprimé) |
| T10.45 | Ouvrir un projet 0.3.0 / 0.4.0 (échelle `'auto'`) | Ouvre sans perte ; `'auto'` devient l'échelle entière qui cadre le dessin ; réenregistrer reste au format `.elx` v5 |
| T10.46 | Panneau de droite du plan → section « **Mise en page** » | L'**échelle 1:N** (champ + `−`/`+`) et l'indicateur d'échelle sont dans le **panneau de droite** (plus dans la barre du haut) ; la modifier recale la vue sur la feuille |
| T10.47 | Case « **Verrouiller la mise en page** » (cochée) | Le champ d'échelle, `−`/`+` et « Ajuster au dessin » sont **désactivés** ; la **poignée de déplacement du cadre A4 disparaît** ; décocher rétablit tout (le verrou n'est pas mémorisé) |
| T10.48 | Taille d'un texte (Petite / Normale / Grande / Très grande) | **Agrandie** : « Normale » = 4 mm sur papier à 1:N (l'ancienne « Très grande ») ; Petite 0.75 → 3 mm, Grande 1.5 → 6 mm, Très grande 2 → 8 mm |
