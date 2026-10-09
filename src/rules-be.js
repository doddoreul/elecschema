// Règles de validation — installations DOMESTIQUES belges (RGIE / AREI).
//
// ATTENTION : ce module est un garde-fou de dessin, pas une référence réglementaire.
// `source` indique l'origine de la règle, `verified` dit si le texte exact de la norme
// a été confronté au document officiel. Aucune règle n'est validée ici sans
// vérification manuelle par un professionnel.

export const RULE_SEVERITY = { ERROR: 'erreur', WARN: 'avertissement', INFO: 'info' };

const protSymbols = (c) => (c.components || []).filter((x) => ['breaker', 'rcd', 'fuse'].includes(x.symbolType));

export const RULES_BE = [
  {
    id: 'BE-01',
    severity: RULE_SEVERITY.ERROR,
    message: 'Circuit sans aucun symbole',
    source: 'Cohérence du schéma unifilaire',
    verified: false,
    check: (p) =>
      (p.circuits || [])
        .filter((c) => (c.components || []).length === 0)
        .map((c) => ({ circuitId: c.id, message: `Le circuit « ${c.name} » est vide.` })),
  },
  {
    id: 'BE-02',
    severity: RULE_SEVERITY.WARN,
    message: 'Circuit sans protection',
    source: 'RGIE/AREI — protection contre les surintensités',
    verified: false,
    check: (p) =>
      (p.circuits || [])
        .filter((c) => protSymbols(c).length === 0)
        .map((c) => ({ circuitId: c.id, message: `« ${c.name} » : aucun symbole de protection posé.` })),
  },
  {
    id: 'BE-03',
    severity: RULE_SEVERITY.WARN,
    message: 'Prises sans différentiel 30 mA',
    source: 'RGIE/AREI — protection complémentaire par DDR 30 mA sur circuits de prises',
    verified: false,
    check: (p) =>
      (p.circuits || [])
        .filter((c) => c.typeKey === 'prise' || c.typeKey === 'mixte')
        .filter((c) => !protSymbols(c).some((x) => Number(x.params?.diff) === 30))
        .map((c) => ({ circuitId: c.id, message: `« ${c.name} » : aucun Δ30 mA détecté.` })),
  },
  {
    id: 'BE-04',
    severity: RULE_SEVERITY.WARN,
    message: 'Protection sans calibre',
    source: 'Lisibilité du dossier',
    verified: false,
    check: (p) => {
      const out = [];
      for (const c of p.circuits || []) {
        for (const x of protSymbols(c)) {
          const rating = Number(x.params?.rating);
          const diff = Number(x.params?.diff);
          if (x.symbolType === 'rcd' && !Number.isNaN(diff)) continue;
          if (Number.isNaN(rating) || rating <= 0) {
            out.push({ circuitId: c.id, message: `« ${c.name} » : le symbole ${x.label} n'a pas de calibre.` });
          }
        }
      }
      return out;
    },
  },
  {
    id: 'BE-05',
    severity: RULE_SEVERITY.WARN,
    message: 'Nom de circuit en double',
    source: 'Convention interne',
    verified: false,
    check: (p) => {
      const seen = new Map();
      for (const c of p.circuits || []) seen.set(c.name, (seen.get(c.name) || 0) + 1);
      const out = [];
      for (const [name, n] of seen) {
        if (n > 1) out.push({ circuitId: null, message: `${n} circuits s'appellent « ${name} ».` });
      }
      return out;
    },
  },
  {
    id: 'BE-06',
    severity: RULE_SEVERITY.WARN,
    message: 'Symbole sans repère',
    source: 'Convention de repérage',
    verified: false,
    check: (p) => {
      const out = [];
      for (const c of p.circuits || []) {
        for (const comp of c.components || []) {
          if (!comp.label || !comp.label.trim()) {
            out.push({ circuitId: c.id, message: `Symbole sans repère dans « ${c.name} ».` });
          }
        }
      }
      return out;
    },
  },
  {
    id: 'BE-07',
    severity: RULE_SEVERITY.WARN,
    message: 'Déséquilibre des phases',
    source: 'Bonne pratique — répartition de charge sur L1/L2/L3',
    verified: false,
    check: (p) => {
      if (p.info?.projet?.typeAlim !== 'TRI') return [];
      const b = { L1: 0, L2: 0, L3: 0 };
      for (const c of p.circuits || []) b[c.phase || 'L1'] += 1;
      const vals = Object.values(b);
      const spread = Math.max(...vals) - Math.min(...vals);
      if (spread <= 1) return [];
      return [{ circuitId: null, message: `Écart de ${spread} circuits entre L1/L2/L3 (L1 ${b.L1} · L2 ${b.L2} · L3 ${b.L3}).` }];
    },
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
      return [{ circuitId: null, message: `Informations manquantes : ${missing.join(', ')}.` }];
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
      hits = [{ circuitId: null, message: `Règle ${rule.id} en erreur : ${err.message}` }];
    }
    for (const hit of hits) issues.push({ rule, ...hit });
  }
  const rank = { erreur: 0, avertissement: 1, info: 2 };
  return issues.sort((a, b) => rank[a.rule.severity] - rank[b.rule.severity]);
}
