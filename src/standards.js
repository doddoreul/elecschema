// Constantes normalisées — installations domestiques belges (RGIE / AREI).
// Valeurs usuelles du marché. `verified: false` = non confronté au texte officiel.

/** Types de circuits domestiques reconnus. */
export const CIRCUIT_TYPES = {
  eclairage: { name: 'Éclairage' },
  prise: { name: 'Prises de courant' },
  mixte: { name: 'Mixte' },
};

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
export const PROTECTION_SYMBOLS = ['breaker', 'rcd', 'fuse'];

/** Un symbole de protection ? */
export function isProtection(symbolType) {
  return PROTECTION_SYMBOLS.includes(symbolType);
}

/** Directions cardinales des points d'ancrage. */
export const ANCHOR_DIRECTIONS = ['right', 'top', 'left', 'bottom'];

/** Points d'ancrage d'un type d'élément : tous les éléments ont leurs 4 directions. */
export function anchorsOf() {
  return ANCHOR_DIRECTIONS;
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

/** Valeurs par défaut d'un fil : 3 conducteurs avec terre, 2,5 mm², XVB encastré en conduit. */
export const DEFAULT_CABLE = { n: 3, terre: true, section: 2.5, type: 'XVB', montage: 'encastre_conduit' };
