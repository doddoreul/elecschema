// Neutralise les dépendances `file://` du HTML d'impression : les SVG de symboles
// référencés en `file:` sont convertis en `data:` URIs. La page `data:` du PDF ne
// dépend alors plus de l'accès fichier de Chromium (plus robuste, indépendant de
// la version d'Electron).
//
// Fonction pure : `read(url)` fournit le contenu d'une URL fichier. Utilisée par
// main.js (lecture réelle) et par les tests (lecteur simulé).
'use strict';

const FILE_SVG = /"(file:[^"]+\.svg)"/g;

/** URLs `file:*.svg` référencées dans le HTML (dédupliquées). */
function collectFileSvgs(html) {
  const urls = new Set();
  for (const m of html.matchAll(FILE_SVG)) urls.add(m[1]);
  return [...urls];
}

/** Remplace les SVG `file:` par des `data:image/svg+xml;base64,...`.
 *  Une lecture en échec laisse l'URL d'origine intacte. */
async function inlineSymbolSvg(html, read) {
  const urls = collectFileSvgs(html);
  if (urls.length === 0) return html;
  const map = new Map();
  for (const u of urls) {
    try {
      const buf = await read(u);
      map.set(u, 'data:image/svg+xml;base64,' + Buffer.from(buf).toString('base64'));
    } catch {
      /* garde l'URL d'origine */
    }
  }
  let out = html;
  for (const [u, data] of map) out = out.split(u).join(data);
  return out;
}

module.exports = { collectFileSvgs, inlineSymbolSvg };
