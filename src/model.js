// Modèle de données — schéma unifilaire domestique (BE).
// Un projet est un arbre d'éléments : chaque élément s'ancre dans un point
// d'ancrage libre de son parent (voir standards.js#anchorsOf), à une direction
// cardinale donnée. Le compteur (supply) est la racine, en bas à gauche.

import { CIRCUIT_TYPES, DEFAULT_ICB, isProtection, DEFAULT_CABLE } from './standards.js';
import { DEFAULT_SOCKET_TYPE, DEFAULT_SWITCH_TYPE } from './symbols.js';

const SCHEMA_VERSION = 3;
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
  if (symbolType === 'tableau') e.showLabel = true;
  if (symbolType === 'socket') { e.count = 1; e.socketType = DEFAULT_SOCKET_TYPE; }
  if (symbolType === 'switch') e.switchType = DEFAULT_SWITCH_TYPE;
  if (symbolType === 'fil') e.cable = { ...DEFAULT_CABLE };
  return e;
}

export function autoLabel(symbolType, index) {
  return (PREFIXES[symbolType] || 'C') + index;
}

/* ------------------------------------------------------------- accès à l'arbre */

/** Élément (ou compteur) par identifiant. */
export function nodeById(project, id) {
  if (project.supply && project.supply.id === id) return project.supply;
  return (project.elements || []).find((e) => e.id === id) || null;
}

/** Enfant occupant le point d'ancrage `dir` (ou null). */
export function childAt(node, dir) {
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
    for (const dir of ['right', 'top', 'left', 'bottom']) {
      const cid = childAt(node, dir);
      if (cid != null) walk(nodeById(project, cid));
    }
  };
  walk(project.supply);
  return out;
}

export { emptyProject, emptyInfo, emptySupply, nextId, CIRCUIT_TYPES, SCHEMA_VERSION, DOMAINE, PAYS, PREFIXES };
