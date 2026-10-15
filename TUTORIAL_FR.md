# Tutoriel Elexio

Ce tutoriel guide un utilisateur débutant dans l'utilisation d'Elexio pour préparer un schéma unifilaire et un plan d'implantation.

## 1. Démarrage

### Lancer l'application

- Fenêtre Windows : `npm install`, puis `npm start`.
- Navigateur : ouvrir `https://doddoreul.github.io/elexio/`.

Au démarrage vous retrouvez un écran d'accueil. Choisissez *Nouveau*, *Ouvrir un fichier* ou reprenez un projet dans *Récents*.

### Sauvegarde

- Sauvegarde locale : `Ctrl+S`.
- Fichier : extension `.elx`.
- Pas de périphérique dans le cloud : emportez votre fichier normalement.

## 2. Présentation de l'interface

- **Onglet Informations** : chantier, occupant, installateur, dessinateur et contrôle.
- **Onglet Schéma unifilaire** : éditeur de schéma.
- **Onglet Plan** : implantation murale et placement.
- **Palettes à gauche** : symboles RGIE/AREI, câbles et favoris.
- **Barre de droite** : propriétés, BOM, pages, issues d'audit/rgles.
- **Barre inférieure** : statut, langue, version.

## 3. Remplir les informations

1. Renseignez au minimum : dénomination du chantier, code postal, localité et dates.
2. Complétez installateur + dessinateur ; ils apparaissent dans le cartouche PDF.
3. Choisissez le domaine (domestique), pays (BE), alimentation (MONO/TRI), norme (RGIE/NFC).
4. Les champs sont optionnels au début mais utiles pour la remise au contrôle.

## 4. Schéma unifilaire

### Principe

Le compteur d'arrivée est posé en bas à gauche. Le schéma grandit à droite et vers le haut. Vous placez des **ancrages** pour ajouter les éléments.

### Ajouter un différentiel

1. Cliquez le `+` à droite du compteur.
2. Dans le menu, cliquez le différentiel.
3. La boîte de dialogue demande :
   - repère, intensité nominale, sensibilité, type, pôles ;
4. Validez : le différentiel se place juste après le compteur.

### Ajouter un disjoncteur

1. Cliquez le `+` à droite du différentiel.
2. Choisissez *Disjoncteur*.
3. Indiquez calibre, courbe, pôles.
4. Le disjoncteur devient le début d'un circuit et reçoit une lettre automatique (A, B, …).

### Ajouter un câble / fil

1. Cliquez `+` à côté d'un consomateur ou protection.
2. Choisissez *Fil / câble*.
3. Répondez au dialogue : nombre de conducteurs (`3G`), section (mm²), type (XVB), montage.
4. Le fil n'a qu'un point d'ancrage de sortie ; il s'adapte à la direction.

### Tableau de répartition

1. Ajoutez le tableau sur un différentiel (c'est le point de départ des circuits).
2. Il se déroule horizontalement ; chaque `top-k` est un circuit.
3. Les sorties libres apparaissent automatiquement après la dernière utilisée.

### Séléctionner plusieurs éléments

- Maj + clic : ajoute/retire un élément à la sélection.
- Glisser-déplacer sur le fond : rectangle de sélection.
- ← / → / ↑ / ↓ : pas disponibles ; utilisez la souris.
- Suppr : supprime les éléments sélectionnés (sauf le compteur).

## 5. Propriétés

Cliquez un élément. Panneau de droite :

- **Repère** : saisi manuellement ou verrouillé avec la case *Verrouiller*.
- **Libellé/affichage** : case *Afficher le repère*.
- **Orient** : 0, 90, 180, 270°.
- **Offsets** : décalage du texte.
- **Params** : calibre, courbe, pôles, diff, type, fidélité du différentiel.
- **Câble** : section, type, montage (seulement pour les fils).

Libellés automatiques par préfixe (`W`, `Q`, `X`, `E`, ...). Les symboles sans repère (`node`, `node_parallel`, `socket`, `fil`, `kwh`) conservent une zone vide si non saisie.

## 6. Règles de validation belges

Au fil du dessin, la liste *Audit* affiche les alertes :

- absence de différentiel 30 mA en amont des prises ;
- protection sans calibre ;
- repères en double ;
- dossier incomplet ;
- section de conducteur insuffisante pour le calibre ;
- nombre minimum de circuits d'éclairage ;
- composant non placé sur plan ;
- et autres règles internes LISTE DES 7 RÈGLES DÉFINIES.

La règle de section dépend du type de protection :
- différentiel/disjoncteur : tableau RGIE/NFC ;
- fusible : tableau selon fusible.

## 7. Plan d'implantation

Passz à l'onglet Plan pour placer les appareils dans la maison. Vous pouvez :

- tracer des murs ;
- ajouter des portes/fenêtres ;
- placer les symboles au bon endroit ;
- associer plusieurs niveaux/étages ;
- imprimer à l'échelle.

## 8. Impression / PDF

- Onglet Schéma + Prévisualisation d'impression.
- Réglage des pages, zoom, centre.
- `Ctrl + + / -` zoom de l'affichage (molette aussi).
- Bouton de mise en page : centre le schéma sur la page.
- Ajuster centrer sur le schéma.

## 9. Import / Export

- Exporter : `Ctrl+S` + *Enregistrer sous*.
- Importer : ouvrir, copier-coller le JSON, *Appliquer*.
- Validation légère à l'import : seuls les champs essentiels et les parents valides sont acceptés.
- Copier/coller de sous-circuits : `Ctrl+C` puis `Ctrl+V`.

## 10. Langues

 Choisissez FR / NL / EN dans la barre d'outils. Les textes, messages et palettes suivent.

## 11. Raccourcis

- Ctrl+S : sauver
- Ctrl+N : nouveau
- Ctrl+Z / Ctrl+Y : annuler/rétablir
- Ctrl+C / Ctrl+V : copier/coller (schéma)
- Suppr : supprimer
- Molette : zoom
- Fond : déplacer la vue / rectangle de sélection

## 12. Dépannage

- Si le JSON ne s'ouvre pas : vérifiez `schemaVersion`, IDs uniques et parents existants.
- Si des éléments sont invisibles, faites *Recentrer*.
- Si un layout est *contraint* (bump), déplacez manuellement ou réduisez la densité.
- Si la règle BE-xx apparaît, lisez le détail dans le panneau Audit.

Fin du tutoriel. Bon travail !
