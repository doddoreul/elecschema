# Elexio Tutorial

Beginner guide for preparing a single-line diagram and an installation plan with Elexio.

## 1. Getting started

- Desktop (Windows): `npm install`, then `npm start`.
- Browser: open `https://doddoreul.github.io/elexio/`

Choose a new project, open an existing file, or resume a recent project.

Save with `Ctrl+S`. Project files use `.elx`. Everything stays local.

## 2. Interface

- **Informations tab**: site, occupant, installer, designer, inspection schedule.
- **Schema tab**: single-line diagram editor.
- **Plan tab**: wall placement and device positioning.
- **Left palettes**: RGIE/AREI symbols, cables, favorites.
- **Right panel**: properties, BOM, pages, validation issues.
- **Language selector**: FR / NL / EN.

## 3. Fill in information

Fill site details and type of supply. This information appears in the PDF cartouche.

## 4. Single-line diagram

The supply counter is placed at the bottom-left. Add branches from anchor points.

Steps:

1. Click `+` right of the counter and choose an RCD.
2. Click `+` right of the RCD and add a breaker (`A`, `B`, ...).
3. Add a cable with conductors, section, type and mounting.
4. Add a distribution board from a breaker/differential where needed.

Selection:
- Shift + click: multi-select.
- Drag on empty background: selection rectangle.
- Delete: remove selected items except the supply.
- Many electrical devices have a single anchor opposite their entry direction.

## 5. Properties

Select an element to edit repere, visibility, orientation, offsets, poles, params, cable fields.

Repere prefixes are automatic for some elements. Elements without repere (`node`, parallel node, socket, cable, kwh) remain empty until entered.

## 6. Belgian validation

The Audit panel lists warnings:
- missing 30 mA differential in front of sockets;
- missing calibre;
- duplicate repere;
- incomplete dossier;
- insufficient conductor section for calibre;
- minimum number of lighting circuits;
- unplanned equipment;
- and internal rules.

Protection types are checked against the RGIE/NF C 15-100 table (disjoncteur, RCD and fuse).

## 7. Installation plan

Use the Plan tab for walls, openings, rooms and equipment positions. Each device can be placed and checked before printing.

## 8. Print / PDF

Use print preview, page list, zoom and centering. The layout shifts the whole drawing on the printed page; recentring places it centered.

## 9. Import / Export

- Save: `Ctrl+S`.
- Open/apply JSON.
- Validation is light: minimal structural fields are checked.
- Copy/paste sub-circuits with Ctrl+C / Ctrl+V.

## 10. Languages

Choose FR, NL or EN in the toolbar. Labels, messages and palette names are translated.

## 11. Keyboard shortcuts

- `Ctrl+S`: save
- `Ctrl+N`: new
- `Ctrl+Z` / `Ctrl+Y`: undo / redo
- `Ctrl+C` / `Ctrl+V`: copy / paste (diagram)
- Delete: remove selected items
- Mouse wheel: zoom
- Drag background: pan or rectangle selection

## 12. Troubleshooting

- No item visible: recentre or zoom out.
- JSON refused at import: check duplicate IDs, parent existence and schema structure.
- Forced layout warning: reduce density or move branches manually.
- PDF problems: verify project info and page list.

End of tutorial.
