// Règles de validation — installations DOMESTIQUES belges (RGIE / AREI).
//
// ATTENTION : ce module est un garde-fou de dessin, pas une référence réglementaire.
// `source` indique l'origine de la règle, `verified` dit si le texte exact de la norme
// a été confronté au document officiel. Aucune règle n'est validée ici sans
// vérification manuelle par un professionnel.

import { nodeById, isCircuitStart, circuitStartOf } from './model.js';
import { PLAN_EXCLUDED } from './standards.js';
import { symbolName } from './symbols.js';

export const RULE_SEVERITY = { ERROR: 'erreur', WARN: 'avertissement', INFO: 'info' };

const PROT = ['breaker', 'rcd', 'fuse'];
const isProt = (e) => PROT.includes(e.symbolType);

/** Remonte la chaîne des parents jusqu'au compteur. */
function ancestors(project, node) {
  const out = [];
  const seen = new Set();
  let cur = node;
  while (cur && cur.parent != null && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = nodeById(project, cur.parent);
    if (cur) out.push(cur);
  }
  return out;
}

function hasUpstreamRcd30(project, node) {
  return ancestors(project, node).some((a) => a.symbolType === 'rcd' && Number(a.params?.diff) === 30);
}

export const RULES_BE = [
  {
    id: 'BE-01',
    severity: RULE_SEVERITY.ERROR,
    message: 'Schéma sans élément',
    source: 'Cohérence du schéma unifilaire',
    verified: false,
    check: (p) => ((p.elements || []).length === 0
      ? [{ elementId: null, key: 'Aucun élément raccordé au compteur.' }] : []),
  },
  {
    id: 'BE-03',
    severity: RULE_SEVERITY.WARN,
    message: 'Prise sans différentiel 30 mA en amont',
    source: 'RGIE/AREI — protection complémentaire par DDR 30 mA sur circuits de prises',
    verified: false,
    check: (p) => (p.elements || [])
      .filter((e) => e.symbolType === 'socket')
      .filter((e) => !hasUpstreamRcd30(p, e))
      .map((e) => ({ elementId: e.id, key: '« {label} » : aucun Δ30 mA en amont.', params: { label: e.label || symbolName('socket') } })),
  },
  {
    id: 'BE-04',
    severity: RULE_SEVERITY.WARN,
    message: 'Protection sans calibre',
    source: 'Lisibilité du dossier',
    verified: false,
    check: (p) => (p.elements || [])
      .filter(isProt)
      .filter((e) => {
        const pa = e.params || {};
        if (e.symbolType === 'rcd') return !(Number(pa.diff) > 0) && !(Number(pa.rating) > 0);
        return !(Number(pa.rating) > 0);
      })
      .map((e) => ({ elementId: e.id, key: '« {label} » : pas de calibre.', params: { label: e.label || symbolName(e.symbolType) } })),
  },
  {
    id: 'BE-05',
    severity: RULE_SEVERITY.WARN,
    message: 'Repère en double',
    source: 'Convention interne',
    verified: false,
    check: (p) => {
      const seen = new Map();
      for (const e of p.elements || []) {
        const l = (e.label || '').trim();
        if (!l) continue;
        seen.set(l, (seen.get(l) || 0) + 1);
      }
      const out = [];
      for (const [label, n] of seen) if (n > 1) out.push({ elementId: null, key: '{n} éléments ont le repère « {label} ».', params: { n, label } });
      return out;
    },
  },
  {
    id: 'BE-06',
    severity: RULE_SEVERITY.WARN,
    message: 'Symbole sans repère',
    source: 'Convention de repérage',
    verified: false,
    check: (p) => (p.elements || [])
      .filter((e) => e.symbolType !== 'node' && e.symbolType !== 'node_parallel' && e.symbolType !== 'fil')
      .filter((e) => !(e.label || '').trim())
      .map((e) => ({ elementId: e.id, key: '{symbol} sans repère.', params: { symbol: symbolName(e.symbolType) } })),
  },
  {
    id: 'BE-08',
    severity: RULE_SEVERITY.WARN,
    message: 'Dossier incomplet',
    source: "Constitution d'un dossier de contrôle",
    verified: false,
    check: (p) => {
      const i = p.info || {};
      const missing = [];
      if (!i.chantier?.adresse) missing.push('adresse du chantier');
      if (!i.installateur?.societe) missing.push('société installatrice');
      if (!i.dessinateur?.nom) missing.push('dessinateur');
      if (missing.length === 0) return [];
      return [{ elementId: null, key: 'Informations manquantes : {list}.', params: { list: missing } }];
    },
  },
  {
    id: 'BE-09',
    severity: RULE_SEVERITY.INFO,
    message: 'Appareillage non placé sur le plan',
    source: "Implantation de l'appareillage",
    verified: false,
    check: (p) => {
      const levels = p.plan?.levels || [];
      const placements = levels.reduce((n, l) => n + (l.placements?.length || 0), 0);
      if (placements === 0) return [];   // pas de plan : pas d'alerte
      const placed = new Set();
      for (const l of levels) for (const x of l.placements || []) placed.add(x.elementId);
      const out = [];
      for (const e of [p.supply, ...(p.elements || [])]) {
        if (!e || PLAN_EXCLUDED.includes(e.symbolType) || placed.has(e.id)) continue;
        const rep = (e.label || '').trim();
        out.push({ elementId: e.id, key: '{symbol}{rep} non placé sur le plan.', params: { symbol: symbolName(e.symbolType), rep: rep ? ` « ${rep} »` : '' } });
      }
      return out;
    },
  },
  {
    id: 'BE-10',
    severity: RULE_SEVERITY.WARN,
    message: 'Trop de points sur un circuit',
    source: 'RGIE/AREI et NF C 15-100 - max. 8 prises/points par circuit',
    verified: false,
    check: (p) => {
      const counts = new Map();
      for (const e of p.elements || []) {
        const cs = circuitStartOf(p, e);
        if (!cs) continue;
        if (['node', 'node_parallel', 'fil', 'tableau'].includes(e.symbolType)) continue;
        if (e === cs) continue;
        counts.set(cs.id, (counts.get(cs.id) || 0) + (e.symbolType === 'socket' ? (e.count || 1) : 1));
      }
      const norm = p.info?.projet?.norme === 'NFC15-100' ? 'NFC' : 'RGIE';
      const limit = norm === 'NFC' ? 12 : 8;
      const out = [];
      for (const cs of (p.elements || []).filter((e) => isCircuitStart(p, e))) {
        const n = counts.get(cs.id) || 0;
        if (n > limit) out.push({ elementId: cs.id, key: '{label} : {n} points (max. {limit} pour {norm}).', params: { label: cs.label || symbolName(cs.symbolType), n, limit, norm: norm === 'NFC' ? 'NF C 15-100' : 'RGIE/AREI' } });
      }
      return out;
    },
  },
  {
    id: 'BE-11',
    severity: RULE_SEVERITY.WARN,
    message: 'Section de conducteur insuffisante pour le calibre',
    source: 'RGIE Tableau 4.11 / NF C 15-100',
    verified: false,
    check: (p) => {
      const MAX = { 1.5: 16, 2.5: 20, 4: 25, 6: 40, 10: 63 };
      const out = [];
      for (const f of (p.elements || []).filter((e) => e.symbolType === 'fil')) {
        const parent = nodeById(p, f.parent);
        if (!parent || !['breaker', 'rcd'].includes(parent.symbolType)) continue;
        const cal = Number(parent.params?.rating);
        const sec = Number(f.cable?.section);
        const lim = MAX[sec];
        if (lim != null && cal > lim) out.push({ elementId: f.id, key: 'Fil {label} ({section} mm² pour {rating} A) : section insuffisante (max. {limit} A).', params: { label: f.label || f.id, section: sec, rating: cal, limit: lim } });
      }
      return out;
    },
  },
  {
    id: 'BE-12',
    severity: RULE_SEVERITY.INFO,
    message: 'Moins de 2 circuits d\'eclairage',
    source: 'RGIE 4.4 / NF C 15-100 : au moins 2 circuits d\'eclairage',
    verified: false,
    check: (p) => {
      const lightCircuits = new Set();
      for (const e of p.elements || []) {
        if (e.symbolType !== 'light') continue;
        const cs = circuitStartOf(p, e);
        if (cs) lightCircuits.add(cs.id);
      }
      if (lightCircuits.size === 0) return [];
      if (lightCircuits.size < 2) return [{ elementId: null, key: "Seulement 1 circuit d'eclairage identifiable (minimum 2 recommandes)." }];
      return [];
    },
  },
  {
    id: 'BE-13',
    severity: RULE_SEVERITY.WARN,
    message: 'Absence de differentiel',
    source: 'RGIE/AREI et NF C 15-100 - protection differentielle obligatoire',
    verified: false,
    check: (p) => {
      const rcds = (p.elements || []).filter((e) => e.symbolType === 'rcd');
      if (rcds.length === 0) return [{ elementId: null, key: 'Aucun differentiel dans le schema.' }];
      const norm = p.info?.projet?.norme === 'NFC15-100' ? 'NFC' : 'RGIE';
      const min = norm === 'NFC' ? 2 : 1;
      const hs = rcds.filter((e) => Number(e.params?.diff) === 30).length;
      if (hs < min) return [{ elementId: null, key: '{count} differentiel(s) 30 mA (minimum {min} pour {norm}).', params: { count: hs, min, norm: norm === 'NFC' ? 'NF C 15-100' : 'RGIE/AREI' } }];
      return [];
    },
  },
  {
    id: 'BE-14',
    severity: RULE_SEVERITY.WARN,
    message: 'Aucun differentiel de type A',
    source: 'RGIE/AREI et NF C 15-100 - type A minimum pour les DDR',
    verified: false,
    check: (p) => {
      const rcds = (p.elements || []).filter((e) => e.symbolType === 'rcd');
      if (rcds.length === 0) return [];
      if (rcds.some((e) => ['A', 'F', 'Hpi'].includes(e.params?.type))) return [];
      return [{ elementId: null, key: 'Aucun differentiel de type A (ou superieur) dans le schema.' }];
    },
  },
  {
    id: 'BE-15',
    severity: RULE_SEVERITY.WARN,
    message: 'Pouvoir de coupure de disjoncteur insuffisant',
    source: 'RGIE/AREI - pouvoir de coupure minimal 3000 A',
    verified: false,
    check: (p) => (p.elements || [])
      .filter((e) => e.symbolType === 'breaker' && e.params?.icb != null && Number(e.params.icb) < 3000)
      .map((e) => ({ elementId: e.id, key: '{label} : pouvoir de coupure {icb} A (< 3000 A).', params: { label: e.label || symbolName('breaker'), icb: e.params.icb } })),
  },
  {
    id: 'BE-16',
    severity: RULE_SEVERITY.WARN,
    message: 'Circuit specialise partage',
    source: 'RGIE/AREI et NF C 15-100 - circuits dedies obligatoires',
    verified: false,
    check: (p) => {
      const dedicated = new Set(['washing_machine', 'dryer', 'dishwasher', 'oven', 'microwave', 'boiler', 'heater', 'motor', 'freezer', 'fridge']);
      const out = [];
      for (const cs of (p.elements || []).filter((e) => isCircuitStart(p, e))) {
        const children = (p.elements || []).filter((e) => circuitStartOf(p, e) === cs && !['node', 'node_parallel', 'fil', 'tableau'].includes(e.symbolType));
        if (children.length <= 1) continue;
        if (children.some((e) => dedicated.has(e.symbolType))) out.push({ elementId: cs.id, key: "{label} : circuit dedie partage avec d'autres points.", params: { label: cs.label || symbolName(cs.symbolType) } });
      }
      return out;
    },
  },

];

