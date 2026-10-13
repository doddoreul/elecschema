# ROADMAP - Elexio

**Cible :** schema unifilaire domestique belge, editeur drag & drop, validation RGIE.
**Hors perimetre :** profil France, import DWG/PDF/DXF.
**Scope :** habitation uniquement. Mono **et** triphase. Pas d'industriel. Pas de schema developpe.
**Contraintes :** 100 % standalone, pas de cloud, pas de licence payante, installable **et** portable.

---

## Statut

| Etape | Sujet | Etat |
|---|---|---|
| 1 | Restructuration | LIVREE |
| 2 | Palette & drag & drop | LIVREE |
| 3 | Circuits & nommage | LIVREE |
| 4 | Triphase | LIVREE |
| 5 | Validation | LIVREE |
| 6 | Liste composants | LIVREE |
| 7 | Export PDF (dossier complet) | LIVREE |
| 8 | Finitions (undo/redo, copier/coller, recents) | LIVREE |
| 9 | Build (NSIS + portable) | LIVREE |
| 10 | Refonte ancrages (arbre d'elements + nodes) | LIVREE |
| 11 | Mise en page multi-pages (A4 + cartouche) | LIVREE |
| 12 | Renommage Elexio + version navigateur GitHub Pages | LIVREE |
| 13 | Qualite : tests auto (node:test) + CI + durcissement | LIVREE |
| 14 | Format de fichier `.elx` (versionne, base64) | LIVREE |
| 15 | Schema d'implantation (plan, murs, ouvertures, symboles, PDF) | LIVREE |

---

## Modele actuel (oct. 2026) - arbre d'elements

Le modele « circuits + composants » a ete remplace par un **arbre d'elements** :

- Racine = **compteur** (ancrage a droite uniquement).
- Chaque element s'ancre dans un **point d'ancrage** libre de son parent (4 directions ;
  `node` et `tableau` restent ramifiables).
- Notion de **groupe sous differentiel** : tout element place sous un differentiel.
- **Tableau** : sorties en haut (`top-n`), sortie de terre en bas.
- Reperes automatiques par prefixe, lettres de circuit (A, B...).
- **Mise en page** A4 paysage (594x420 px a 2 px/mm), pages cote a cote, cartouche
  sur chaque page ; dossier PDF par page.

Voir `AGENT.md` (source de verite) et `src/model.js`, `src/standards.js`, `src/render.js`.

La section suivante (« V1.1 ») est conservee comme **archive** du modele circuits.

---

## Changement de modele - V1.1 (archive, 9 octobre 2026)

Le modele du circuit a ete simplifie. Resume des decisions :

| Sujet | Avant | Apres |
|---|---|---|
| Types de circuit | 8 types | **3** : eclairage, prises, mixte |
| Proprietes du circuit | nom, type, section, phases, phase, protection | **nom, description, type, phases, phase** |
| Section | propriete du circuit | **retiree partout** |
| Protection | propriete du circuit | **purely manual** : symbole pose par l'utilisateur |
| Composant initial | circuit cree avec un symbole `X1` | **circuit vide** |
| Element d'arrivee | bloc dessine en dur | **element editable** au clic |
| Rendu des composants | empiles en serie sur la colonne | **un rail vertical, symboles perpendiculaires** |

Valeurs standardisees disponibles (`src/standards.js`) :

- Sections : 0,75 - 1 - 1,5 - 2,5 - 4 - 6 - 10 - 16 - 25 - 35 - 50 - 70 mm2 (reference, non utilisees en propriete)
- Calibres disjoncteurs : 1 - 2 - 3 - 4 - 6 - 10 - 16 - 20 - 25 - 32 - 40 - 50 - 63 A
- Pouvoir de coupure par defaut : **3000 A**, modifiable par element
- Differentiels : 10 - 30 - 100 - 300 - 500 mA
- Courbes : B / C / D

Les symboles de protection (`breaker`, `rcd`, `fuse`) portent desormais
`params = { rating, curve, icb, diff }`, edites dans le panneau de proprietes.

### Regles adaptees

| Regle | Severite | Objet |
|---|---|---|
| BE-01 | erreur | circuit vide |
| BE-02 | avert. | circuit sans symbole de protection |
| BE-03 | avert. | prises/mixte sans differentiel 30 mA |
| BE-04 | avert. | protection sans calibre |
| BE-05 | avert. | noms de circuit en double |
| BE-06 | avert. | symbole sans repere |
| BE-07 | avert. | desequilibre des phases |
| BE-08 | avert. | dossier incomplet |

Toutes les regles gardent `verified: false` : aucune n'a ete confrontee au texte
officiel RGIE. A faire valider par un professionnel.

### Etape 15 - Schema d'implantation

Nouvel onglet **Schéma d'implantation** : dessin d'implantation par **étage**, en
coordonnees **cm** (Y vers le bas). Modele pur dans `src/plan-model.js` (niveaux,
murs, ouvertures, pieces, placements, echelle), rendu SVG dans `src/plan-render.js`,
interactions dans `src/plan-ui.js`, fond de plan dans `src/plan-assets.js`
(image **hors** du projet), pages PDF dans `src/plan-print.js`.

- **Murs** : polyligne, orthogonal par defaut (`Alt` = angle libre), epaisseur 20 cm.
- **Portes / fenetres** : posees sur le mur le plus proche (arc + double trait),
  deplacables le long du mur, largeur reglable.
- **Pieces** : libelles libres, deplacables, renommables.
- **Symboles** : instances d'elements du schema (aucun nouvel equipement) ;
  glisser-deposer ou clic-armer ; taille **constante sur papier** (4 mm).
- **Fond de plan** : image importee, reduite (<= 2400 px, JPEG 0,85), calibrable,
  jamais serialisee dans le projet (cle d'image seulement ; autosave disque / IndexedDB).
- **`SCHEMA_VERSION = 4`** : migration idempotente depuis v3, plan par defaut vide.
- **PDF** : une page A4 paysage par etage non vide, apres le schema et avant les listes,
  avec titre, echelle numerique + barre graphique, legende des symboles et cartouche.
- **BE-09** (info) : appareillage non place sur le plan — signale seulement si le plan
  contient deja au moins un placement.
- **Export CSV supprime** definitivement (modele, UI, menu, PDF).

---

## Historique des etapes

### Etape 1 - Restructuration
Modele `Project > Circuits > Components` + `InstallationInfo`, 4 onglets,
code en modules, `sandbox` + `contextIsolation`, rendu SVG, build configure.

### Etape 2 - Palette & drag & drop
31 symboles RGIE en 8 familles, glisser-deposer vers une colonne de circuit,
zoom molette + boutons, pan Alt+glisser, selection, suppression.

### Etape 3 - Circuits & nommage
Dialogue de creation (nom + type), panneau de proprietes a 3 colonnes
(circuit, composant), actions monter/descendre/dupliquer/supprimer.

### Etape 4 - Triphase
`phases: 1 | 3` au niveau circuit (propage) et composant, marqueur xN,
arrivee `3N~ 400/230 V`, bus L1/L2/L3, controle d'equilibrage.

### Etape 5 - Validation
`src/rules-be.js`, 6 regles sourcees, panneau d'anomalies cliquable.

### Etape 6 - Liste composants
Tableau detaille, materiel regroupe par designation.

### Etape 8 - Finitions
Annuler/retablir par instantane (150 pas), copier/coller symbole ou circuit,
projets recents (8), raccourcis clavier, `TESTS.md`.

### Etape 9 - Build
`electron-builder` 25.1.8, 2 artefacts dans `dist/` :
installeur NSIS + executable portable. Dossier projet : `Documents\Elexio`
(installe) ou `Projets\` a cote du `.exe` (portable).

**Contrainte connue :** binaires non signes -> SmartScreen "Editeur inconnu".

### Etape 13 - Qualite
Tests automatises sans dependance (`node --test` : modele/migrations, 6 regles,
proprietes de layout) + workflow CI (syntaxe `node --check` + tests). Durcissement
du processus principal : validation d'arbre, `openPath` limite aux recents,
fenetre PDF verrouillee (`javascript:false`), ecritures atomiques, autosave miroir
disque. Shim web `src/platform.js` : memes fonctions PDF/ouverture en navigateur qu'en
bureau. Avertissement « trace contraint » quand le layout atteint son plafond.
PDF : SVG des symboles inlines en `data:` (`print-assets.js`), plus de dependance
`file:` ; reperage des circuits (`renumberCircuits`) deplace dans `model.js`.

Electron passe a **44** (supportee) + electron-builder **26** lors de la preparation
du build .exe (oct. 2026). A valider sur un lancement reel : export PDF, ouverture
`.elx`, rendu des icones. Risque PDF reduit : plus de `file://` depuis la page `data:`
(SVG inlines en `data:`).

### Etape 14 - Format de fichier `.elx`

Format d'export/import propre a Elexio : JSON **enveloppe** (`format`, `formatVersion`,
`schemaVersion`, `app`, `exportedAt`, `project`) puis **encode en base64**, extension
`.elx`. Logique pure dans `src/format.js` (testee). Import : decodage puis controle de
version — migration automatique si le modele est plus ancien, avertissement si plus
recent — et tolerance des anciens `.json` en clair. `main.js` est reduit a la
lecture/ecriture du texte brut ; le decodage et la validation sont dans le rendu (ESM
partage navigateur/bureau).

---

## Suite possible

- Icone et metadonnees de version signees.
- Tests automatises : `node --test` sur modele/regles/layout/plan (fait) ; tests d'UI (Playwright) a faire.
- Recherche dans la palette, renommage en masse.
- Schema d'implantation : liaisons entre symboles, cotes automatiques, export DXF.
