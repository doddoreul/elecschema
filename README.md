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
   - **Exporter…** : télécharge le schéma au format **`.elx`** (JSON enveloppé + base64 ; voir ci-dessous).
   - **PDF…** : dossier d'impression (cartouche général, schéma sur une page A4 par page
     de mise en page, **plan d'implantation** — une page par étage non vide —, liste des
     circuits, liste des matériaux).

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
- 7 règles de cohérence (`src/rules-be.js`), panneau cliquable

**Schéma d'implantation**
- Dessin par **étage** (coordonnées en cm, Y vers le bas), calques fond / murs / ouvertures /
  pièces / symboles
- **Murs** : polyligne, orthogonal par défaut (`Alt` = angle libre), épaisseur 20 cm
- **Portes / fenêtres** posées sur le mur le plus proche, déplaçables le long du mur, largeur réglable
- **Pièces** : libellés libres (renommables, déplaçables)
- **Symboles** : instances des éléments du schéma (aucun nouvel équipement), glisser-déposer ou
  clic-armer ; **tableau** et **compteur** placeables
- **Fond de plan** : image importée, calibrable, jamais incluse dans le projet (fichier `.elx` : images référencées seulement)
- **Échelle 1:N** : champ réglable (`+` / `−`, suggestions) ; **cadre A4 à l'écran** fidèle au PDF (feuille, zone imprimable, zone de tracé, cartouche, hors zone atténué) ; règle **BE-09** (appareillage non placé)

**Dossier PDF**
1. cartouche général (chantier, occupant, installateur, contrôle, projet)
2. schéma unifilaire (une page A4 par page de mise en page)
3. plan d'implantation (une page A4 paysage par étage non vide : titre, échelle **exacte** + barre graphique, légende, cartouche)
4. liste des circuits
5. liste des matériaux (regroupée)

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
npm run build:dir       # version décompressée (test rapide)
```

Le build produit `dist/Elexio-Setup-<version>.exe` (installable) et
`dist/Elexio-portable-<version>.exe`. Icône de l'app : `build/icon.ico` (+ source
`build/icon.png`) — à remplacer par ta propre icône quand tu veux. Electron 44
(supporté) + electron-builder 26. Pas de signature : SmartScreen « Éditeur inconnu »
au premier lancement, normal.

Vérification de la syntaxe : `npm run check` — Tests automatiques : `npm test`

```
main.js           processus principal (fenêtres, fichiers, export PDF)
preload.js        pont isolé rendu <-> principal (window.elexio)
print-assets.js   inlining des SVG du PDF (file: -> data:)
index.html        redirection vers src/ (GitHub Pages)
src/
  index.html      onglets + panneaux
  styles.css
  model.js        modèle de données (arbre d'éléments) + migrations
  format.js       format de fichier `.elx` (JSON enveloppé + base64, versionné)
  default-schema.js  schéma pré-rempli à la création
  symbols.js      31 symboles RGIE + types de prise/interrupteur + SVG des montages
  symbols/        fichiers SVG autonomes
  standards.js    valeurs normalisées (calibres, sections, ancrages, pages A4)
  render.js       rendu SVG (grille, mise en page, cartouche)
  plan-model.js   modèle du plan d'implantation (pur) + migration v5
  plan-render.js  rendu SVG du plan (écran)
  plan-ui.js      interactions de l'onglet implantation
  plan-assets.js  magasin d'images de fond (hors projet, IndexedDB)
  plan-print.js   pages A4 du plan dans le dossier PDF
  rules-be.js     7 règles de validation
  ui.js           onglets, formulaires, interactions
  platform.js     shim web de window.elexio (version navigateur : PDF/ouverture)
tools/serve-browser.js  serveur local de test (navigateur)
test/             tests automatiques (node:test)
```

Le fichier de projet est un **`.elx`** : un JSON enveloppé puis **encodé en base64**.
L'enveloppe note le numéro de version (`format`, `formatVersion`, `schemaVersion`, `app`,
`exportedAt`) avant le projet. À l'import, le fichier est décodé puis sa version est
vérifiée : même version → chargement direct ; plus ancienne → **migration automatique** ;
plus récente → avertissement. L'import reste tolérant aux anciens `.json` en clair.
L'autosave reste **local** (stockage du navigateur ; en bureau, un miroir disque
`autosave.json` est écrit en plus dans le dossier de données).

---

## Avertissement

Les dessins de symboles sont des refontes à partir des descriptions du tableau 2.23,
**pas** des images officielles. À comparer au document du SPF Économie
(*Installations électriques — Symboles graphiques*) avant tout usage.

Les règles de `src/rules-be.js` sont des garde-fous de dessin, pas une référence
réglementaire. Chacune porte `verified: false` : aucune n'a été confrontée au texte
officiel du RGIE. Une validation par un professionnel est nécessaire avant tout usage réel.

Projet indépendant, sans lien avec l'éditeur Trikker (Bluebits BV / Anchr).
