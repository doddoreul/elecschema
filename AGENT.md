# AGENT.md

Fichier de reprise. A lire en premier apres un changement de contexte.

## Le projet

Elexio (ex-ElecSchema) - editeur de schemas unifilaires pour installations electriques
**domestiques** belges.
Norme visee : RGIE / AREI (symboles tableau 2.23). Mono **et** triphase.
**100% local** : pas de cloud, pas de licence, pas de telemetrie.
Usage personnel.
Depot : `doddoreul/elexio` (public). Version navigateur : GitHub Pages
(<https://doddoreul.github.io/elexio/>, `.github/workflows/pages.yml`, source `src/`).

### Nomenclature (domaine)

| Terme | Composition | Nommage |
|---|---|---|
| **Circuit** | disjoncteur + série de prises et/ou lumières | lettre |
| **Sous-circuit** | sous-branche d'un circuit (groupe de prises ou d'éclairages) | chiffre |
| **Groupe sous différentiel** | tous les circuits protégés par un différentiel | — |
| **Tableau principal** | groupes de différentiels + leurs sous-éléments | — |
| **Tableau divisionnaire** | sous-tableau du tableau principal | — |

Un groupe sous différentiel peut être placé sous un différentiel, et ainsi de suite.

## Stack

Electron 33 + JS natif (aucune lib lourde). Node 24. Windows 10/11.

## Commandes

```
npm start                                      lancer
npm test                                       tests auto (node --test : modele, regles, layout)
npm run check                                  syntaxe (node --check sur tout le JS)
npm run build                                  NSIS + portable -> dist/
npm version X.Y.Z --no-git-tag-version         bumper version
node tools/serve-browser.js [port]             test navigateur : working tree + commits/tags (/w/, /r/<ref>/)
```

Verification renderer (OBLIGATOIRE, voir plus bas) :
```
node_modules\electron\dist\electron.exe . --enable-logging=stderr > rc.out 2>&1
```

## Structure

```
index.html        redirection (Pages) vers src/
main.js           processus principal : fenetres, ouverture, PDF, recents
preload.js        pont isole (contextBridge -> window.elexio, sandbox:true)
print-assets.js   inlining des SVG du PDF (file: -> data:), pur/CJS
src/
  index.html      4 onglets + panneaux proprietes (1 onglet desactive : implantation)
  styles.css
  model.js        modele de donnees (arbre d'elements, migrations, reperage circuits)
  format.js       format de fichier .elx (JSON enveloppe + base64, versionne)
  default-schema.js  schema pre-rempli a la creation
  symbols.js      31 symboles + SOCKET_TYPES (10) + SWITCH_TYPES (7)
  symbols/        52 fichiers SVG autonomes (dessins, pas de JS)
  standards.js    valeurs normalisees (calibres, sections, delta, courbes, pages A4)
  render.js       rendu SVG + mise en page A4 + cartouche
  rules-be.js     6 regles de validation
  ui.js           onglets, formulaires, interactions
  platform.js     shim web de window.elexio (hors Electron : PDF/ouverture)
tools/serve-browser.js    serveur de test navigateur
tools/check-syntax.mjs    verificateur de syntaxe (npm run check)
test/                     tests automatises node:test (model, rules-be, layout, format)
.github/workflows/pages.yml  deploiement Pages
.github/workflows/ci.yml     syntaxe + tests (node --test)
TESTS.md          cas de test manuels
ROADMAP.md        etat + decisions
README.md         notice + tutoriel debutant
```

## Modele

```
Project { supply, info, elements[] }
supply   { id:1, symbolType:'compteur', label, detail, parent:null, dir:null, children{right} }
Element  { id, symbolType, parent, dir, label, labelLocked, detail, children{}, params?, count?, socketType?, switchType?, cable?, orient?, labelPos?, labelOffset?, showLabel?, poles? }
  children = { right|top|left|bottom : idEnfant | null }   arbre d'ancrage
params rcd     { rating, diff, type }
params breaker { rating, curve, icb }
params fuse    { rating, icb }
socketType     type de prise (voir plus bas), socket uniquement
switchType     type d'interrupteur (voir plus bas), switch uniquement
cable          { n, terre, section, type, montage }, fil uniquement
```

