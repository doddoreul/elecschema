# ElecSchema

Éditeur de **schémas unifilaires** pour installations **domestiques** belges.

- Norme visée : **RGIE / AREI** (symboles selon le tableau 2.23, Livre 1 Partie 2)
- Domaine : **habitation uniquement** — mono **et** triphasé
- **100 % local** : aucun cloud, aucune licence, aucune télémétrie
- Distribué en **installeur** et en **version portable**

> Projet à usage personnel. Ce n'est pas une référence réglementaire : voir la section
> [Avertissement](#avertissement).

---

## Fonctionnalités

**Schéma unifilaire**
- Palette de **31 symboles** RGIE répartis en 7 familles, glisser-déposer sur un circuit
- Un rail vertical par circuit, symboles posés **perpendiculairement** au rail
- Zoom (molette / boutons) et déplacement de la vue (Alt + glisser)
- Sélection, suppression (`Suppr`), duplication, réordonnancement

**Circuits**
- 3 types : éclairage, prises de courant, mixte
- Propriétés : nom, description, phases, raccordement L1 / L2 / L3
- Repères automatiques (`Q1`, `X2`, `E3`…) et verrouillables
- Triphasé : bus L1/L2/L3, marqueur `3~`, contrôle d'équilibrage

**Protections**
- Posées manuellement (disjoncteur, différentiel, coupe-circuit à fusibles)
- Calibres normalisés : 1 · 2 · 3 · 4 · 6 · 10 · 16 · 20 · 25 · 32 · 40 · 50 · 63 A
- Courbes B / C / D — pouvoir de coupure 3000 A par défaut (modifiable)
- Sensibilités : 10 · 30 · 100 · 300 · 500 mA

**Élément d'arrivée**
- Compteur éditable en cliquant dessus (repère et désignation)

**Informations sur l'installation**
- Chantier, occupant, installateur, dessinateur, organisme de contrôle
- Reporté automatiquement dans le cartouche du schéma

**Liste des composants**
- Tableau détaillé et matériel regroupé par désignation
- Export CSV (UTF-8, séparateur `;`)

**Édition**
- Annuler / rétablir (150 pas), copier / coller, projets récents
- Raccourcis : `Ctrl+N` `Ctrl+S` `Ctrl+Z` `Ctrl+Y` `Ctrl+C` `Ctrl+V`

**Contrôle**
- 8 règles de cohérence (voir `src/rules-be.js`), panneau cliquable

---

## Prérequis

- **Node.js** 18 ou plus récent
- **Windows** 10 ou 11 (build actuel)

## Développement

```bash
npm install
npm start
```

## Construire

```bash
npm run build          # installeur NSIS + portable, dans dist/
npm run build:portable # portable seul
npm run build:dir       # version décompressée
```

Deux artefacts sont produits dans `dist/` :

| Fichier | Type |
|---|---|
| `ElecSchema Setup <version>.exe` | installeur NSIS, choix du répertoire |
| `ElecSchema-portable-<version>.exe` | autonome, utilisable depuis une clé USB |

Les binaires ne sont **pas signés** : Windows affiche SmartScreen au premier lancement.

## Où sont les projets

| Version | Emplacement |
|---|---|
| Installée | `Documents\ElecSchema` |
| Portable | `Projets\` à côté de l'exécutable |

Format de fichier : `.unifilaire.json`.

---

## Structure

```
main.js                    processus principal (fenêtres, fichiers, export)
preload.js                 pont isolé rendu <-> principal
src/
  index.html               4 onglets + panneaux de propriétés
  styles.css               feuille de style
  model.js                 modèle de données
  symbols.js               31 symboles RGIE
  standards.js             valeurs normalisées (calibres, sections, Δ…)
  render.js                rendu SVG du schéma
  rules-be.js              8 règles de validation
  ui.js                    onglets, formulaires, interactions
TESTS.md                   cas de test manuels
ROADMAP.md                 état d'avancement et décisions
```

## Modèle de données

```
Project {
  supply:    { id, kind, label, detail }       élément d'arrivée
  info:      InstallationInfo                  onglet Informations
  circuits:  Circuit[]
}
Circuit {
  id, name, description, typeKey, phases, phase, components[]
}
Component {
  id, symbolType, label, labelLocked, detail, phases
  params?:   { rating, curve, icb, diff }       uniquement symboles de protection
}
```

## Tests

Aucun test automatisé à ce jour. `TESTS.md` liste les cas manuels
(démarrage, informations, circuits, symboles, zoom, triphasé, validation,
liste composants, édition, fichiers).

Vérification rapide de la syntaxe :

```bash
node --check main.js src/*.js
```

Pour voir les erreurs du rendu (invisibles autrement) :

```bash
node_modules\electron\dist\electron.exe . --enable-logging=stderr
```

---

## Avertissement

Les dessins de symboles sont des refontes à partir des descriptions du tableau 2.23,
**pas** des images officielles. À comparer au document du SPF Économie
(*Installations électriques — Symboles graphiques*) avant tout usage.

Les règles de `src/rules-be.js` sont des garde-fous de dessin, pas une référence
réglementaire. Chacune porte `verified: false` : aucune n'a été confrontée au texte
officiel du RGIE. Une validation par un professionnel est nécessaire avant tout usage réel.

Projet indépendant, sans lien avec l'éditeur Trikker (Bluebits BV / Anchr).
