# Elexio

Éénlijnschema-editor voor Belgische huishoudelijke elektrische installaties.

- Norm: RGIE / AREI
- Domein: woningen — eenfase en driefase
- **100 % lokaal**: geen cloud, geen licentie, geen telemetrie
- Desktop (Windows, Electron) + browserversie (GitHub Pages)

> Project voor persoonlijk gebruik. Geen officiële regelgeving — zie [waarschuwing](#waarschuwing).

Andere talen: [English](README.md) | [Français](README_FR.md)

Huidige versie: **0.5.3** (`v0.5.3`, zie [release](https://github.com/doddoreul/elexio/releases/tag/v0.5.3))

## Snel starten

### Desktop (Windows)

`npm install` dan `npm start`.

### Browser

Open https://doddoreul.github.io/elexio/ — niets te installeren.

### Maak een schema in 5 minuten

1. **Informatie**: vul werf, bewoner, installateur in.
2. **Schema**: de telmeter staat links onderaan. Klik het `+` er rechts van en kies een differentieel.
3. **Circuit**: klik `+` rechts van het differentieel en kies een automaat.
4. **Kabel**: klik `+` bij een toestel of beschermer en kies kabel; vul aders, doorsnede, type en montage in.
5. **Tabel / bord**: voeg een vermogensbord toe indien nodig.
6. **Plan en afdruk**: gebruik de Plan-tab en exporteer PDF.

Handige sneltoetsen:

- `Ctrl+S`: opslaan
- `Ctrl+N`: nieuw
- `Ctrl+Z / Ctrl+Y`: ongedaan maken / opnieuw
- `Ctrl+C / Ctrl+V`: kopiëren/plakken van een subcircuit
- `Delete`: verwijderen
- muiswiel: zoom
- achtergrond slepen: pannen of kaderselectie

Volledige gids: [TUTORIAL_NL.md](TUTORIAL_NL.md)

## Belangrijkste functies

- Éénlijnschema als boomstructuur: differentieën, automaten, zekeringen, kabels, nodes, tabbladen.
- Kabel-dialoog: aders, doorsnede, type, montage.
- RGIE / NF C 15-100 controles in het auditpaneel.
- Kopiëren/plakken van subcircuits.
- Kaderselectie.
- Meertalige interface: FR / NL / EN.
- Installatieplan: muren, openingen, toestellen, afdruk.
- PDF-export en paginalay-out.
- Lokaal `.elx` bestand.

## Kwaliteitscontrole

```bash
npm run check
npm test
npm run build
```

## Waarschuwing

Elexio is een editor voor persoonlijk gebruik. Elke installatie moet worden gecontroleerd volgens de officiële norm en door de bevoegde controleur.

## Licentie

MIT.
