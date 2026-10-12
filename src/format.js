// Format de fichier Elexio (.elx) — module pur (testable, sans DOM).
//
// Un fichier .elx est un JSON « enveloppé » puis encodé en base64. L'enveloppe :
//
//   {
//     format:        "elexio",   // identifiant du format
//     formatVersion: 1,          // version de la STRUCTURE du fichier (enveloppe)
//     schemaVersion: 3,          // version du MODÈLE de données (voir model.js)
//     app:           "0.3.0",    // version de l'application qui a exporté
//     exportedAt:    "…ISO…",
//     project:       { …projet… }
//   }
//
// La compatibilité est gouvernée par `schemaVersion` : plus petit que la version
// courante -> migration automatique ; plus grand -> fichier trop récent (alerte).
//
// L'import reste tolérant : un JSON clair (anciens `.json` / `.unifilaire.json`)
// est aussi accepté (détection sur le contenu : base64 vs JSON).

import { SCHEMA_VERSION } from './model.js';

export const FORMAT = 'elexio';
export const FORMAT_VERSION = 1;
export const APP_VERSION = '0.3.0';
export const FILE_EXT = 'elx';

/* ------------------------------------------------------- base64 / UTF-8 (Web + Node) */

function base64Encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64Decode(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Vrai si la chaîne ne contient que des caractères base64 (donc pas du JSON clair). */
function isBase64Like(s) {
  return s.length > 0 && !/[^A-Za-z0-9+/=\s]/.test(s);
}

/* ---------------------------------------------------------------------- encodage */

/** Sérialise un projet en fichier `.elx` (JSON enveloppé, encodé en base64). */
export function encodeElx(project, appVersion = APP_VERSION) {
  const envelope = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    app: appVersion,
    exportedAt: new Date().toISOString(),
    project,
  };
  return base64Encode(JSON.stringify(envelope));
}

/* ---------------------------------------------------------------------- décodage */

/** Décode un `.elx` (base64) ou un JSON clair (legacy) -> { project, meta }.
 *  Lève une Error explicite si le contenu est illisible. */
export function decodeElx(text) {
  const raw = String(text ?? '').trim();
  if (!raw) throw new Error('Fichier vide.');

  let obj;
  if (isBase64Like(raw)) {
    let json;
    try { json = base64Decode(raw); }
    catch { throw new Error('Fichier .elx illisible (base64 invalide).'); }
    try { obj = JSON.parse(json); }
    catch { throw new Error('Fichier .elx illisible (JSON invalide après décodage).'); }
  } else {
    try { obj = JSON.parse(raw); }
    catch { throw new Error('Fichier illisible : ni .elx (base64), ni JSON valide.'); }
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Contenu de projet invalide.');

  const enveloped = !!obj.project && typeof obj.project === 'object' && !Array.isArray(obj.project);
  const project = enveloped ? obj.project : obj;
  const meta = {
    enveloped,
    format: enveloped ? (obj.format ?? null) : null,
    formatVersion: enveloped ? (obj.formatVersion ?? null) : null,
    schemaVersion: enveloped ? (obj.schemaVersion ?? project.schemaVersion ?? null) : (project.schemaVersion ?? null),
    app: enveloped ? (obj.app ?? null) : null,
    exportedAt: enveloped ? (obj.exportedAt ?? null) : null,
  };
  return { project, meta };
}

/* ---------------------------------------------------------------- compatibilité */

/** Évalue la compatibilité d'un fichier décodé.
 *  level : 'ok' | 'migrate' | 'future' | 'unknown'. */
export function checkCompatibility(meta) {
  const fv = meta?.formatVersion == null ? NaN : Number(meta.formatVersion);
  if (!Number.isNaN(fv) && fv > FORMAT_VERSION) {
    return { level: 'future', message: `Fichier .elx en version ${fv}, plus récente que celle gérée (${FORMAT_VERSION}).` };
  }
  const sv = meta?.schemaVersion == null ? NaN : Number(meta.schemaVersion);
  if (Number.isNaN(sv)) {
    return { level: 'unknown', message: 'Fichier sans numéro de version : migration tentée.' };
  }
  if (sv > SCHEMA_VERSION) {
    return { level: 'future', message: `Fichier créé par une version plus récente (modèle ${sv} > ${SCHEMA_VERSION}).` };
  }
  if (sv < SCHEMA_VERSION) {
    return { level: 'migrate', message: `Ancien format (modèle ${sv}) : migration automatique vers ${SCHEMA_VERSION}.` };
  }
  return { level: 'ok', message: `Format compatible (modèle ${sv}).` };
}