Decisions actees :
- **Aucun export CSV, jamais.**
- **Arbre unique d'elements** ancres par points d'ancrage. Les anciens concepts
  `circuits` / `difs` sont **supprimes** (migration legacy -> nodes, voir `migrateProject`).
- **Compteur : un seul point d'ancrage, a droite** (`freeAnchorDirs`, `drawAnchors`) ;
  plus aucun ancrage affiche des qu'il porte un enfant. Le « + » gris d'insertion
  (entre compteur et premier element) reste disponible.
- **Canvas epure** : titre, sous-titre chantier et pied de page ne sont plus dessines
  dans le SVG (voir le bandeau `#sheet-meta` / `refreshTitleBlock` et le PDF).
  Marges reduites : `TOP_PAD = 18`, `BOTTOM_PAD = 18`.
- Points d'ancrage : **tous les elements ont leurs 4 directions** (right, top, left,
  bottom) — sauf le **compteur** (droite uniquement) et le **tableau** (entree a gauche,
  sorties `top-n` + `bottom`). Voir `anchorKeysOf` / `freeAnchorDirs`.
- Un point d'ancrage ne recoit **qu'un seul** element.
- **Orientation initiale selon l'ancrage** (ANCHOR_ORIENT / orientForDir) : right = 90° (droite), top = 0° (haut), bottom = 180° (bas), left = -90° (gauche). Les symboles sont dessinés « conducteurs verticaux » : ils pivotent d'un quart de tour sur une liaison horizontale. Reste modifiable dans les propriétés.
- **Un element (hors node) qui a deja un enfant n'accepte plus aucun ajout** :
  ses « + » disparaissent ; pour ramifier il faut inserer un **node** (qui, lui,
  reste ramifiable tant qu'il a des ancrages libres).
- **Reste ramifiable meme avec un enfant** : le **node** **et le compteur** (`freeAnchorDirs`,
  `drawAnchors`) — leurs points d'ancrage libres restent affichés et utilisables.
- **Règles de composition** (`ACCEPT_RULES` / `canAccept`, vérifiée dans `addElement`, donc aussi
  au glisser-déposer) :
  - **compteur** → uniquement un **différentiel** (rcd) ;
  - **différentiel** → **disjoncteur** ou **autre différentiel** ;
  - **disjoncteur** → **tout** type, différentiel compris (donc disjoncteur sur disjoncteur).
  - Le **node** est toujours accepté (dérivation). Un refus affiche un message et
    `refreshPaletteAccept()` grise (`.sym-btn.nope`) dans la palette les symboles interdits
    pour la cible courante (ancrage cliqué ou élément sélectionné).
  - Hors règles : **node**, **fil** et **sectionneur**.
- **Orientation du texte** : propriété `labelRot` (champ « Orientation du texte » dans les
  propriétés). `auto` (défaut) = `orient - 90` **normalisé** (`+180` si < -90, sinon -90
  « retournerait » le texte) ; ou valeur imposée `0 / 90 / 180 / -90`. Le pivot du groupe
  de texte vaut `spinRot = rot - orient`. À `orient = -90` : repère en bas et horizontal.
  Champ masqué pour un node (aucune propriété) et pour le compteur (texte fixe).
- **Favoris & menu contextuel** : chaque symbole de la palette a une **étoile** (`.fav-star`, `bindStar`)
  qui bascule le favori (`localStorage 'elecschema.favorites'`, `toggleFavorite`, `favoriteKeys`).
  Section **« Favoris »** en tête de palette (`renderFavorites`, reconstruite par `renderPalette`).
  Les anciens « Récents » (fréquence) sont supprimés.
  Clic sur un « + » d'ancrage -> **menu contextuel** `#anchor-menu` (position fixe au point
  clique) listant les favoris + champ de recherche sur tous les symboles (`renderAnchorMenuList`) ; les symboles impossibles ici restent affichés grisés (`.nope`) ; choix -> ajout direct sur cet ancrage.
  Fermeture : clic externe, `Echap`, ou apres ajout.
