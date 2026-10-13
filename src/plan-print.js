// Pages « plan d'implantation » du dossier PDF : une page A4 paysage par étage non
// vide, après le schéma et avant les listes. Le SVG de la page est construit en
// MILLIMÈTRES (1 unité = 1 mm, dimensions de la zone imprimable 277 x 186) : le PDF
// est donc à l'échelle demandée (1:N annoncé = 1:N mesuré). Le contenu du plan (en cm
// monde) y est placé par `transform="scale(10/N)"` et coupé à la zone de tracé.
// Dessin lisible en noir et blanc (traits noirs sur fond blanc).
import { renderPlanLevel } from './plan-render.js';
import { drawCartouche, PAGE, symbolHref } from './render.js';
import {
  planFrame, scaleBar, hasPlanContent, effectiveScale, fitBounds, frameOverflow,
  PLAN_MARGIN_MM, PLAN_PLOT_MM, PLAN_LEGEND_MM, PLAN_CART_MM, PLAN_PRINTABLE_MM,
} from './plan-model.js';
import { symbolOf, symbolName, symbolUrl } from './symbols.js';
import { nodeById } from './model.js';

const NS = 'http://www.w3.org/2000/svg';

/** Zone imprimable en coordonnées locales (origine au coin haut-gauche des marges). */
const PRINT = { w: PLAN_PRINTABLE_MM.w, h: PLAN_PRINTABLE_MM.h };
const local = (r) => ({ x: r.x - PLAN_MARGIN_MM, y: r.y - PLAN_MARGIN_MM, w: r.w, h: r.h });
const PLOT = local(PLAN_PLOT_MM);
const LEGEND = local(PLAN_LEGEND_MM);
const CART = local(PLAN_CART_MM);
// Le cartouche est dessiné en pixels (page 594 x 420 à 2 px/mm), collé en bas à droite.
const CART_PX = { x: PAGE.w - 250, y: PAGE.h - 62 };   // coin haut-gauche en px

let clipSeq = 0;   // identifiants de clip uniques (plusieurs pages dans un même document)

