# ROADMAP - ElecSchema

**Cible :** schema unifilaire domestique belge, editeur drag & drop, validation RGIE, CSV.
**Hors perimetre :** schema d'implantation, profil France, import DWG/PDF.
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
| 8 | Finitions (undo/redo, copier/coller, recents) | LIVREE |
| 9 | Build (NSIS + portable) | LIVREE |
| 7 | Export PDF | STAND-BY (code present, bouton a recabler) |

---

## Changement de modele - V1.1 (demande du 9 octobre 2026)

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

---

## Historique des etapes

### Etape 1 - Restructuration
Modele `Project > Circuits > Components` + `InstallationInfo`, 4 onglets,
code en modules, `sandbox` + `contextIsolation`, rendu SVG, build configure.

### Etape 2 - Palette & drag & drop
31 symboles RGIE en 7 familles, glisser-deposer vers une colonne de circuit,
zoom molette + boutons, pan Alt+glisser, selection, suppression.

### Etape 3 - Circuits & nommage
Dialogue de creation (nom + type), panneau de proprietes a 3 colonnes
(circuit, composant), actions monter/descendre/dupliquer/supprimer.

### Etape 4 - Triphase
`phases: 1 | 3` au niveau circuit (propage) et composant, marqueur xN,
arrivee `3N~ 400/230 V`, bus L1/L2/L3, controle d'equilibrage.

### Etape 5 - Validation
`src/rules-be.js`, 8 regles sourcees, panneau d'anomalies cliquable.

### Etape 6 - Liste composants
Tableau detaille, materiel regroupe par designation, export CSV UTF-8 `;`.

### Etape 8 - Finitions
Annuler/retablir par instantane (150 pas), copier/coller symbole ou circuit,
projets recents (8), raccourcis clavier, `TESTS.md`.

### Etape 9 - Build
`electron-builder` 25.1.8, 2 artefacts dans `dist/` :
installeur NSIS + executable portable. Dossier projet : `Documents\Elecschema`
(installe) ou `Projets\` a cote du `.exe` (portable).

**Contrainte connue :** binaires non signes -> SmartScreen "Editeur inconnu".

---

## Suite possible

- Reactiver le PDF (bouton a recabler, handler deja en place).
- Icone et metadonnees de version.
- Tests automatises (Vitest sur modele/regles, Playwright sur l'UI).
- Recherche dans la palette, renommage en masse.