- **Ajout depuis la palette** : cliquer un symbole l'**arme** (`armedSymbol`) ; chaque clic
  sur un « + » d'ancrage pose une copie et le symbole reste arme (re-clic ou Echap = desarmer).
  Un clic sur un « + » orange sans symbole arme ouvre le **menu contextuel** (`pendingAnchor`).
  `insertNode` insere un element (node compris) entre deux elements de la ligne.
- **Sectionneur (coupe à vide)** : symbole `sectionneur` (categorie « Protection », prefixe Q),
  nouveau fichier `symbols/sectionneur.svg`. **Hors règles de composition** : il peut être posé
  sur n'importe quel parent et recevoir n'importe quel type (`canAccept`).
- Le **node** (point de dérivation) est aussi présent dans la **palette** (categorie « Câbles ») :
  ajouté comme un élément normal sur un ancrage. Il s'insere egalement entre deux elements
  (clic sur le « + » au milieu d'un conducteur) :
  le parent pointe dessus, l'ancien enfant est reparente dans la meme direction.
  **Un node n'a aucune propriété** : pas de repère (aucun label auto), pas de désignation,
  pas d'orientation ni position de texte dans le panneau (seuls « Node » et « Supprimer »
  restent affichés), aucun texte dessiné sur le schéma, exclu du BOM.
  `normalizeTypes` nettoie les anciens champs hérités (label, labelPos, showLabel, poles…).
- Suppression d'un element : le **parent** est sélectionné ensuite (`selectOnly`). Ses enfants remontent au parent (1er ancrage libre), sinon au
  frere promu, sinon le sous-arbre est supprime.
- Compteur = racine, unique, **en bas a gauche**, editable au clic.
- Reperes auto par prefixe (Q, X, E, F, D...), globaux au projet.
- Unifilaire uniquement : jamais de schema developpe.
- **Autosave permanent** : le projet courant est serialise dans `localStorage`
  (`elecschema.autosave`) a *chaque* modification (`markDirty`/`restore`/`clearDirty`) et
  restaure au demarrage (`restoreAutosave()`). En bureau, un **miroir disque** est ecrit
  en plus (`autosave:write`, debounce 400 ms, `userData/autosave.json`, ecriture atomique)
  et sert de repli si le `localStorage` est vide (profil efface). Enregistrer (Ctrl+S)
  ecrit dans le stockage local.
- **Format de fichier `.elx`** (`src/format.js`) : JSON enveloppe (`format`,
  `formatVersion`, `schemaVersion`, `app`, `exportedAt`, `project`) puis **encode en
  base64**. « Exporter » telecharge un `.elx` ; « Ouvrir » le decode et verifie la
  version : plus ancienne -> **migration automatique**, plus recente -> avertissement.
  `main.js` ne fait que lire/ecrire le texte brut ; le decodage et le controle de
  version sont dans le rendu (ESM partage navigateur/bureau). Tolerance de lecture pour
  les anciens `.json` en clair.
- **Prises** : un seul symbole palette `socket` ; la propriete **type de prise**
  (`socketType`, defaut `earth_childproof`) choisit le fichier SVG parmi `SOCKET_TYPES`
  (`symbols.js`). 10 types : generic, waterproof, earth, childproof, earth_childproof,
  earth_childproof_double, earth_childproof_triple, switch, switch_lock, transformer.
  Rendu : `socketUrl(node.socketType)`.
  `normalizeSockets()` convertit les anciens types eclates (socket_earth, ...) a l'ouverture.
- **Interrupteurs** : un seul symbole palette `switch` ; la propriete **type d'interrupteur**
  (`switchType`, defaut `simple`) choisit le fichier SVG parmi `SWITCH_TYPES` (`symbols.js`).
  7 types : simple, bipolar, tripolar, double, two_way (switch_2D), two_way_bipolar
  (switch_2D_bipolar), inverter (switch_inverter). Rendu : `switchUrl(node.switchType)`.
  `normalizeTypes()` mappe les anciens types eclates (socket_earth, switch_2way, ...) a l'ouverture.
