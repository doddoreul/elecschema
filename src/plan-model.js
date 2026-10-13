// Plan d'implantation — modèle pur (sans DOM, testable).
// Coordonnées en centimètres réels dans l'espace du plan, axe Y vers le bas.
// Un symbole posé est une INSTANCE d'un élément du schéma (elementId) : aucun
// nouvel équipement n'est créé ici. Le fond de plan est une couche temporaire
// (image hors du projet, voir plan-ui.js) : `bg` ne référence qu'une clé d'image.

import { PLAN_EXCLUDED, PLAN_SCALES, PLAN_SYMBOL_MM } from './standards.js';

export const PLAN_STEP_CM = 5;                    // pas d'accrochage à la grille
export const DEFAULT_WALL_CM = 20;                // épaisseur de mur par défaut
export const DEFAULT_OPENING_CM = { door: 90, window: 120 };
/** Zone utile d'une page A4 paysage du plan (594 x 420 px à 2 px/mm), hors marges,
 *  titre et cartouche (62 px en bas à droite). */
export const PAGE_USABLE_PX = { w: 554, h: 298 };
const PAGE_PX_PER_CM_NUMERATOR = 20;              // px/cm = 20 / N (à 2 px/mm)

/* ------------------------------------------------------------------ identifiants */

/** Identifiant unique du plan (compteur `plan.seq` partagé par tous les types d'objets). */
export function nextPlanId(plan, prefix = 'p') {
  plan.seq = (plan.seq || 0) + 1;
  return prefix + plan.seq;
}

function newLevel(plan, name) {
  return { id: nextPlanId(plan, 'p'), name, bg: null, walls: [], openings: [], rooms: [], placements: [], printScale: 'auto' };
}

/* ----------------------------------------------------------------- construction */

