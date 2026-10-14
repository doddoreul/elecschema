// Règles de validation — installations DOMESTIQUES belges (RGIE / AREI).
//
// ATTENTION : ce module est un garde-fou de dessin, pas une référence réglementaire.
// `source` indique l'origine de la règle, `verified` dit si le texte exact de la norme
// a été confronté au document officiel. Aucune règle n'est validée ici sans
// vérification manuelle par un professionnel.

import { nodeById } from './model.js';
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
      ? [{ elementId: null, message: 'Aucun élément raccordé au compteur.' }] : []),
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
      .map((e) => ({ elementId: e.id, message: `« ${e.label || 'prise'} » : aucun Δ30 mA en amont.` })),
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
      .map((e) => ({ elementId: e.id, message: `« ${e.label || e.symbolType} » : pas de calibre.` })),
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
      for (const [label, n] of seen) if (n > 1) out.push({ elementId: null, message: `${n} éléments ont le repère « ${label} ».` });
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
      .map((e) => ({ elementId: e.id, message: `${symbolName(e.symbolType)} sans repère.` })),
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
      return [{ elementId: null, message: `Informations manquantes : ${missing.join(', ')}.` }];
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
        out.push({ elementId: e.id, message: `${symbolName(e.symbolType)}${rep ? ` « ${rep} »` : ''} non placé sur le plan.` });
      }
      return out;
    },
  },
];

/** Lance toutes les règles et renvoie une liste plate d'observations triée. */
export function validate(project, rules = RULES_BE) {
  const issues = [];
  for (const rule of rules) {
    let hits = [];
    try {
      hits = rule.check(project) || [];
    } catch (err) {
      hits = [{ elementId: null, message: `Règle ${rule.id} en erreur : ${err.message}` }];
    }
    for (const hit of hits) issues.push({ rule, ...hit });
  }
  const rank = { erreur: 0, avertissement: 1, info: 2 };
  return issues.sort((a, b) => rank[a.rule.severity] - rank[b.rule.severity]);
}