- **Fil / câble** : element `fil` (categorie palette « Câbles »). Proprietes dans `node.cable`
  (= `DEFAULT_CABLE` : { n, terre, section, type, montage }). `CABLE_TYPES` : EXVB, XVB, XGB,
  VOB, EXAVB, XFVB. `MOUNT_TYPES` : apparent/encastre (sans ou avec conduit), enterree,
  aerienne. Sur le schema, le fil n'affiche **que le type + la section** de cable
  avec « mm² » (par ex. « XVB 2,5mm² ») — ni conducteurs, ni terre, ni montage. Exclu de
  la règle « élément avec enfant » et de BE-06 (pas de repere obligatoire).
  **Taille du symbole : 40 x 80** (width 40, height 80 — 2x plus haut ; viewBox 40x80 attendu).
- **Dessin du fil selon le montage** : `FIL_MOUNT_FILES` (`symbols.js`) mappe
  `node.cable.montage` -> fichier SVG (`filUrl(node)`, repli `fil.svg`) :
  apparent, apparent_conduit, encastre, encastre_conduit, enterree, aerienne.

- **Tableau / sous-tableau** : nouveau symbole `tableau` (« Tableau (barre) », catégorie
  « Tableaux », préfixe `TB`), fichier `symbols/tableau.svg` (64 x 24, barre de 5 pt).
  - **toujours horizontal** par défaut (`e.orient = 0` à la pose, réglable ensuite) ;
  - **ramifiable** comme un node (`freeAnchorDirs`, `drawAnchors`) : plusieurs départs ;
  - **hors règles de composition** (`canAccept`) : posable partout, y compris sur un
    tableau ou un disjoncteur → cascade possible ;
  - repaire **toujours affiché** (`showLabel = true` dans `createElement`) ;
  - reçoit circuits (disjoncteurs), circuits sous différentiel, sectionneurs, fils, nodes…
  **Étape suivante** : départs numérotés sur la barre (`top-1..n`, `bottom-1..n`) via
  `anchorKeysOf('tableau')` + extension de `children` (clés composites) et du layout.

- **Propriétés à l'ajout** (`PROMPTS`, `askProps`, `promptFor`, dialogue `#prop-dialog`) : disjoncteur (calibre 16 A, courbe C, pôles 2P), différentiel (sensibilité 30 mA, intensité 63 A, type AC, pôles 2P), prise (type terre + enfant), interrupteur (simple). Chaque invite a aussi le champ **Repère** (texte, vide = automatique) ; un repère saisi est verrouillé (`applyProps`). Annuler = rien n'est posé. Appliqué par `addWithProps` (ancrage, dépôt, menu, symbole armé) et `insertNode` (entre éléments).
- **Mode « Trikker-like »** (branche `like-trikker`) :
  - Clic sur un symbole de la palette = **armé** (`armedSymbol`, surbrillance orange). Chaque clic sur un « + » orange pose une copie ; le symbole reste armé. Clic sur le même symbole ou Échap = désarmer. Seuls les « + » acceptés par le symbole sont affichés (`opts.accepts`).
  - « + » gris entre deux éléments : ouvre le **menu contextuel en mode « intercaler »** (`openAnchorMenu(..., 'insert')`, `placeable`, `insertWithProps`). Aucun type par défaut : l'utilisateur choisit (node compris). Le menu n'affiche grisés que les types impossibles sur le parent ou devant l'enfant existant. L'enfant suit dans la ligne.
  - **Circuits** (`renumberCircuits`, appelé dans `refreshAll`) : disjoncteur/fusible sous tableau, différentiel, compteur ou node = début de circuit → lettre A, B… Z, AA, AB (`letterOf`). Symboles du circuit → `lettre + n` (1, 2…). Fil, node, tableau et sectionneur sans repère auto. Un repère saisi à la main verrouille l'élément (`labelLocked`) et lui conserve son nom.
  - Le repère d'un début de circuit s'affiche par défaut (`showLabel`).
  - Le clic sur un « + » sans symbole armé ouvre le menu contextuel (bouton « + Node » pour intercaler un node).
