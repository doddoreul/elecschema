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
export const RCD_VALUES = [10, 30, 100, 300, 500];

/** Symboles considérés comme des protections (portent calibre / sensibilité). */
export const PROTECTION_SYMBOLS = ['breaker', 'rcd', 'fuse'];

/** Un symbole de protection ? */
export function isProtection(symbolType) {
  return PROTECTION_SYMBOLS.includes(symbolType);
}
