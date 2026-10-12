# Elexio

Éditeur de **schémas unifilaires** pour installations **domestiques** belges.

- Norme visée : **RGIE / AREI** (symboles selon le tableau 2.23, Livre 1 Partie 2)
- Domaine : **habitation uniquement** — mono **et** triphasé
- **100 % local** : aucun cloud, aucune licence, aucune télémétrie
- Application **Windows** (Electron) + **version navigateur** (GitHub Pages)

> Projet à usage personnel. Ce n'est pas une référence réglementaire : voir la section
> [Avertissement](#avertissement).

---

## Démarrage rapide (débutant)

### Lancer l'application

**Version bureau (Windows)** : `npm install` puis `npm start`.

**Version navigateur** : ouvrir <https://doddoreul.github.io/elexio/> — rien à installer.

### Créer un schéma en 5 minutes

1. **Informations** : à l'ouverture, l'onglet *Informations sur l'installation* s'ouvre.
   Remplissez chantier, occupant, installateur. Elles apparaîtront dans le cartouche du PDF.

2. **Schéma** : allez à l'onglet *Schéma unifilaire*. Le compteur (⚡) est posé en bas à gauche.
   Cliquez le « + » à sa droite : le menu propose un **différentiel** — choisissez-le,
   remplissez la boîte de dialogue (sensibilité 30 mA, intensité 63 A par défaut).

3. **Ajouter un circuit** : cliquez le « + » à droite du différentiel, choisissez un
   **disjoncteur** (calibre 16 A ou 20 A selon le circuit). La boîte « Type de prise » /
   « Type d'interrupteur » n'apparaît que pour les prises et interrupteurs.

4. **Poser les équipements** : chaque « + » orange accepte un symbole. La palette à gauche
   regroupe les symboles par famille. Glissez-déposez ou cliquez un symbole puis un « + ».
   Une prise accepte jusqu'à 12 prises (champ « Nombre de prises »).

5. **Mise en page** : cochez *Activer la mise en page* (en haut). Le schéma se montre dans
   un cadre A4 avec un cartouche. Glissez le dessin pour le placer, réglez sa taille avec
   le curseur du panneau de droite, ajoutez des pages à droite. La barre d'espace + glisser
   déplace la vue.

6. **Enregistrer / Exporter**
   - `Ctrl+S` ou **Enregistrer** : sauvegarde locale (retrouvée à la prochaine ouverture).
   - **Exporter…** : télécharge le schéma en `.json` (format `.unifilaire.json`).
   - **PDF…** : dossier d'impression (cartouche général, schéma sur une page A4 par page
     de mise en page, liste des circuits, liste des matériaux).

### Raccourcis

| Touche | Effet |
|---|---|
| `Ctrl+N` / `Ctrl+S` | Nouveau projet / sauvegarde locale |
| `Ctrl+Z` / `Ctrl+Y` | Annuler / rétablir |
| `Maj + clic` | sélection multiple |
| `Suppr` / `Retour` | supprimer la sélection |
| `Échap` | désarmer / désélectionner |
| molette | zoom curseur |
| clic milieu ou `espace` + glisser | déplacer la vue |

---

## Fonctionnalités

**Schéma unifilaire**
- Arbre d'éléments ancrés : compteur → protections → appareils, points d'ancrage
- **Node** (dérivation), **tableau** avec sorties en haut et sortie de terre en bas
- **Sectionneur** (coupe à vide), posable n'importe où
- Zoom / panoramique, sélection multiple, annuler-rétablir (150 pas)

**Symboles**
- **31 symboles** RGIE en 8 familles (tableaux, protections, interrupteurs, prises,
  éclairage, appareils, sources, câbles)
- Prises : 10 types (générique, étanche, terre, enfant, interrupteur, **double**, **triple**…)
- Interrupteurs : 7 types (simple, bi/tripolaire, double, va-et-vient, inverseur)
- Fils : type de câble, section, montage, conducteurs `1X…7X` / `2G…7G`
- Repères automatiques par préfixe (`Q`, `X`, `E`, `F`…), verrouillables
- Lettres de circuit automatiques (A, B… Z, AA…)

**Valeurs normalisées** (standards.js)
- Calibres 1 à 63 A · courbes B/C/D · sensibilités 10 à 1000 mA
- Sections 0,75 à 70 mm² · câbles EXVB, XVB, XGB, VOB, EXAVB, XFVB
- Montages : apparent, encastré (± conduit), enterré, aérien

**Contrôle**
- 6 règles de cohérence (`src/rules-be.js`), panneau cliquable

**Dossier PDF**
1. cartouche général (chantier, occupant, installateur, contrôle, projet)
2. schéma unifilaire (une page A4 par page de mise en page)
3. liste des circuits
4. liste des matériaux (regroupée)

---

## Développement

```bash
npm install
npm start            # bureau (Electron)
node tools/serve-browser.js   # navigateur local (http://127.0.0.1:8791)
```

```bash
npm run build          # installeur NSIS + portable, dans dist/
npm run build:portable # portable seul
npm run build:dir       # version décompressée
```

Vérification de la syntaxe : `npm run check` — Tests automatiques : `npm test`

```
main.js           processus principal (fenêtres, fichiers, export PDF/CSV)
preload.js        pont isolé rendu <-> principal (window.elexio)
index.html        redirection vers src/ (GitHub Pages)
src/
  index.html      onglets + panneaux
  styles.css
  model.js        modèle de données (arbre d'éléments) + migrations
  default-schema.js  schéma pré-rempli à la création
  symbols.js      31 symboles RGIE + types de prise/interrupteur + SVG des montages
  symbols/        fichiers SVG autonomes
  standards.js    valeurs normalisées (calibres, sections, ancrages, pages A4)
  render.js       rendu SVG (grille, mise en page, cartouche)
  rules-be.js     6 règles de validation
  ui.js           onglets, formulaires, interactions
  platform.js     shim web de window.elexio (version navigateur : CSV/PDF/ouverture)
tools/serve-browser.js  serveur local de test (navigateur)
test/             tests automatiques (node:test)
```

Le fichier de projet est un **`.json`** (`.unifilaire.json`) : format d'export/import
propre à Elexio (l'autosave reste **local** : stockage du navigateur ; en bureau, un
miroir disque `autosave.json` est écrit en plus dans le dossier de données).

---

## Avertissement

Les dessins de symboles sont des refontes à partir des descriptions du tableau 2.23,
**pas** des images officielles. À comparer au document du SPF Économie
(*Installations électriques — Symboles graphiques*) avant tout usage.

Les règles de `src/rules-be.js` sont des garde-fous de dessin, pas une référence
réglementaire. Chacune porte `verified: false` : aucune n'a été confrontée au texte
officiel du RGIE. Une validation par un professionnel est nécessaire avant tout usage réel.

Projet indépendant, sans lien avec l'éditeur Trikker (Bluebits BV / Anchr).