/** Plan par défaut : un seul niveau « Rez-de-chaussée ». */
export function emptyPlan() {
  const plan = { seq: 0, levels: [] };
  plan.levels.push(newLevel(plan, 'Rez-de-chaussée'));
  return plan;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function normBg(bg) {
  if (!isObj(bg) || typeof bg.asset !== 'string' || !isNum(bg.x) || !isNum(bg.y) || !(bg.w > 0) || !(bg.h > 0)) return null;
  return {
    asset: bg.asset, x: bg.x, y: bg.y, w: bg.w, h: bg.h,
    opacity: isNum(bg.opacity) ? Math.min(1, Math.max(0, bg.opacity)) : 0.5,
    visible: bg.visible !== false,
    locked: bg.locked !== false,
    calibrated: bg.calibrated === true,
  };
}

/** Ramène un plan brut (ancien projet, fichier) à une forme valide et cohérente
 *  avec l'arbre d'éléments du projet. Idempotent. Retourne le nouveau plan. */
export function normalizePlan(project) {
  const src = isObj(project.plan) ? project.plan : {};
  const plan = { seq: Number.isInteger(src.seq) && src.seq >= 0 ? src.seq : 0, levels: [] };

  // Types des éléments existants : un placement ne peut viser qu'un élément posable.
  const typeById = new Map();
  if (project.supply) typeById.set(project.supply.id, project.supply.symbolType);
  for (const e of project.elements || []) if (e) typeById.set(e.id, e.symbolType);

  const usedLevelIds = new Set();
  const placed = new Set();
  const rawLevels = Array.isArray(src.levels) ? src.levels : [];
  for (const raw of rawLevels) {
    if (!isObj(raw)) continue;
    const id = typeof raw.id === 'string' && raw.id && !usedLevelIds.has(raw.id) ? raw.id : nextPlanId(plan, 'p');
    usedLevelIds.add(id);
    const lv = {
      id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Étage',
      bg: normBg(raw.bg),
      walls: [], openings: [], rooms: [], placements: [],
      printScale: raw.printScale === 'auto' || PLAN_SCALES.includes(raw.printScale) ? raw.printScale : 'auto',
    };
    const seenIds = new Set();
    const fresh = (x) => (typeof x === 'string' && x && !seenIds.has(x) ? x : nextPlanId(plan, 'w'));

    for (const w of Array.isArray(raw.walls) ? raw.walls : []) {
      if (!isObj(w) || ![w.x1, w.y1, w.x2, w.y2].every(isNum)) continue;
      const wid = fresh(w.id); seenIds.add(wid);
      lv.walls.push({ id: wid, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, t: w.t > 0 ? w.t : DEFAULT_WALL_CM });
    }
    const wallIds = new Set(lv.walls.map((w) => w.id));
    for (const o of Array.isArray(raw.openings) ? raw.openings : []) {
      if (!isObj(o) || !wallIds.has(o.wall) || (o.kind !== 'door' && o.kind !== 'window')) continue;
      const oid = fresh(o.id); seenIds.add(oid);
      lv.openings.push({
        id: oid, kind: o.kind, wall: o.wall,
        pos: isNum(o.pos) ? Math.min(1, Math.max(0, o.pos)) : 0.5,
        w: o.w > 0 ? o.w : DEFAULT_OPENING_CM[o.kind],
      });
    }
    for (const r of Array.isArray(raw.rooms) ? raw.rooms : []) {
      if (!isObj(r) || !isNum(r.x) || !isNum(r.y)) continue;
      const rid = fresh(r.id); seenIds.add(rid);
      lv.rooms.push({ id: rid, name: typeof r.name === 'string' ? r.name : '', x: r.x, y: r.y });
    }
    for (const p of Array.isArray(raw.placements) ? raw.placements : []) {
      if (!isObj(p) || !isNum(p.x) || !isNum(p.y)) continue;
      const eid = Number(p.elementId);
      if (!typeById.has(eid) || PLAN_EXCLUDED.includes(typeById.get(eid))) continue;
      if (placed.has(eid)) continue;                // un élément n'est posé qu'une fois
      placed.add(eid);
      lv.placements.push({ elementId: eid, x: p.x, y: p.y, rot: isNum(p.rot) ? p.rot : 0 });
    }
    plan.levels.push(lv);
  }
  if (plan.levels.length === 0) plan.levels.push(newLevel(plan, 'Rez-de-chaussée'));

  // compteur seq >= plus grand suffixe rencontré (pas de collision future)
  for (const lv of plan.levels) {
    for (const id of [lv.id, ...lv.walls.map((x) => x.id), ...lv.openings.map((x) => x.id), ...lv.rooms.map((x) => x.id)]) {
      const n = Number(String(id).replace(/^\D+/, ''));
      if (Number.isInteger(n) && n > plan.seq) plan.seq = n;
    }
  }
  return plan;
}

/** Garantit `project.plan` valide (migration v4 et après chaque suppression d'élément). */
export function ensurePlan(project) {
  project.plan = normalizePlan(project);
  return project.plan;
}

/* ---------------------------------------------------------------------- niveaux */

export function levelById(plan, id) {
  return plan.levels.find((l) => l.id === id) || null;
}

export function addLevel(plan, name) {
  const lv = newLevel(plan, name || `Étage ${plan.levels.length}`);
  plan.levels.push(lv);
  return lv;
}

/** Refusé s'il ne reste qu'un niveau. Les placements du niveau partent avec lui
 *  (les éléments du schéma, eux, sont conservés). */
export function removeLevel(plan, id) {
  if (plan.levels.length <= 1) return false;
  const i = plan.levels.findIndex((l) => l.id === id);
  if (i < 0) return false;
  plan.levels.splice(i, 1);
  return true;
}

export function renameLevel(plan, id, name) {
  const t = String(name ?? '').trim();
  const lv = levelById(plan, id);
  if (!lv || !t) return false;
  lv.name = t;
  return true;
}

/** Déplace un niveau d'un rang (delta = -1 ou +1). Ordre = ordre d'affichage et d'export. */
export function moveLevel(plan, id, delta) {
  const i = plan.levels.findIndex((l) => l.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= plan.levels.length) return false;
  [plan.levels[i], plan.levels[j]] = [plan.levels[j], plan.levels[i]];
  return true;
}

/* ------------------------------------------------------------ murs et ouvertures */

export function addWall(plan, level, { x1, y1, x2, y2, t = DEFAULT_WALL_CM }) {
  const w = { id: nextPlanId(plan, 'w'), x1, y1, x2, y2, t };
  level.walls.push(w);
  return w;
}

/** Supprime le mur et les ouvertures qui s'y trouvent. */
export function removeWall(level, wallId) {
  level.walls = level.walls.filter((w) => w.id !== wallId);
  level.openings = level.openings.filter((o) => o.wall !== wallId);
}

export function addOpening(plan, level, { kind, wall, pos, w }) {
  const o = { id: nextPlanId(plan, 'o'), kind, wall, pos: Math.min(1, Math.max(0, pos)), w: w || DEFAULT_OPENING_CM[kind] };
  level.openings.push(o);
  return o;
}

export function addRoom(plan, level, { x, y, name = '' }) {
  const r = { id: nextPlanId(plan, 'r'), name, x, y };
  level.rooms.push(r);
  return r;
}

/* ------------------------------------------------------------------- placements */

/** Ids d'éléments déjà posés, tous niveaux confondus. */
export function placedIds(plan) {
  const s = new Set();
  for (const lv of plan.levels) for (const p of lv.placements) s.add(p.elementId);
  return s;
}

/** Pose un élément sur un niveau. Refusé s'il est déjà posé quelque part. */
export function placeElement(plan, levelId, elementId, x, y, rot = 0) {
  const lv = levelById(plan, levelId);
  if (!lv || placedIds(plan).has(elementId)) return false;
  lv.placements.push({ elementId, x, y, rot });
  return true;
}

/** Retire le symbole du plan ; l'élément du schéma n'est pas touché. */
export function unplaceElement(plan, elementId) {
  for (const lv of plan.levels) lv.placements = lv.placements.filter((p) => p.elementId !== elementId);
}

export function findPlacement(plan, elementId) {
  for (const lv of plan.levels) {
    const p = lv.placements.find((x) => x.elementId === elementId);
    if (p) return { level: lv, placement: p };
  }
  return null;
}

/** Éléments posables pas encore placés (dont le compteur), triés par id (stable). */
export function unplacedElements(project) {
  const placed = placedIds(project.plan);
  const all = [project.supply, ...(project.elements || [])];
  return all
    .filter((e) => e && !PLAN_EXCLUDED.includes(e.symbolType) && !placed.has(e.id))
    .sort((a, b) => a.id - b.id)
    .map((e) => ({ elementId: e.id, symbolType: e.symbolType, label: e.label || '' }));
}

/* --------------------------------------------------------------------- géométrie */

export function snap(v, step = PLAN_STEP_CM) {
  return Math.round(v / step) * step;
}

/** Point cible en mode orthogonal : horizontal ou vertical selon la plus grande variation. */
export function orthoTarget(x1, y1, x2, y2) {
  return Math.abs(x2 - x1) >= Math.abs(y2 - y1) ? { x: x2, y: y1 } : { x: x1, y: y2 };
}

export function wallLength(w) {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

export function pointOnWall(w, pos) {
  return { x: w.x1 + (w.x2 - w.x1) * pos, y: w.y1 + (w.y2 - w.y1) * pos };
}

/** Mur le plus proche d'un point (pour poser une porte / fenêtre). null si hors tolérance. */
export function nearestWall(level, x, y, tol) {
  let best = null;
  for (const w of level.walls) {
    const len2 = (w.x2 - w.x1) ** 2 + (w.y2 - w.y1) ** 2;
    if (len2 === 0) continue;
    const pos = Math.min(1, Math.max(0, ((x - w.x1) * (w.x2 - w.x1) + (y - w.y1) * (w.y2 - w.y1)) / len2));
    const p = pointOnWall(w, pos);
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist <= tol && (!best || dist < best.dist)) best = { wall: w, pos, dist };
  }
  return best;
}

/** Emprise d'un niveau (cm), fond compris s'il est visible. null si vide. */
export function levelBounds(level) {
  const xs = [], ys = [];
  for (const w of level.walls) {
    const pad = w.t / 2;
    xs.push(w.x1 - pad, w.x2 + pad); ys.push(w.y1 - pad, w.y2 + pad);
  }
  for (const r of level.rooms) { xs.push(r.x); ys.push(r.y); }
  for (const p of level.placements) { xs.push(p.x - 20, p.x + 20); ys.push(p.y - 20, p.y + 20); }
  if (level.bg && level.bg.visible) {
    xs.push(level.bg.x, level.bg.x + level.bg.w); ys.push(level.bg.y, level.bg.y + level.bg.h);
  }
  if (xs.length === 0) return null;
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export function hasPlanContent(level) {
  return level.walls.length > 0 || level.openings.length > 0 || level.rooms.length > 0 || level.placements.length > 0;
}

/* ------------------------------------------------------------------------ échelle */

/** Pixels de page par cm réel pour l'échelle 1:N (à 2 px/mm). 1:100 -> 0,2 px/cm. */
export function pxPerCm(n) {
  return PAGE_PX_PER_CM_NUMERATOR / n;
}

/** Côté d'un symbole sur le plan (cm réels) : PLAN_SYMBOL_MM sur papier, à l'échelle 1:N.
 *  Constant sur papier quelle que soit l'échelle. */
export function symbolSideCm(n) {
  return PLAN_SYMBOL_MM * n / 10;
}

/** Longueur réelle (cm) -> longueur sur papier (mm) à l'échelle 1:N. */
export function paperMm(lengthCm, n) {
  return (lengthCm * 10) / n;
}

/** Plus grande échelle normalisée (1:20 d'abord) dont le dessin tient dans la zone utile.
 *  Si rien ne tient : la plus petite (1:500) avec fits = false. */
export function chooseScale(bounds, usable = PAGE_USABLE_PX) {
  if (!bounds) return { n: 100, fits: true };
  const wcm = bounds.x1 - bounds.x0, hcm = bounds.y1 - bounds.y0;
  for (const n of PLAN_SCALES) {
    const k = pxPerCm(n);
    if (wcm * k <= usable.w && hcm * k <= usable.h) return { n, fits: true };
  }
  return { n: PLAN_SCALES[PLAN_SCALES.length - 1], fits: false };
}

/** Échelle effective d'un niveau : valeur choisie, ou calcul automatique. */
export function effectiveScale(level) {
  return typeof level.printScale === 'number' ? level.printScale : chooseScale(levelBounds(level)).n;
}
