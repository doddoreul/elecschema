# Elexio

Single-line diagram editor for Belgian domestic electrical installations.

- Target standard: RGIE / AREI (symbols from table 2.23, Book 1 Part 2)
- Scope: home installations, mono and triphasic
- **100% local**: no cloud, no license, no telemetry
- Desktop app (Windows, Electron) plus browser version (GitHub Pages)

> Personal-use project. Not a regulatory reference. See the [warning](#warning).

Available languages: [Read README in French](README_FR.md) | [Read README in Dutch](README_NL.md)

Current version: **0.5.3** (`v0.5.3`)

## Quick start

### Desktop (Windows)

`npm install` then `npm start`.

### Browser

Open https://doddoreul.github.io/elexio/ — nothing to install.

### Create a diagram in 5 minutes

1. **Informations tab**: fill site details, occupant, installer. They appear in the PDF cartouche.
2. **Schema tab**: the supply counter is at the bottom-left. Click the `+` to its right and choose a differential.
3. **Add a circuit**: click `+` right of the differential, choose a breaker (16A or 20A).
4. **Cable**: click `+` after a load/protection and choose cable. Fill conductors, section, type, mounting.
5. **Board**: add a distribution board when several circuits are needed.
6. **Plan and print**: switch to the Plan tab to place equipment and print.

Useful shortcuts:

- `Ctrl+S`: save
- `Ctrl+N`: new
- `Ctrl+Z / Ctrl+Y`: undo / redo
- `Ctrl+C / Ctrl+V`: copy / paste selected sub-circuit
- `Delete`: remove selection
- Mouse wheel: zoom
- Drag background: pan or rectangle selection

More details: [English tutorial](TUTORIAL_EN.md).

## Main features

- Tree-based single-line diagram: RCD, breaker, fuse, fil/cable, node, tableau.
- Cable prompt: conductors, section, type, mounting.
- Belgian rules checked in the Audit panel.
- Automatic circuit letters and equipment numbers.
- Distribution boards with several outputs.
- Layout with routing and overlap detection.
- Multilingual interface: FR / NL / EN.
- Plan tab with walls, openings, equipment placement and print.
- PDF export and page layout.
- Local `.elx` files, no cloud.

## Tests and quality

```bash
npm run check
npm test
npm run build
```

## Warning

Elexio is a personal-use editor. Validate every installation with the applicable official standard and competent inspector.

## License

MIT.
