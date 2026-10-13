// Modèle de données — schéma unifilaire domestique (BE).
// Un projet est un arbre d'éléments : chaque élément s'ancre dans un point
// d'ancrage libre de son parent (voir standards.js#anchorKeysOf), à une direction
// cardinale donnée. Le compteur (supply) est la racine, en bas à gauche.

import { DEFAULT_ICB, isProtection, DEFAULT_CABLE, TABLEAU_OUTPUTS, ANCHOR_DIRECTIONS, outputIndex } from './standards.js';
import { DEFAULT_SOCKET_TYPE, DEFAULT_SWITCH_TYPE } from './symbols.js';
import { emptyPlan, normalizePlan, ensurePlan } from './plan-model.js';

export { ensurePlan };

export const SCHEMA_VERSION = 4;
const DOMAINE = 'DOMESTIQUE';
const PAYS = 'BE';

/** Repères automatiques par type de symbole. */
const PREFIXES = {
  breaker: 'Q', rcd: 'Q', fuse: 'F', switch: 'S', push: 'B',
  socket: 'X', light: 'E', fluo: 'E', projector: 'E', emergency: 'E',
  heater: 'R', boiler: 'CE', fan: 'V', bell: 'SO', motor: 'M',
  kwh: 'W', appliance: 'AP', transformer: 'T', solar: 'PV', earth: 'PE',
  node: 'D', fil: 'C', tableau: 'TB',
};

function today() { return new Date().toISOString().slice(0, 10); }

/** Élément d'arrivée (compteur) : racine de l'arbre, ancrage à droite. */
function emptySupply() {
  return {
    id: 1, symbolType: 'compteur', label: 'W1', detail: 'Compteur kWh',
    parent: null, dir: null, children: { right: null }, orient: 0, showLabel: false,
  };
}

function emptyInfo() {
  return {
    chantier: { denomination: '', adresse: '', codePostal: '', localite: '', dateTravaux: '' },
    occupant: { nom: '', prenom: '', telephone: '', email: '' },
    installateur: { societe: '', numeroTVA: '', adresse: '', contact: '', telephone: '', email: '' },
    dessinateur: { nom: '', societe: '', telephone: '', email: '' },
    controle: { organisme: '', contact: '', datePrevue: '' },
    projet: {
      version: '1',
      dateCreation: today(),
      dateModification: today(),
      domaine: DOMAINE,
      pays: PAYS,
      typeAlim: 'MONO', // MONO | TRI
    },
    remarques: '',
  };
}

function emptyProject() {
  return {
    schemaVersion: SCHEMA_VERSION,
    supply: emptySupply(),
    info: emptyInfo(),
    elements: [],
    plan: emptyPlan(),
  };
}

let idCounter = 2;   // 1 = compteur (racine)
function nextId() { return idCounter++; }

/** Recalcule le compteur d'IDs à partir d'un projet chargé. */
export function syncIdCounter(project) {
  let max = 1;
  const all = [project.supply, ...(project.elements || [])];
  for (const x of all) if (x && typeof x.id === 'number') max = Math.max(max, x.id);
  idCounter = max + 1;
}

/** Paramètres par défaut d'une protection. */
function defaultParams(symbolType) {
  if (symbolType === 'rcd') return { rating: 40, diff: 30, type: 'AC' };
  if (symbolType === 'fuse') return { rating: 16, icb: DEFAULT_ICB };
  return { rating: null, curve: 'C', icb: DEFAULT_ICB };
}

/** Crée un élément ancré dans le point `dir` de `parentId`. */
export function createElement(symbolType, parentId, dir) {
  const e = {
    id: nextId(), symbolType, parent: parentId, dir,
    label: '', labelLocked: false, detail: '', children: {}, orient: 0, labelPos: 'bottom', showLabel: false,
  };
  if (isProtection(symbolType)) e.params = defaultParams(symbolType);
  if (symbolType === 'breaker' || symbolType === 'rcd') {
    e.poles = symbolType === 'rcd' ? '2P' : '1P';
  }
  // un tableau doit toujours afficher son repère (libellé de la barre)
  if (symbolType === 'tableau') { e.showLabel = true; e.outputs = TABLEAU_OUTPUTS; }
  if (symbolType === 'socket') { e.count = 1; e.socketType = DEFAULT_SOCKET_TYPE; }
  if (symbolType === 'switch') e.switchType = DEFAULT_SWITCH_TYPE;
  if (symbolType === 'fil') e.cable = { ...DEFAULT_CABLE };
  return e;
}