- **Tableau** (`tableau`) :
  - Une entrée à **gauche** (occupée par le parent, le conducteur arrive au bout de la barre), des **sorties en haut** : clés `top-1`, `top-2`… (`anchorKeysOf`, `baseDir`, `outputIndex` dans `standards.js`).
  - `node.outputs` = nombre de sorties, **toujours une sortie vierge après la dernière occupée** (minimum 2) : recalculé à chaque rafraîchissement (`syncOutputs`, appelée dans `refreshAll`). La barre s'élargit à l'ajout et se réduit à la suppression (`tabSpan`).
  - La sortie `top-k` place l'enfant dans la colonne `k` (`computeLayout`, `portOf`). La barre est dessinée horizontalement (`drawBar`). Le texte d'un tableau est **toujours en bas, horizontal** (position et orientation du texte masquées, `drawBar` force `labelPos: 'bottom'`). **Un tableau n'est jamais pivoté** : orient forcée à 0 (`normalizeTypes`, champ Orientation masqué, valeur ignorée à la saisie).
  - Supprimer un élément posé sur une sortie retire **ce point d'ancrage** (`removeOutput`) : les sorties suivantes remontent d'un cran. Ses enfants acceptés se reposent en fin de barre ; les autres sont supprimés.
  - Accepte `rcd`, `breaker`, `sectionneur` et `fil` (`TABLEAU_OUTPUT_TYPES`, en tête de `canAccept`).
  - Disposition (`computeLayout` dans `render.js`) : routage orthogonal. Chaque enfant part de son port (de préférence dans sa direction, sinon de biais avec pénalité), puis tourne au besoin. Un tracé est refusé s'il touche un élément ou un autre fil (`routeFree`, `segHit`). Les branches rectilignes sont posées avant les détours. Quand un détour est nécessaire, la branche bloquante est décalée (`bias`, `blockerOf`) et tout est recalculé (plafonné à 6 décalages par branche, 30 itérations). Résultat mis en cache (`layoutMemo`).
  - **Limite connue** : dans les configurations très denses (élément entouré de ses propres enfants sur ses 4 ancrages), le plafond peut laisser un passage forcé. Cas rares, pas de garantie formelle. Le layout renvoie `bump != null` quand le plafond est atteint ; `layoutForced()` l'expose et `ui.js` (panneau Controles) affiche alors un **avertissement « trace contraint »**.
  - Migration à l'ouverture (`normalizeTypes`) : clé `top` → `top-1`, autres clés renumérotées.

## Mise en page (render.js)

Arbre d'ancrage sur une **grille** (1 element / cellule, sans recouvrement) :
- Compteur racine place en bas a gauche ; le flux va a **droite** puis vers le **haut**.
- Placement glouton recursif : l'enfant va dans la cellule voisine selon la direction de
  l'ancrage ; si occupee, on avance tout droit jusqu'a une case libre (conducteur rectiligne).
- Conducteurs = segments entre centres de cellules (horizontal ou vertical).
- **« + » vert** (`data-anchor="id:dir"`) = ancrage libre -> cliquez puis un symbole.
  **« + » gris** au milieu d'un conducteur (`data-link="id:dir"`) = insérer un node.
- Les « + » d'ancrage d'un élément ne s'affichent que lorsque celui-ci est **sélectionné**
  (pendant un glisser-déposer depuis la palette : sur tous les éléments pour pouvoir déposer).
- **Les « + » sont dessinés en dernier** (au-dessus des symboles) pour rester cliquables —
  indispensable pour le compteur, plus large qu'une cellule. Leur position dépasse le bord du
  corps (`halfOf` : compteur 44×32 → +50/+38 px du centre). Le « + » gris d'insertion se
  décale vers l'enfant (`t` entre 0,5 et 0,85) pour sortir du corps du parent.
- Glisser-déposer : accepte **uniquement** sur un point d'ancrage (« + » vert), jamais sur
  le corps d'un élément ni sur le fond.
- **Sélection multiple** : `selectedIds` (Set) + `selectedId` (élément primaire = dernier cliqué).
  **Maj + clic** sur un élément l'ajoute/le retire (`toggleElement`) ; clic simple = sélection unique.
  Le panneau de propriétés affiche alors « N éléments sélectionnés… » au lieu du formulaire.
  `Suppr` supprime **toute** la sélection. `selectedIds` est passé au rendu (`opts.selectedIds`) pour
  surligner tous les éléments retenus et afficher leurs ancrages.
