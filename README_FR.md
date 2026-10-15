# Elexio

Éditeur de **schémas unifilaires** pour installations **domestiques** belges.

- Norme visée : **RGIE / AREI**
- Domaine : **habitation uniquement** — mono et triphasé
- **100 % local** : aucun cloud, aucun licence, aucune télémétrie
- Application **Windows** (Electron) + version navigateur (GitHub Pages)

> Projet à usage personnel. Ce n'est pas une référence réglementaire : voir [Avertissement](#avertissement).

Autres langues : [English](README.md) | [Nederlands](README_NL.md)

Version actuelle : **0.5.3** (`v0.5.3`, voir [release](https://github.com/doddoreul/elexio/releases/tag/v0.5.3))

## Démarrage rapide

### Bureau (Windows)

`npm install` puis `npm start`.

### Navigateur

Ouvrir https://doddoreul.github.io/elexio/ — rien à installer.

### Créer un schéma en 5 minutes

1. **Informations** : remplissez chantier, occupant, installateur.
2. **Schéma** : le compteur est en bas à gauche. Cliquez le `+` à sa droite et choisissez un différentiel.
3. **Circuit** : cliquez le `+` à droite du différentiel et choisissez un disjoncteur.
4. **Câble** : cliquez `+` près d'une charge ou protection et choisissez *Fil / câble* pour renseigner conducteurs, section, type, montage.
5. **Tableau** : ajoutez un tableau si plusieurs circuits sont nécessaires.
6. **Plan et impression** : onglet Plan, mise en pages, export PDF.

Raccourcis utiles :

- `Ctrl+S` : sauvegarder
- `Ctrl+N` : nouveau
- `Ctrl+Z / Ctrl+Y` : annuler / rétablir
- `Ctrl+C / Ctrl+V` : copier / coller un sous-circuit
- `Suppr` : supprimer
- molette : zoom
- fond : déplacer ou rectangle de sélection

Voir le tutoriel complet : [TUTORIAL_FR.md](TUTORIAL_FR.md)

## Fonctionnalités principales

- Schéma unifilaire en arbre : différentiels, disjoncteurs, fusibles, câbles, nodes, tableaux.
- Prompt câble : conducteurs, section, type, montage.
- Validation RGIE / NF C 15-100 dans le panneau Audit.
- Copier/coller de sous-circuits.
- Sélection par rectangle.
- Interface multilingue FR / NL / EN.
- Plan d'implantation : murs, ouvertures, appareils, impression.
- Export PDF et pages.
- Fichier `.elx` local.

## Contrôles qualité

```bash
npm run check
npm test
npm run build
```

## Avertissement

Elexio est un éditeur à usage personnel. Toute installation doit être validée selon la norme officielle et par le contrôleur compétent.

## Licence

MIT.