/* ------------------------------------------------------------- accès à l'arbre */

/** Élément (ou compteur) par identifiant. */
export function nodeById(project, id) {
  if (project.supply && project.supply.id === id) return project.supply;
  return (project.elements || []).find((e) => e.id === id) || null;
}

/** Enfant occupant le point d'ancrage `dir` (ou null). */
function childAt(node, dir) {
  return (node.children || {})[dir] ?? null;
}

/** Tous les identifiants d'éléments présents dans l'arbre (parcours depuis la racine). */
export function treeOrder(project) {
  const out = [];
  const seen = new Set();
  const walk = (node) => {
    if (!node || seen.has(node.id)) return;
    seen.add(node.id);
    out.push(node);
    for (const dir of Object.keys(node.children || {})) {
      const cid = childAt(node, dir);
      if (cid != null) walk(nodeById(project, cid));
    }
  };
  walk(project.supply);
  return out;
}

/* ----------------------------------------------------- migrations legacy -> v3 */

const LEGACY_SOCKETS = { socket: 'generic', socket_earth: 'earth', socket_switch: 'switch', socket_waterproof: 'waterproof' };
const LEGACY_SWITCHES = { switch_2way: 'two_way' };
const LEGACY_SYMBOLS = { carrefour: 'node' };

/** Migration d'un ancien projet (circuits/difs) vers l'arbre d'éléments v3.
 *  Sans effet sur un projet déjà en v3 (retour anticipé). */
export function migrateProject(p) {
  if (Array.isArray(p.elements) && (p.schemaVersion || 0) >= 3) { delete p.circuits; delete p.difs; migratePlan(p); return; }
  const els = [];
  p.supply = p.supply || {};
  p.supply.symbolType = p.supply.symbolType || 'compteur';
  p.supply.children = { right: null };

  const mk = (type, parentId, dir) => {
    const e = { id: nextId(), symbolType: type, parent: parentId, dir, label: '', labelLocked: false, detail: '', children: {} };
    if (isProtection(type)) e.params = type === 'rcd' ? { rating: 40, diff: 30, type: 'AC' } : { rating: null, curve: 'C', icb: DEFAULT_ICB };
    if (type === 'socket') e.count = 1;
    return e;
  };
  const addEl = (type, parent, dir) => { const e = mk(type, parent.id, dir); parent.children[dir] = e.id; els.push(e); return e; };

  // Différentiels : chaînés depuis le compteur.
  let parent = p.supply;
  for (const d of p.difs || []) {
    const dir = parent === p.supply ? 'right' : (ANCHOR_DIRECTIONS.find((x) => parent.children[x] == null) || 'right');
    const e = addEl('rcd', parent, dir);
    e.label = d.label || '';
    e.params = d.params || { rating: 40, diff: 30, type: 'AC' };
    parent = e;
  }

  // Circuits : composants accrochés en série de nodes (3 emplacements + chaînage).
  let hub = addEl('node', p.supply, 'right');
  let slots = ['top', 'bottom', 'left'];
  let si = 0;
  const attach = (type, label, params, count) => {
    if (si >= slots.length) { hub = addEl('node', hub, 'right'); slots = ['top', 'bottom', 'left']; si = 0; }
    const dir = slots[si++];
    const e = addEl(type, hub, dir);
    e.label = label || '';
    if (params) e.params = params;
    if (count) e.count = count;
  };
  for (const c of p.circuits || []) {
    for (const comp of c.components || []) attach(comp.symbolType, comp.label, comp.params, comp.count);
  }

  p.elements = els;
  p.schemaVersion = 3;
  delete p.circuits;
  delete p.difs;
  migratePlan(p);
}

/** Passe au modèle v4 : bloc `plan` (étages, murs, placements) ramené à une forme valide.
 *  Idempotent. Doit venir après la construction de `elements`. */
export function migratePlan(p) {
  p.plan = normalizePlan(p);
  p.schemaVersion = SCHEMA_VERSION;
}

