// Modèle de données — schéma unifilaire domestique (BE).
// Séparé du rendu et de l'UI. V1 : pas de protection ni de section sur un circuit ;
// la protection est un symbole posé par l'utilisateur dans le circuit.

import { CIRCUIT_TYPES, DEFAULT_ICB } from './standards.js';

const SCHEMA_VERSION = 2;
const DOMAINE = 'DOMESTIQUE';
const PAYS = 'BE';

/** Repères automatiques par type de symbole. */
const PREFIXES = {
  breaker: 'Q', rcd: 'Q', fuse: 'F', switch: 'S', push: 'B',
  socket: 'X', light: 'E', fluo: 'E', projector: 'E', emergency: 'E',
  heater: 'R', boiler: 'CE', fan: 'V', bell: 'SO', motor: 'M',
  kwh: 'W', appliance: 'AP', transformer: 'T', solar: 'PV', earth: 'PE',
};

function today() { return new Date().toISOString().slice(0, 10); }

function emptySupply() {
  return { id: 1, kind: 'compteur', label: 'W1', detail: '' };
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
    circuits: [],
  };
}

let idCounter = 1;
function nextId() { return idCounter++; }

/** Recalcule le compteur d'IDs à partir d'un projet chargé. */
export function syncIdCounter(project) {
  let max = 1;
  const all = [project.supply, ...(project.circuits || []).flatMap((c) => c.components || [])];
  for (const x of all) if (x && typeof x.id === 'number') max = Math.max(max, x.id);
  idCounter = max + 1;
}

/** Circuit : nom, description, type, phase. Ni protection, ni section. */
export function createCircuit(typeKey = 'mixte', name = '') {
  return {
    id: nextId(),
    typeKey,
    name: name || CIRCUIT_TYPES[typeKey].name,
    description: '',
    phases: 1,
    phase: 'L1',
    components: [],
  };
}

export function autoLabel(symbolType, index) {
  return (PREFIXES[symbolType] || 'C') + index;
}

export function createComponent(symbolType, label) {
  return { id: nextId(), symbolType, label, labelLocked: false, detail: '', phases: 1 };
}

/** Repère complet d'un composant, ex: C1-Q1. */
export function fullLabel(circuit, component) {
  const n = circuit.name.match(/\d+/);
  return (n ? 'C' + n[0] : circuit.name) + '-' + component.label;
}

export { emptyProject, emptyInfo, emptySupply, nextId, CIRCUIT_TYPES, SCHEMA_VERSION, DOMAINE, PAYS, PREFIXES };
