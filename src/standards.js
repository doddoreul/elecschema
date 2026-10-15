// Constantes normalisées — installations domestiques belges (RGIE / AREI).
// Valeurs usuelles du marché. `verified: false` = non confronté au texte officiel.

/** Sections normalisées (mm²). Non utilisées comme propriété en V1 :
 *  conservées pour référence et pour les futures annotations de câble. */
export const SECTIONS = [0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70];

/** Calibres normalisés de disjoncteurs (A). */
export const RATINGS = [1, 2, 3, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63];

/** Courbes de déclenchement (B / C / D). */
export const CURVES = ['B', 'C', 'D'];

/** Pouvoir de coupure par défaut (A). Modifiable par élément. */
export const DEFAULT_ICB = 3000;

/** Sensibilités normalisées des différentiels (mA). */
export const RCD_VALUES = [10, 30, 100, 300, 500, 1000];
export const RCD_RATINGS = [25, 40, 63];
export const RCD_TYPES = ['AC', 'A', 'F', 'Hpi'];

/** Symboles considérés comme des protections (portent calibre / sensibilité). */
const PROTECTION_SYMBOLS = ['breaker', 'rcd', 'fuse'];

/** Un symbole de protection ? */
export function isProtection(symbolType) {
  return PROTECTION_SYMBOLS.includes(symbolType);
}

/** Directions cardinales des points d'ancrage. */
export const ANCHOR_DIRECTIONS = ['right', 'top', 'left', 'bottom'];

/* ---------- plan d'implantation ---------- */
/** Éléments jamais posés sur le plan (liaisons de schéma, pas d'appareillage). */
export const PLAN_EXCLUDED = ['node', 'node_parallel', 'fil', 'breaker', 'rcd', 'fuse', 'sectionneur'];
/** Échelles normalisées 1:N, de la plus grande (1:20) à la plus petite (1:500). */
export const PLAN_SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 500];
/** Taille d'un symbole sur papier, en mm (constante quelle que soit l'échelle). */
export const PLAN_SYMBOL_MM = 4;

/** Tableau : une entrée (ancrage à gauche, occupée par le parent), des sorties en haut.
 *  Chaque sortie occupée ouvre une sortie vierge : le tableau s'élargit. */
export const TABLEAU_OUTPUTS = 2;
export const TABLEAU_OUTPUT_TYPES = ['rcd', 'breaker', 'sectionneur', 'fil'];

/** Clés d'ancrage utilisables d'un élément (clés de `children`). */
export function anchorKeysOf(node) {
  if (node.symbolType === 'node_parallel') {
    const tops = Array.from({ length: node.outputs || TABLEAU_OUTPUTS }, (_, i) => 'top-' + (i + 1));
    return [...tops];
  }
  if (node.symbolType === 'tableau') {
    const tops = Array.from({ length: node.outputs || TABLEAU_OUTPUTS }, (_, i) => 'top-' + (i + 1));
    return [...tops, 'bottom'];
  }
  // Aucun point d'ancrage.
  const NONE = ['earth', 'light', 'fridge', 'freezer', 'oven', 'microwave', 'dishwasher',
    'washing_machine', 'dryer', 'kitchenette', 'heater', 'boiler', 'fan', 'bell', 'appliance'];
  if (NONE.includes(node.symbolType)) return [];
  // Un seul point d'ancrage fixe.
  if (node.symbolType === 'fuse') return ['top'];
  if (['timer', 'clock_switch', 'contactor', 'thermostat', 'motion'].includes(node.symbolType)) return ['top'];
  // Un seul point d'ancrage, en face du point d'entree.
  const SINGLE = ['socket', 'switch', 'switch_pilot', 'push', 'motor', 'sectionneur', 'breaker', 'rcd', 'fil', 'kwh'];
  if (SINGLE.includes(node.symbolType)) {
    const d = node.dir ? baseDir(node.dir) : 'bottom';
    return ANCHOR_DIRECTIONS.includes(d) ? [d] : ['bottom'];
  }
  return ANCHOR_DIRECTIONS;
}

/** Direction cardinale d'une clé d'ancrage (`top-2` -> `top`, `bottom` -> `bottom`). */
export function baseDir(key) {
  return String(key).split('-')[0];
}

/** Rang de sortie d'un tableau, à partir de 0 (`top-3` -> 2). `bottom` -> -1. */
export function outputIndex(key) {
  if (String(key) === 'bottom') return -1;
  const m = /-(\d+)$/.exec(String(key));
  return m ? Number(m[1]) - 1 : 0;
}

/* ------------------------------------------------------------- élément « fil » */

/** Types de câble usuels (BE). */
export const CABLE_TYPES = ['EXVB', 'XVB', 'XGB', 'VOB', 'EXAVB', 'XFVB'];

/** Types de montage d'une ligne. */
export const MOUNT_TYPES = [
  { key: 'apparent', name: 'Apparent (sans conduit)' },
  { key: 'apparent_conduit', name: 'Apparent (dans un conduit)' },
  { key: 'encastre', name: 'Encastré (sans conduit)' },
  { key: 'encastre_conduit', name: 'Encastré (dans un conduit)' },
  { key: 'enterree', name: 'Enterrée' },
  { key: 'aerienne', name: 'Aérienne' },
];

/** Nom d'un type de montage (repli sûr). */
export function mountName(key) {
  return (MOUNT_TYPES.find((m) => m.key === key) || MOUNT_TYPES[0]).name;
}

/** Valeurs par défaut d'un fil : 3G, 2,5 mm², XVB encastré en conduit. */
export const DEFAULT_CABLE = { n: '3G', terre: true, section: 2.5, type: 'XVB', montage: 'encastre_conduit' };