- **Hitbox pivotée** : le `rect.outline` de `symbolGroup` est dans le groupe `rotate(orient)`,
  donc **tout l'élément tourne** (image + zone cliquable). Corrige le cas du fil 40x80 :
  à l'horizontal la hitbox suivait mal l'image. Idem pour le compteur (bloc dessiné à part).
- Clics : pointerdown sur `data-el` / `data-anchor` / `data-link`.
- **Repères / descriptions** : position du texte `labelPos` (top/bottom/left) **dans le repère local de l'élément**. Le bloc de texte pivote de **`orient - 90°`** (groupe `spin` = `rotate(-90)` dans le groupe `rotate(orient)`) :
  - **0°** = à droite (texte −90°), **90°** = en bas (texte 0°), **180°** = à gauche (texte 90°), **−90°** = au-dessus (texte 180°).
  - Défaut `labelPos = 'bottom'` (bas local → droite écran à 0°). Les textes sont toujours ancrés `middle`.
  - `showLabel` : false par défaut pour **breaker/rcd**, true pour les autres (case à cocher dans les propriétés). `poles` : `1P|2P|3P|4P` pour disjoncteurs (`1P`) et différentiels (`2P`).
  - **Distance réglable** `labelOffset` (px, défaut **-5**) : champ « Distance du texte » (`#e-labeloffset`, range −24…60) dans les propriétés, **un seul axe** (la normale au bord du symbole). Une valeur négative rapproche/chevauche l'élément. Masqué pour un node ; le compteur l'applique sur son axe vertical.
  - **Prises** : aucun repère auto (`NO_AUTO_LABEL = ['node','socket']`) et aucun détail affiché (`deviceDetail` renvoie `''`) → le schéma reste muet ; un libellé n'apparaît que si l'utilisateur saisit le champ repère. `normalizeTypes` vide les anciens repères auto `^X\d+$`. Le BOM affiche « — » en détail.
  - Détail (`deviceDetail`) : breaker = `poles - courbe+calibre` (ex. « 2P - C16A »), rcd = **3 lignes** « ΔxmA », « 2P - 40A », « Type AC » (`.lbl-sm` en `white-space: pre-line`, tourne avec le bloc).
- Canvas : svg plein cadre (CSS), zoom/pan = viewBox seulement (pas de re-rendu).
  Molette = zoom curseur, bouton milieu ou clic fond = pan, Ajuster = fitView().
- `fitView()` apres chargement / nouveau projet.

## Regles

`src/rules-be.js`, 6 regles : BE-01 schema sans element (erreur), BE-03 prise sans
delta 30 mA en amont, BE-04 protection sans calibre, BE-05 reperes en double,
BE-06 symbole sans repere, BE-08 dossier incomplet.
**Toutes ont `verified: false`** : jamais confrontees au texte officiel RGIE.

## Pieges connus

1. **`stderr` seul ne montre PAS les erreurs JS du renderer.** Sans
   `--enable-logging=stderr`, une app cassee parait saine. Toujours verifier ainsi.
2. `Get-Content` lit en ANSI : les fichiers .md/.js semblent mojibakes alors qu'ils
   sont en UTF-8 valide. Ne pas "corriger" l'encodage. Verifier avec :
   `[Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($f))`
3. PowerShell traite la sortie stderr de git comme une erreur. Un push reussi
   affiche `CategoryInfo: RemoteException`. Verifier avec
   `git rev-parse HEAD` vs `origin/main`.
4. Dupliquer une declaration (`const`/`let`) casse tout le module. Verifier apres
   ajout de code, surtout dans `ui.js` qui a ete beaucoup édite.
5. **IDs** : le compteur porte l'ID fixe `1`. `idCounter` demarre a `2`. Sinon un element
   cree prend l'ID 1 et cree un cycle infini au parcours de l'arbre (stack overflow).

## Build des .exe