/** Règles dédiées RGIE/AREI (Belgique). */
export const RULES_RGIE = RULES_BE.map((r, i) => ({ ...r, id: `RGIE-${String(i + 1).padStart(2, '0')}` }));

/** Règles dédiées NF C 15-100 (France). */
export const RULES_NFC = RULES_BE.map((r, i) => ({ ...r, id: `NF-${String(i + 1).padStart(2, '0')}` }));

/** Sélectionne le référentiel selon la norme du projet. */
export function rulesFor(project) {
  const norm = project?.info?.projet?.norme;
  return norm === 'NFC15-100' ? RULES_NFC : RULES_RGIE;
}


/** Lance toutes les règles et renvoie une liste plate d'observations triée. */
export function validate(project, rules = RULES_BE) {
  const issues = [];
  for (const rule of rules) {
    let hits = [];
    try {
      hits = rule.check(project) || [];
    } catch (err) {
      hits = [{ elementId: null, key: 'Règle {id} en erreur : {msg}', params: { id: rule.id, msg: err.message } }];
    }
    for (const hit of hits) issues.push({ rule, ...hit });
  }
  const rank = { erreur: 0, avertissement: 1, info: 2 };
  return issues.sort((a, b) => rank[a.rule.severity] - rank[b.rule.severity]);
}
