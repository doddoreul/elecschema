// Magasin des images de fond de plan. Volontairement HORS de `project` :
// l'historique (annuler/rétablir) sérialise le projet et l'autosave écrit le
// localStorage ; une image base64 y serait fatale. Le projet ne garde que la clé.

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;   // refus au-delà
export const MAX_SIDE_PX = 2400;                     // côté le plus long après réduction
const JPEG_QUALITY = 0.85;

const images = new Map();   // clé (ex. 'p9') -> dataURL

export function assetSet(key, dataURL) { images.set(key, dataURL); }
export function assetGet(key) { return images.get(key) || null; }
export function assetsObject() { return Object.fromEntries(images); }
export function assetsClear() { images.clear(); }

/** Remplace tout le magasin (ouverture de fichier, reprise d'autosave). Valeurs non-texte ignorées. */
export function assetsReplace(obj) {
  images.clear();
  for (const [k, v] of Object.entries(obj || {})) if (typeof v === 'string') images.set(k, v);
}

/** Lit un fichier image, le réduit (côté max 2400 px) et le ré-encode en JPEG 0,85.
 *  Fond blanc : les PNG transparents ne deviennent pas noirs. Rejette au-delà de 20 Mo. */
export function prepareImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Aucun fichier.'));
    if (file.size > MAX_SOURCE_BYTES) return reject(new Error('Image trop volumineuse (plus de 20 Mo).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataURL = c.toDataURL('image/jpeg', JPEG_QUALITY);
      URL.revokeObjectURL(url);
      resolve({ dataURL, w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
    img.src = url;
  });
}

/* ------------------------------------------- persistance navigateur (IndexedDB) */

const DB_NAME = 'elexio', STORE = 'kv', RECORD = 'planAssets';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Écrit les images (navigateur uniquement). Retourne false si le stockage échoue. */
export async function saveAssetsIdb(obj) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(obj, RECORD);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (err) {
    console.warn('Sauvegarde des fonds de plan impossible :', err);
    return false;
  }
}

export async function loadAssetsIdb() {
  try {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value;
  } catch (err) {
    console.warn('Lecture des fonds de plan impossible :', err);
    return null;
  }
}