/** Ramène les anciens types éclatés (prises, interrupteurs) vers le type unique + sa propriété de type. */
export function normalizeTypes(p) {
  for (const e of p.elements || []) {
    if (!e || !e.symbolType) continue;
    if (Object.prototype.hasOwnProperty.call(LEGACY_SYMBOLS, e.symbolType)) {
      e.symbolType = LEGACY_SYMBOLS[e.symbolType];
    }
    if (Object.prototype.hasOwnProperty.call(LEGACY_SOCKETS, e.symbolType)) {
      e.socketType = e.socketType || LEGACY_SOCKETS[e.symbolType];
      e.symbolType = 'socket';
    }
    if (Object.prototype.hasOwnProperty.call(LEGACY_SWITCHES, e.symbolType)) {
      e.switchType = e.switchType || LEGACY_SWITCHES[e.symbolType];
      e.symbolType = 'switch';
    }
    if (e.symbolType === 'socket') {
      if (!e.socketType) e.socketType = DEFAULT_SOCKET_TYPE;
      if (!e.count) e.count = 1;
      // plus de repère auto sur les prises : on ne garde que les repères saisis
      if (/^X\d+$/.test(e.label || '')) e.label = '';
    }
    if (e.symbolType === 'switch' && !e.switchType) e.switchType = DEFAULT_SWITCH_TYPE;
    // Un node n'a aucune propriété : on nettoie les anciens champs hérités.
    if (e.symbolType === 'node') {
      e.label = ''; e.labelLocked = false; e.detail = '';
      delete e.labelPos; delete e.showLabel; delete e.poles;
    }
    // Tableau : sorties nommées top-1, top-2… ; anciens ancrages (top, right…) convertis.
    if (e.symbolType === 'tableau') {
      e.orient = 0;
      const kids = Object.entries(e.children || {}).filter(([, v]) => v != null);
      e.children = {};
      const taken = new Set();
      const pending = [];
      for (const [key, cid] of kids) {
        if (key === 'bottom') { e.children.bottom = cid; continue; }
        if (/^top(-\d+)?$/.test(key) && !taken.has(outputIndex(key))) { taken.add(outputIndex(key)); e.children['top-' + (outputIndex(key) + 1)] = cid; }
        else pending.push(cid);
      }
      let i = 0;
      for (const cid of pending) {
        while (taken.has(i)) i++;
        taken.add(i); e.children['top-' + (i + 1)] = cid;
      }
      e.outputs = Math.max(e.outputs || TABLEAU_OUTPUTS, Math.max(-1, ...taken) + 2);
      for (const [key, cid] of Object.entries(e.children)) {
        const k = (p.elements || []).find((x) => x && x.id === cid);
        if (k) { k.parent = e.id; k.dir = key; }
      }
    }
  }
}

/* ------------------------------------------------------------ repérage circuits */

/** Lettre de circuit : 1 → A … 26 → Z, 27 → AA, 28 → AB… */
export function letterOf(i) {
  let s = '';
  for (let n = i; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Types pouvant porter le début d'un circuit. */
const CIRCUIT_PARENTS = ['tableau', 'rcd', 'compteur', 'node'];

/** Début de circuit : disjoncteur/fusible posé directement sous un tableau, un
 *  différentiel, le compteur ou un node. */
export function isCircuitStart(project, e) {
  if (!e || !['breaker', 'fuse'].includes(e.symbolType)) return false;
  const p = e.parent != null ? nodeById(project, e.parent) : null;
  return !!p && CIRCUIT_PARENTS.includes(p.symbolType);
}

/** Circuit auquel appartient un élément (son début, en remontant l'arbre). */
export function circuitStartOf(project, e) {
  for (let n = e; n && n !== project.supply; n = n.parent != null ? nodeById(project, n.parent) : null) {
    if (isCircuitStart(project, n)) return n;
  }
  return null;
}

/** Numérotation « Trikker » : une lettre par circuit (ordre du schéma), puis 1, 2…
 *  pour les symboles du circuit. Un repère saisi à la main (verrouillé) est conservé. */
export function renumberCircuits(project) {
  const all = treeOrder(project);
  const starts = all.filter((e) => isCircuitStart(project, e));
  const reserved = new Set(starts.filter((s) => s.labelLocked && /^[A-Z]{1,2}$/.test(s.label || '')).map((s) => s.label));
  let i = 0;
  for (const s of starts) {
    if (s.labelLocked) continue;
    let l;
    do { l = letterOf(++i); } while (reserved.has(l));
    s.label = l;
  }
  const counts = new Map();
  for (const e of all) {
    if (e === project.supply || isCircuitStart(project, e) || ['node', 'tableau', 'fil', 'sectionneur'].includes(e.symbolType)) continue;
    const s = circuitStartOf(project, e);
    if (!s) continue;
    const n = (counts.get(s.id) || 0) + 1;
    counts.set(s.id, n);
    if (!e.labelLocked) e.label = s.label + n;
  }
}

export { emptyProject, nextId, PREFIXES };
