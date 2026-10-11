// Bibliothèque de symboles, organisée selon le tableau 2.23 « Symboles graphiques »
// (RGIE/AREI, Livre 1, Partie 2). Chaque symbole est un fichier SVG autonome dans
// ./symbols/<clé>.svg (aucun dessin généré en JS). Les dessins sont refaits à partir
// des descriptions du tableau et doivent être vérifiés contre le document officiel
// avant usage réglementaire.

export const SYMBOL_CATEGORIES = [
  { id: 'tableaux', name: 'Tableaux (B)' },
  { id: 'protection', name: 'Protection (D)' },
  { id: 'interrupteurs', name: 'Interrupteurs (E)' },
  { id: 'prises', name: 'Socles de prise (F)' },
  { id: 'eclairage', name: 'Éclairage (G)' },
  { id: 'appareils', name: 'Appareils d’utilisation (G)' },
  { id: 'sources', name: 'Sources (H)' },
  { id: 'cables', name: 'Câbles (lignes)' },
];

const SYMBOLS = {
  board: {
    name: 'Tableau de répartition', ref: 'B', category: 'tableaux', prefix: 'TD',
    w: 120, h: 40, file: 'symbols/board.svg',
  },
  // Barre de tableau / sous-tableau : reçoit plusieurs départs (ramifiable comme un node).
  tableau: {
    name: 'Tableau (barre)', ref: 'B', category: 'tableaux', prefix: 'TB',
    w: 64, h: 24, file: 'symbols/tableau.svg',
  },

  fuse: {
    name: 'Coupe-circuit à fusible', ref: 'D', category: 'protection', prefix: 'F',
    w: 40, h: 40, file: 'symbols/fuse.svg',
  },
  breaker: {
    name: 'Disjoncteur', ref: 'D', category: 'protection', prefix: 'Q',
    w: 40, h: 40, file: 'symbols/breaker.svg',
  },
  rcd: {
    name: 'Différentiel', ref: 'D', category: 'protection', prefix: 'Q',
    w: 40, h: 40, file: 'symbols/differentiel.svg',
  },
  sectionneur: {
    name: 'Sectionneur (coupe à vide)', ref: 'D', category: 'protection', prefix: 'Q',
    w: 40, h: 40, file: 'symbols/sectionneur.svg',
  },
  earth: {
    name: 'Prise de terre', ref: 'D', category: 'protection', prefix: 'PE',
    w: 40, h: 40, file: 'symbols/earth.svg',
  },

  switch: {
    name: 'Interrupteur', ref: 'E', category: 'interrupteurs', prefix: 'S',
    w: 40, h: 40, file: 'symbols/switch.svg',
  },
  switch_pilot: {
    name: 'Interrupteur à lampe témoin', ref: 'E', category: 'interrupteurs', prefix: 'S',
    w: 40, h: 40, file: 'symbols/switch_pilot.svg',
  },
  push: {
    name: 'Bouton-poussoir', ref: 'E', category: 'interrupteurs', prefix: 'B',
    w: 40, h: 40, file: 'symbols/push.svg',
  },
  timer: {
    name: 'Minuterie', ref: 'E', category: 'interrupteurs', prefix: 'K',
    w: 40, h: 40, file: 'symbols/timer.svg',
  },
  clock_switch: {
    name: 'Interrupteur horaire', ref: 'E', category: 'interrupteurs', prefix: 'K',
    w: 40, h: 40, file: 'symbols/clock_switch.svg',
  },
  contactor: {
    name: 'Télérupteur', ref: 'E', category: 'interrupteurs', prefix: 'K',
    w: 40, h: 40, file: 'symbols/contactor.svg',
  },
  thermostat: {
    name: 'Thermostat', ref: 'E', category: 'interrupteurs', prefix: 'TH',
    w: 40, h: 40, file: 'symbols/thermostat.svg',
  },
  motion: {
    name: 'Détecteur de mouvement', ref: 'E', category: 'interrupteurs', prefix: 'DM',
    w: 40, h: 40, file: 'symbols/motion.svg',
  },

  socket: {
    name: 'Prise de courant', ref: 'F', category: 'prises', prefix: 'X',
    w: 40, h: 40, file: 'symbols/socket_earth_childproof.svg',
  },

  light: {
    name: 'Point lumineux', ref: 'G', category: 'eclairage', prefix: 'E',
    w: 40, h: 40, file: 'symbols/light.svg',
  },
  fluo: {
    name: 'Appareil d’éclairage à fluorescence', ref: 'G', category: 'eclairage', prefix: 'E',
    w: 40, h: 40, file: 'symbols/fluo.svg',
  },
  projector: {
    name: 'Projecteur', ref: 'G', category: 'eclairage', prefix: 'E',
    w: 40, h: 40, file: 'symbols/projector.svg',
  },
  emergency: {
    name: 'Éclairage de sécurité', ref: 'G', category: 'eclairage', prefix: 'E',
    w: 40, h: 40, file: 'symbols/emergency.svg',
  },

  heater: {
    name: 'Appareil de chauffage', ref: 'G', category: 'appareils', prefix: 'R',
    w: 40, h: 40, file: 'symbols/heater.svg',
  },
  boiler: {
    name: 'Chauffe-eau', ref: 'G', category: 'appareils', prefix: 'CE',
    w: 40, h: 40, file: 'symbols/boiler.svg',
  },
  fan: {
    name: 'Ventilateur', ref: 'G', category: 'appareils', prefix: 'V',
    w: 40, h: 40, file: 'symbols/fan.svg',
  },
  bell: {
    name: 'Sonnerie', ref: 'G', category: 'appareils', prefix: 'SO',
    w: 40, h: 40, file: 'symbols/bell.svg',
  },
  motor: {
    name: 'Moteur', ref: 'G', category: 'appareils', prefix: 'M',
    w: 40, h: 40, file: 'symbols/motor.svg',
  },
  kwh: {
    name: 'Compteur kWh', ref: 'G', category: 'appareils', prefix: 'W',
    w: 40, h: 40, file: 'symbols/kwh.svg',
  },
  appliance: {
    name: 'Appareil électrodomestique fixe', ref: 'G', category: 'appareils', prefix: 'AP',
    w: 40, h: 40, file: 'symbols/appliance.svg',
  },

  transformer: {
    name: 'Transformateur', ref: 'H', category: 'sources', prefix: 'T',
    w: 40, h: 40, file: 'symbols/transformer.svg',
  },
  solar: {
    name: 'Panneau solaire', ref: 'H', category: 'sources', prefix: 'PV',
    w: 40, h: 40, file: 'symbols/solar.svg',
  },

  // Câble / fil (ligne de câble, propriétés dédiées : conducteurs, section, type, montage).
  // SVG deux fois plus haut que large : viewBox 40 x 80 attendu (tracé centré).
  fil: {
    name: 'Fil / câble', ref: '—', category: 'cables', prefix: 'C',
    w: 40, h: 80, file: 'symbols/fil.svg',
  },

  // Pseudo-symbole inséré entre deux éléments (pas dans la palette).
  node: {
    name: 'Node (point de dérivation)', ref: 'D', prefix: 'D', category: 'cables',
    w: 40, h: 40, file: 'symbols/carrefour.svg',
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

/** URL absolue du fichier SVG d'un symbole (résolue par rapport au document). */
export function symbolUrl(type) {
  return new URL(symbolOf(type).file, document.baseURI).href;
}

// Types de socle de prise de courant (propriété « type de prise »). Chaque type
// correspond à un fichier SVG distinct. Le type par défaut est souligné ci-dessous.
export const SOCKET_TYPES = [
  { key: 'generic', name: 'Générique', file: 'symbols/socket.svg' },
  { key: 'waterproof', name: 'Etanche ou semi-étanche', file: 'symbols/socket_waterproof.svg' },
  { key: 'earth', name: 'Avec protection terre', file: 'symbols/socket_earth.svg' },
  { key: 'childproof', name: 'Avec protection enfant', file: 'symbols/socket_childproof.svg' },
  { key: 'earth_childproof', name: 'Avec protection terre et enfant (défaut)', file: 'symbols/socket_earth_childproof.svg' },
  { key: 'switch', name: 'Avec interrupteur bipolaire', file: 'symbols/socket_switch.svg' },
  { key: 'switch_lock', name: 'Avec interrupteur bipolaire de verrouillage', file: 'symbols/socket_switch_lock.svg' },
  { key: 'transformer', name: 'Avec transformateur de séparation', file: 'symbols/socket_transfo.svg' },
];

export const DEFAULT_SOCKET_TYPE = 'earth_childproof';

/** Définition d'un type de prise (repli sur le type par défaut si inconnu). */
export function socketTypeOf(key) {
  return SOCKET_TYPES.find((t) => t.key === key) || SOCKET_TYPES.find((t) => t.key === DEFAULT_SOCKET_TYPE);
}

/** URL absolue du fichier SVG correspondant au type de prise. */
export function socketUrl(key) {
  return new URL(socketTypeOf(key).file, document.baseURI).href;
}

// Types d'interrupteur (propriété « type d'interrupteur »). Chaque type correspond
// à un fichier SVG distinct. Le type par défaut est souligné ci-dessous.
export const SWITCH_TYPES = [
  { key: 'simple', name: 'Interrupteur simple', file: 'symbols/switch.svg' },
  { key: 'bipolar', name: 'Interrupteur bipolaire', file: 'symbols/switch_bipolar.svg' },
  { key: 'tripolar', name: 'Interrupteur tripolaire', file: 'symbols/switch_tripolar.svg' },
  { key: 'double', name: 'Interrupteur double', file: 'symbols/switch_double.svg' },
  { key: 'two_way', name: 'Interrupteur va-et-vient', file: 'symbols/switch_2D.svg' },
  { key: 'two_way_bipolar', name: 'Interrupteur va-et-vient bipolaire', file: 'symbols/switch_2D_bipolar.svg' },
  { key: 'inverter', name: 'Interrupteur inverseur', file: 'symbols/switch_inverter.svg' },
];

export const DEFAULT_SWITCH_TYPE = 'simple';

/** Définition d'un type d'interrupteur (repli sur le type par défaut si inconnu). */
export function switchTypeOf(key) {
  return SWITCH_TYPES.find((t) => t.key === key) || SWITCH_TYPES.find((t) => t.key === DEFAULT_SWITCH_TYPE);
}

/** URL absolue du fichier SVG correspondant au type d'interrupteur. */
export function switchUrl(key) {
  return new URL(switchTypeOf(key).file, document.baseURI).href;
}

// Fichiers SVG par type de montage d'une ligne (élément « fil »). La forme du
// symbole suit le mode de pose choisi dans `node.cable.montage`.
export const FIL_MOUNT_FILES = {
  apparent: 'symbols/fil_apparent.svg',
  apparent_conduit: 'symbols/fil_conduit.svg',
  encastre: 'symbols/fil_encastre.svg',
  encastre_conduit: 'symbols/fil_encastre_conduit.svg',
  enterree: 'symbols/fil_enterre.svg',
  aerienne: 'symbols/fil_aerien.svg',
};

/** URL absolue du fichier SVG d'un fil, selon son montage (repli : fil.svg). */
export function filUrl(node) {
  const key = node && node.cable && node.cable.montage;
  const file = FIL_MOUNT_FILES[key] || 'symbols/fil.svg';
  return new URL(file, document.baseURI).href;
}

export { SYMBOLS };
