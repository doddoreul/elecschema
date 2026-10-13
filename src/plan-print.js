// Pages « plan d'implantation » du dossier PDF : une page A4 paysage par étage non
// vide, après le schéma et avant les listes. Construit un SVG à part (pas le canvas
// de l'onglet) : titre, échelle numérique + barre graphique, légende des symboles
// utilisés, cartouche. Dessin lisible en noir et blanc (traits noirs sur fond blanc).
import { renderPlanLevel } from './plan-render.js';
import { drawCartouche, PAGE, symbolHref } from './render.js';
import { levelBounds, effectiveScale, hasPlanContent } from './plan-model.js';
import { symbolOf, symbolName, symbolUrl } from './symbols.js';
import { nodeById } from './model.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Aire de tracé de la page (px page à 2 px/mm), au-dessus du cartouche (62 px).
const PLOT = { x: 20, y: 34, w: PAGE.w - 40, h: 300 };
const LEGEND = { x: 20, y: PAGE.h - 62 + 6, w: 316, h: 56 };

function mk(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

/** Fenêtre de vue (cm) cadrant le niveau dans l'aire de tracé, même rapport. */
function planView(level) {
  const aspect = PLOT.w / PLOT.h;
  const b = levelBounds(level);
  if (!b) return { x: -aspect * 150, y: -150, w: aspect * 300, h: 300 };
  const pad = 60;
  const bw = Math.max(b.x1 - b.x0 + 2 * pad, 100);
  const bh = Math.max(b.y1 - b.y0 + 2 * pad, 100);
  const w = Math.max(bw, bh * aspect);
  const h = w / aspect;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Longueur « ronde » (1, 2 ou 5 × 10^k cm) pour la barre d'échelle, ~70 px de large. */
function niceBarCm(scale) {
  const cm = 70 / (20 / scale);
  const pow = 10 ** Math.floor(Math.log10(cm));
  const f = cm / pow;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * pow;
}

/** Barre d'échelle graphique + échelle numérique. */
function drawScaleBar(parent, scale, x, y) {
  const pxPerCm = 20 / scale;
  const cm = niceBarCm(scale);
  const px = cm * pxPerCm;
  const g = mk('g', { class: 'plan-scalebar' }, parent);
  mk('text', { x, y: y - 3, class: 'plan-scale-txt' }, g).textContent =
    `Échelle 1:${scale} — ${cm >= 100 ? cm / 100 + ' m' : cm + ' cm'}`;
  for (let i = 0; i < 2; i++) {
    mk('rect', { x: x + i * px / 2, y, width: px / 2, height: 5, fill: i ? '#fff' : '#111827', stroke: '#111827', 'stroke-width': 0.6 }, g);
  }
  mk('line', { x1: x, y1: y, x2: x, y2: y + 8, stroke: '#111827', 'stroke-width': 0.6 }, g);
  mk('line', { x1: x + px, y1: y, x2: x + px, y2: y + 8, stroke: '#111827', 'stroke-width': 0.6 }, g);
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

/** Légende : petit symbole + nom + quantité, en chips qui reviennent à la ligne. */
function drawLegend(parent, project, level, n) {
  const items = usedSymbols(project, level);
  const extra = [];
  if (level.openings.some((o) => o.kind === 'door')) extra.push({ label: 'Porte', count: level.openings.filter((o) => o.kind === 'door').length });
  if (level.openings.some((o) => o.kind === 'window')) extra.push({ label: 'Fenêtre', count: level.openings.filter((o) => o.kind === 'window').length });
  if (items.length === 0 && extra.length === 0) return;

  const g = mk('g', { class: 'plan-legend' }, parent);
  mk('text', { x: LEGEND.x, y: LEGEND.y + 2, class: 'plan-legend-title' }, g).textContent = 'Légende';
  const size = 13;
  let x = LEGEND.x, y = LEGEND.y + 14;
  const lineH = 20;
  const put = (href, w, h, label, count) => {
    const tw = Math.max(24, String(label).length * 4.1) + String(count).length * 4 + 12;
    if (x + size + tw > LEGEND.x + LEGEND.w) { x = LEGEND.x; y += lineH; }
    if (href) mk('image', { href, x, y: y - size + 2, width: size, height: size * h / w, preserveAspectRatio: 'xMidYMid meet' }, g);
    mk('text', { x: x + size + 3, y, class: 'plan-legend-txt' }, g).textContent = `${label}${count > 1 ? ' ×' + count : ''}`;
    x += size + tw + 8;
  };
  for (const it of items) {
    const isSupply = it.key === 'kwh';
    const def = symbolOf(it.key);
    const href = isSupply ? symbolUrl('kwh') : symbolHref(it.node);
    put(href, def.w, def.h, isSupply ? 'Compteur' : symbolName(it.key), it.count);
  }
  for (const e of extra) put(null, 1, 1, e.label, e.count);
}

/** Une page de plan (SVG complet en coordonnées de page A4 paysage, 594 × 420 px). */
export function buildPlanPage(project, level, n) {
  const total = planFillCount(project);
  const scale = effectiveScale(level);
  const page = mk('svg', { xmlns: NS, viewBox: `0 0 ${PAGE.w} ${PAGE.h}`, preserveAspectRatio: 'xMidYMid meet' });

  const title = `${level.name}${total > 1 ? ` (plan ${n}/${total})` : ''}`;
  mk('text', { x: PLOT.x, y: 24, class: 'plan-title' }, page).textContent = title;

  const inner = mk('svg', {
    x: PLOT.x, y: PLOT.y, width: PLOT.w, height: PLOT.h, preserveAspectRatio: 'xMidYMid meet',
  }, page);
  renderPlanLevel(inner, level, planView(level), { project, n: scale, print: true });
  mk('rect', { x: PLOT.x, y: PLOT.y, width: PLOT.w, height: PLOT.h, fill: 'none', stroke: '#d1d5db', 'stroke-width': 0.8 }, page);

  drawScaleBar(page, scale, PLOT.x, PLOT.y + PLOT.h + 14);
  drawLegend(page, project, level, n);
  drawCartouche(page, project, 0);
  return page.outerHTML;
}

/** Nombre d'étages non vides (pages de plan effectives). */
export function planFillCount(project) {
  const levels = project.plan?.levels || [];
  return levels.filter((l) => hasPlanContent(l)).length || 0;
}

/** Toutes les pages de plan, concaténées (chaîne vide si aucun tracé). */
export function buildPlanPages(project) {
  const levels = (project.plan?.levels || []).filter((l) => hasPlanContent(l));
  let i = 0;
  return levels.map((l) => `<section class="page plan">${buildPlanPage(project, l, ++i)}</section>`).join('');
}
