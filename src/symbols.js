// Bibliothèque de symboles, organisée selon le tableau 2.23 « Symboles graphiques »
// (RGIE/AREI, Livre 1, Partie 2). Les dessins sont refaits à partir des descriptions
// du tableau et doivent être vérifiés contre le document officiel avant usage réglementaire.

export const SYMBOL_CATEGORIES = [
  { id: 'tableaux', name: 'Tableaux (B)' },
  { id: 'protection', name: 'Protection (D)' },
  { id: 'interrupteurs', name: 'Interrupteurs (E)' },
  { id: 'prises', name: 'Socles de prise (F)' },
  { id: 'eclairage', name: 'Éclairage (G)' },
  { id: 'appareils', name: 'Appareils d’utilisation (G)' },
  { id: 'sources', name: 'Sources (H)' },
];

const G = (inner) => `<g fill="none" stroke="#111827" stroke-width="2">${inner}</g>`;
const T = (x, y, size, text) =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="#111827">${text}</text>`;

const SYMBOLS = {
  board: {
    name: 'Tableau de répartition', ref: 'B', category: 'tableaux', prefix: 'TD',
    w: 120, h: 40, top: [60, 0], bottom: [60, 40],
    shape: G('<path d="M20 0 V10 M40 0 V10 M60 0 V10 M80 0 V10 M100 0 V10 M60 26 V40"/><rect x="0" y="10" width="120" height="16"/>'),
  },

  fuse: {
    name: 'Coupe-circuit à fusible', ref: 'D', category: 'protection', prefix: 'F',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 28 V40"/><rect x="12" y="12" width="16" height="16"/>'),
  },
  breaker: {
    name: 'Disjoncteur', ref: 'D', category: 'protection', prefix: 'Q',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 28 V40 M20 12 L13 22"/><circle cx="20" cy="28" r="2"/>'),
  },
  rcd: {
    name: 'Dispositif différentiel-résiduel (Δ)', ref: 'D', category: 'protection', prefix: 'Q',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 28 V40 M20 12 L13 22"/><circle cx="20" cy="28" r="2"/>') + `<text x="30" y="20" font-size="12" fill="#111827">Δ</text>`,
  },
  earth: {
    name: 'Prise de terre', ref: 'D', category: 'protection', prefix: 'PE',
    w: 40, h: 40, top: [20, 0], bottom: [20, 28],
    shape: G('<path d="M20 0 V18 M12 18 H28 M15 23 H25 M18 28 H22"/>'),
  },

  switch: {
    name: 'Interrupteur', ref: 'E', category: 'interrupteurs', prefix: 'S',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 31 V40 M20 12 L27 22"/><circle cx="20" cy="28" r="3"/>'),
  },
  switch_pilot: {
    name: 'Interrupteur à lampe témoin', ref: 'E', category: 'interrupteurs', prefix: 'S',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 31 V40 M20 12 L27 22"/><circle cx="20" cy="28" r="3"/><circle cx="32" cy="10" r="4"/><path d="M29 7 L35 13 M35 7 L29 13"/>'),
  },
  switch_2way: {
    name: 'Interrupteur va-et-vient', ref: 'E', category: 'interrupteurs', prefix: 'S',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 31 V40 M20 12 L12 22 M20 12 L28 22"/><circle cx="20" cy="28" r="3"/>'),
  },
  push: {
    name: 'Bouton-poussoir', ref: 'E', category: 'interrupteurs', prefix: 'B',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V14 M20 26 V40"/><circle cx="20" cy="20" r="6"/>'),
  },
  timer: {
    name: 'Minuterie', ref: 'E', category: 'interrupteurs', prefix: 'K',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V14 M20 26 V40"/><rect x="4" y="14" width="32" height="12"/>') + T(20, 23, 10, 't'),
  },
  clock_switch: {
    name: 'Interrupteur horaire', ref: 'E', category: 'interrupteurs', prefix: 'K',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V14 M20 26 V40"/><rect x="4" y="14" width="32" height="12"/><circle cx="12" cy="20" r="4"/>'),
  },
  contactor: {
    name: 'Télérupteur', ref: 'E', category: 'interrupteurs', prefix: 'K',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V14 M20 26 V40"/><rect x="4" y="14" width="32" height="12"/>') + T(20, 23, 9, 'TR'),
  },
  thermostat: {
    name: 'Thermostat', ref: 'E', category: 'interrupteurs', prefix: 'TH',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V14 M20 26 V40"/><rect x="4" y="14" width="32" height="12"/><circle cx="20" cy="20" r="4"/><path d="M16 20 H24"/>'),
  },
  motion: {
    name: 'Détecteur de mouvement', ref: 'E', category: 'interrupteurs', prefix: 'DM',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V8 M20 32 V40"/><rect x="8" y="8" width="24" height="24"/>') + T(20, 24, 10, '))'),
  },

  socket: {
    name: 'Socle de prise de courant', ref: 'F', category: 'prises', prefix: 'X',
    w: 40, h: 40, top: [20, 0], bottom: [20, 20],
    shape: G('<path d="M20 0 V14 M10 14 H30"/><path d="M14 14 A6 6 0 0 0 26 14"/>'),
  },
  socket_earth: {
    name: 'Socle avec contact de protection (PE)', ref: 'F', category: 'prises', prefix: 'X',
    w: 40, h: 40, top: [20, 0], bottom: [20, 20],
    shape: G('<path d="M20 0 V14 M10 14 H30"/><path d="M14 14 A6 6 0 0 0 26 14 M20 20 V27"/>'),
  },
  socket_switch: {
    name: 'Socle avec interrupteur bipolaire', ref: 'F', category: 'prises', prefix: 'X',
    w: 40, h: 40, top: [20, 0], bottom: [20, 20],
    shape: G('<path d="M20 0 V14 M10 14 H30 M26 14 L34 6"/><path d="M14 14 A6 6 0 0 0 26 14"/>'),
  },
  socket_waterproof: {
    name: 'Socle étanche (h)', ref: 'F', category: 'prises', prefix: 'X',
    w: 40, h: 40, top: [20, 0], bottom: [20, 20],
    shape: G('<path d="M20 0 V14 M10 14 H30"/><path d="M14 14 A6 6 0 0 0 26 14"/>') + T(32, 30, 10, 'h'),
  },

  light: {
    name: 'Point lumineux', ref: 'G', category: 'eclairage', prefix: 'E',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 28 V40 M13 13 L27 27 M27 13 L13 27"/>'),
  },
  fluo: {
    name: 'Appareil d’éclairage à fluorescence', ref: 'G', category: 'eclairage', prefix: 'E',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V15 M20 25 V40"/><rect x="4" y="15" width="32" height="10"/>'),
  },
  projector: {
    name: 'Projecteur', ref: 'G', category: 'eclairage', prefix: 'E',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 28 V40"/><circle cx="20" cy="20" r="8"/><path d="M15 15 L25 25 M25 15 L15 25"/>'),
  },
  emergency: {
    name: 'Éclairage de sécurité', ref: 'G', category: 'eclairage', prefix: 'E',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<rect x="0" y="0" width="40" height="40"/><path d="M6 6 L34 34 M34 6 L6 34"/>') + '<circle cx="20" cy="20" r="3" fill="#111827"/>',
  },

  heater: {
    name: 'Appareil de chauffage', ref: 'G', category: 'appareils', prefix: 'R',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V10 M20 30 V40"/><rect x="8" y="10" width="24" height="20"/><path d="M14 10 V30 M20 10 V30 M26 10 V30"/>'),
  },
  boiler: {
    name: 'Chauffe-eau', ref: 'G', category: 'appareils', prefix: 'CE',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V6 M20 34 V40"/><circle cx="20" cy="20" r="14"/><path d="M14 8 V32 M20 6 V34 M26 8 V32"/>'),
  },
  fan: {
    name: 'Ventilateur', ref: 'G', category: 'appareils', prefix: 'V',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V12 M20 28 V40"/><rect x="8" y="12" width="24" height="16"/><circle cx="16" cy="20" r="3"/><circle cx="24" cy="20" r="3"/>'),
  },
  bell: {
    name: 'Sonnerie', ref: 'G', category: 'appareils', prefix: 'SO',
    w: 40, h: 40, top: [20, 0], bottom: [20, 20],
    shape: G('<path d="M20 0 V8 M12 8 H28 M12 8 A8 8 0 0 0 28 8"/>'),
  },
  motor: {
    name: 'Moteur', ref: 'G', category: 'appareils', prefix: 'M',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V8 M20 32 V40"/><circle cx="20" cy="20" r="12"/>') + T(20, 24, 12, 'M'),
  },
  kwh: {
    name: 'Compteur kWh', ref: 'G', category: 'appareils', prefix: 'W',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V10 M20 30 V40"/><rect x="6" y="10" width="28" height="20"/>') + T(20, 24, 8, 'kWh'),
  },
  appliance: {
    name: 'Appareil électrodomestique fixe', ref: 'G', category: 'appareils', prefix: 'AP',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V6 M20 34 V40"/><rect x="6" y="6" width="28" height="28"/>'),
  },

  transformer: {
    name: 'Transformateur', ref: 'H', category: 'sources', prefix: 'T',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V4 M20 36 V40"/><circle cx="20" cy="14" r="10"/><circle cx="20" cy="26" r="10"/>'),
  },
  solar: {
    name: 'Panneau solaire', ref: 'H', category: 'sources', prefix: 'PV',
    w: 40, h: 40, top: [20, 0], bottom: [20, 40],
    shape: G('<path d="M20 0 V6 M20 34 V40"/><rect x="6" y="6" width="28" height="28"/><path d="M12 28 L28 12 M22 12 H28 V18"/>'),
  },
};

/** Définition d'un symbole par clé. Lève une erreur explicite si inconnu. */
export function symbolOf(type) {
  const def = SYMBOLS[type];
  if (!def) throw new Error(`Symbole inconnu : ${type}`);
  return def;
}

/** Nom d'affichage d'un symbole (pour les listes et le tableau BOM). */
export function symbolName(type) {
  return symbolOf(type).name;
}

/** Famille d'appartenance d'un symbole. */
export function symbolCategory(type) {
  return symbolOf(type).category;
}

export { SYMBOLS };
