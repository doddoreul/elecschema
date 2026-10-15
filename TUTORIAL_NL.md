# Elexio handleiding

Gids voor beginners in het opstellen van een eenlijnschema en een installatieplan met Elexio.

## 1. Starten

- Desktop (Windows): `npm install`, dan `npm start`.
- Browser: open `https://doddoreul.github.io/elexio/`

Kies een nieuw project, een bestaand bestand of een recent project.

Opslaan met `Ctrl+S`. Projectbestanden gebruiken `.elx`. Alles is lokaal.

## 2. Interface

- **Informatie-tab**: werf, bewoner, installateur, tekenaar, inspectieplanning.
- **Schema-tab**: editor voor het eenlijnschema.
- **Plan-tab**: muren, openingen, apparaten en opmaak.
- **Paletten links**: RGIE/AREI symbolen, kabels en favorieten.
- **Rechterscherm**: eigenschappen, BOM, pagina's, controleissues.
- **Taal**: FR / NL / EN.

## 3. Informatie invullen

Vul minstens werf, bewoner en installateur in. De data verschijnt in het PDF-kaderstuk.

## 4. Eenlijnschema

De tel:meter staat links onderaan. Voeg takken toe via ankers (`+`).

Stappen:
1. Klik `+` rechts van de meter en kies een differentieel.
2. Klik `+` rechts van het differentieel en kies een automaat (`A`, `B`, ...).
3. Voeg een kabel toe met aantal aders, doorsnede, type en montage.
4. Voeg een vermogensbord / tableau toe waar nodig.

Selectie:
- Shift + klik: multi-select.
- Sleep op lege achtergrond: selectiekader.
- Delete: geselecteerde items verwijderen, behalve de tel:meter.
- Sommige toestellen hebben een enkele ankerpunt recht tegenover de ingang.

## 5. Eigenschappen

Selecteer een element om aanduiding, zichtbaarheid, draaitwee, offsets, polen, params en kabelvelden te wijzigen.

Sommige elements krijgen automatisch een repere. Elements zonde repere (`node`, parallel node, stopcontact, kabel, kwh) blijven leeg totdat u zelf een repere invoert.

## 6. Belgische controle

De controlescherm toont waarschuwingen:
- geen 30 mA differential voor stopcontacten;
- ontbrekend calibre;
- duplicate repere;
- onvolledig dossier;
- onvoldoende geleiderdoorsnede;
- minimumaantal verlichtingscircuits;
- niet geplaatste toestellen;
- en andere interne regels.

Doorsnedes worden gecontroleerd tegen het table voor RGIE/NF C 15-100 volgens type bescherming.

## 7. Installatieplan

Gebruik de Plan-tab om muren, openingen, lokalen en toestellen te plaatsen en de afdruk te controleren.

## 8. Afdrukken / PDF

Gebruik afdrukvoorbeeld, pagina's, zoom en centering. De opmaak regelt de positie van het schema op de pagina.

## 9. Import / export

- Opslaan: `Ctrl+S`.
- JSON openen/toepassen.
- Controle is beperkt: minimale structurele velden worden nagekeken.
- Subcircuits kopiëren/plakken met Ctrl+C / Ctrl+V.

## 10. Taal

Kies FR, NL of EN in de balk. Teksten, berichten en paletten volgen mee.

## 11. Sneltoetsen

- `Ctrl+S`: opslaan
- `Ctrl+N`: nieuw
- `Ctrl+Z` / `Ctrl+Y`: ongedaan maken / opnieuw
- `Ctrl+C` / `Ctrl+V`: kopiëren / plakken (schema)
- Delete: verwijderen
- Muiswiel: zoom
- Achtergrond slepen: pannen of kaderselectie

## 12. Problemen oplossen

- Niets zichtbaar: recentreer of zoom uit.
- JSON wordt niet geopend: controleer dubbele IDs, bestaande ouders en structuur.
- Layout geforceerd: verminder de dichtheid of verplaats takken.
- PDF-problemen: controleer projectgegevens en paginalijst.

Einde van de handleiding.