Electron **44** (supportee) + electron-builder **26** (voir package.json). Icône :
`build/icon.ico` (PNG-in-ICO 256 px) + source `build/icon.png` (remplacer les deux
pour changer l'icône).

electron-builder patche l'exe (icône, version, description) via `resedit`
(`signAndEditExecutable` par défaut). Pas de certificat de signature : artefacts
non signes -> SmartScreen "Editeur inconnu" au 1er lancement. Normal.

Commandes :
```
npm run build          # NSIS (dist/Elexio-Setup-0.3.0.exe) + portable (dist/Elexio-portable-0.3.0.exe)
npm run build:portable # portable seul
npm run build:dir      # version decompressee dist/win-unpacked (test rapide)
```

Premier build : télécharge Electron + NSIS + winCodeSign dans
`%LOCALAPPDATA%\electron-builder\Cache` (les suivants passent hors ligne).
`dist/` est gitignore (seul `dist/Projets/` — donnees utilisateur — est conserve).

Note schéma : dans electron-builder 26, `publisherName` n'est plus une propriété
valide de `win` (schéma `WindowsConfiguration`).

## Etat actuel (oct. 2026)

- Etapes 1-6 et 8-9 livrees. **Etape 7 (PDF) livree** : `buildPrintHtml()` +
  handler `pdf:export`. Dossier : cartouche general, schema (une page A4 par page de
  mise en page), liste des circuits, liste du materiel. En navigateur, `window.print()`.
  Les SVG de symboles sont **inlines en `data:`** (`print-assets.js`) avant chargement :
  le PDF ne depend plus de l'acces `file:` depuis la page `data:`.
- **Mise en page multi-pages** : cadres A4 paysage cote a cote, cartouche sur chaque
  page, zoom + liste des pages dans le panneau de droite, deplacement du dessin entier,
  panoramique a la barre d'espace (curseur main).
- **Refonte ancrages** : modele en arbre d'elements + points d'ancrage ; nodes ;
  compteur en bas a gauche. Remplace circuits/difs. Legacy migre a l'ouverture.
- Nom : **Elexio** (ex-ElecSchema). Version 0.3.0.
- Electron **44** (supportee) + electron-builder **26** ; build NSIS + portable avec
  icone `build/icon.ico`.
- Depot : https://github.com/doddoreul/elexio (public). Pages :
  https://doddoreul.github.io/elexio/
- Credential GitHub stocke via Git Credential Manager (chiffre, pas dans .git/config).

## Secrets

Un token GitHub avait ete expose dans une ancienne conversation : il a ete
**revoque et remplace**. Le nouveau jeton est stocke par Git Credential Manager
(chiffre, hors du depot et hors de .git/config). Regle : aucun token en clair
dans un fichier, un commit ou .git/config ; le depot etant public, tout jeton
expose doit etre considere comme compromis et revoque.

## Non versionne (.gitignore)

`node_modules/`, `dist/`, `*.log`, `capture.js`, `capture.png`, `test-render.html`
(outils de verification visuelle, restent sur le disque).

## Verification visuelle

Le screenshot navigateur exige une fenetre visible (absente de cet environnement).
Outils : `node tools/serve-browser.js [port]` (serveur local) ; `capture.js`
(Electron capturePage, non versionne). Mais la verite vient de la mesure DOM via
`getBBox()`, pas de l'image.

## Consignes de travail

- Caveman ultra, le plus ters possible.
- Ne modifier dans les fichiers que le necessaire. Pas de regroupement de
  fonctions, pas de reecriture "propre" non demandee.
- **Ne pas recompiler les .exe** sans demande explicite.
- Faire le **minimum de tests** : `npm test` (rapide, sans dependance) + `npm run check` si le doute. **Ne pas lancer Electron** à chaque prompt (seulement sur demande explicite). Pas de capture d'ecran systematique.
- Reponses tres courtes : une phrase si possible.
- Petites modifications : modifier directement le code sans presenter de plan.
- Ne pas reformuler la demande ni decrire chaque etape.
- Modifier uniquement les fichiers necessaires.
- Ne pas explorer tout le projet si la demande concerne un fichier precis.
- Apres modification, indiquer uniquement les fichiers modifies et le resultat.
- Ne pas lancer de tests/verifications inutiles pour une modification simple.
- Demande claire : executer sans poser de questions.
- Signaler brievement les erreurs ou ambiguities bloquantes.
- Preserver le comportement existant ; eviter les refactorisations non demandees.