function mk(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

/** Barre d'échelle graphique + échelle numérique, en millimètres de papier.
 *  La barre mesure EXACTEMENT `cmToPaperMm(cm, N)` mm. */
function drawScaleBar(parent, scale, x, y) {
  const { mm, label } = scaleBar(scale);
  const g = mk('g', { class: 'plan-scalebar' }, parent);
  mk('text', { x, y: y - 2, 'font-size': 2.6, fill: '#4b5563' }, g).textContent = `Échelle 1:${scale} — ${label}`;
  for (let i = 0; i < 2; i++) {
    mk('rect', { x: x + i * mm / 2, y, width: mm / 2, height: 3, fill: i ? '#fff' : '#111827', stroke: '#111827', 'stroke-width': 0.25 }, g);
  }
  mk('line', { x1: x, y1: y, x2: x, y2: y + 5, stroke: '#111827', 'stroke-width': 0.25 }, g);
  mk('line', { x1: x + mm, y1: y, x2: x + mm, y2: y + 5, stroke: '#111827', 'stroke-width': 0.25 }, g);
}

/** Symboles d'équipement utilisés sur l'étage (type -> { node, count }). */
function usedSymbols(project, level) {
  const map = new Map();
  for (const pl of level.placements) {
    const node = pl.elementId === project.supply.id ? project.supply : nodeById(project, pl.elementId);
    if (!node) continue;
    const key = node.symbolType === 'compteur' ? 'kwh' : node.symbolType;
    const e = map.get(key) || { key, node, count: 0 };
    e.count++;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Légende : petit symbole + nom + quantité, en chips qui reviennent à la ligne (mm). */
function drawLegend(parent, project, level) {
  const items = usedSymbols(project, level);
  const extra = [];
  if (level.openings.some((o) => o.kind === 'door')) extra.push({ label: 'Porte', count: level.openings.filter((o) => o.kind === 'door').length });
  if (level.openings.some((o) => o.kind === 'window')) extra.push({ label: 'Fenêtre', count: level.openings.filter((o) => o.kind === 'window').length });
  if (items.length === 0 && extra.length === 0) return;

  const g = mk('g', { class: 'plan-legend' }, parent);
  mk('text', { x: LEGEND.x, y: LEGEND.y + 4, 'font-size': 3, 'font-weight': 600, fill: '#111827' }, g).textContent = 'Légende';
  const size = 4;
  let x = LEGEND.x, y = LEGEND.y + 11;
  const lineH = 6.5;
  const put = (href, w, h, label, count) => {
    const tw = Math.max(8, String(label).length * 1.7) + String(count).length * 1.6 + 4;
    if (x + size + tw > LEGEND.x + LEGEND.w) { x = LEGEND.x; y += lineH; }
    if (href) mk('image', { href, x, y: y - size + 1, width: size, height: size * h / w, preserveAspectRatio: 'xMidYMid meet' }, g);
    mk('text', { x: x + size + 1.5, y, 'font-size': 2.6, fill: '#374151' }, g).textContent = `${label}${count > 1 ? ' ×' + count : ''}`;
    x += size + tw + 3;
  };
  for (const it of items) {
    const isSupply = it.key === 'kwh';
    const def = symbolOf(it.key);
    const href = isSupply ? symbolUrl('kwh') : symbolHref(it.node);
    put(href, def.w, def.h, isSupply ? 'Compteur' : symbolName(it.key), it.count);
  }
  for (const e of extra) put(null, 1, 1, e.label, e.count);
}

/** Une page de plan : SVG en unités millimètre (zone imprimable 277 x 186). */
export function buildPlanPage(project, level, n) {
  const total = planFillCount(project);
  const frame = planFrame(level);
  const scale = frame.n;
  const k = 10 / scale;                                   // cm monde -> mm papier
  const page = mk('svg', { xmlns: NS, viewBox: `0 0 ${PRINT.w} ${PRINT.h}`, preserveAspectRatio: 'none' });

  const title = `${level.name}${total > 1 ? ` (plan ${n}/${total})` : ''}`;
  mk('text', { x: PLOT.x, y: 9, 'font-size': 4.5, 'font-weight': 600, fill: '#111827' }, page).textContent = title;

  // Contenu du plan : clippé à la zone de tracé (ce qui déborde n'est pas imprimé).
  const defs = mk('defs', {}, page);
  const clipId = `plan-clip-${++clipSeq}`;
  const cp = mk('clipPath', { id: clipId }, defs);
  mk('rect', { x: PLOT.x, y: PLOT.y, width: PLOT.w, height: PLOT.h }, cp);
  const clipped = mk('g', { 'clip-path': `url(#${clipId})` }, page);
  const world = mk('g', { transform: `translate(${PLOT.x - frame.plot.x * k} ${PLOT.y - frame.plot.y * k}) scale(${k})` }, clipped);
  renderPlanLevel(world, level, frame.plot, { project, n: scale, print: true });

  drawScaleBar(page, scale, LEGEND.x, LEGEND.y + 24);
  drawLegend(page, project, level);

  // Cartouche : dessiné en pixels (échelle 0,5 puis translation), sans le modifier.
  const cg = mk('g', { transform: `translate(${CART.x - CART_PX.x * 0.5} ${CART.y - CART_PX.y * 0.5}) scale(0.5)` }, page);
  drawCartouche(cg, project, 0);

  return page.outerHTML;
}

/** Nombre d'étages non vides (pages de plan effectives). */
export function planFillCount(project) {
  const levels = project.plan?.levels || [];
  return levels.filter((l) => hasPlanContent(l)).length || 0;
}

/** Noms des étages dont le tracé déborde de la zone de tracé (partie non imprimée). */
export function planOverflowLevels(project) {
  const levels = (project.plan?.levels || []).filter((l) => hasPlanContent(l));
  return levels
    .filter((lv) => frameOverflow(fitBounds(lv), undefined, effectiveScale(lv)))
    .map((lv) => lv.name);
}

/** Toutes les pages de plan, concaténées (chaîne vide si aucun tracé). */
export function buildPlanPages(project) {
  const levels = (project.plan?.levels || []).filter((l) => hasPlanContent(l));
  let i = 0;
  return levels.map((l) => `<section class="page plan">${buildPlanPage(project, l, ++i)}</section>`).join('');
}
