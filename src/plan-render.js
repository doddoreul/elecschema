// Rendu SVG d'un niveau du plan d'implantation (écran). Coordonnées en cm.
// Le zoom/panoramique ne re-rend pas : seul le viewBox change (voir plan-ui.js).
// Le calque `#plan-overlay` (aperçus, poignées) est redessiné seul.
import { assetGet } from './plan-assets.js';
import { symbolOf, symbolUrl } from './symbols.js';
import { symbolHref } from './render.js';
import { nodeById, circuitStartOf } from './model.js';
import { symbolSideCm } from './plan-model.js';

const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

/** Repère affiché sur le plan : le repère de l'élément, sinon la lettre de son circuit. */
export function planLabel(project, node) {
  if (node.symbolType === 'compteur') return project.supply.label || 'W1';
  if (node.label) return node.label;
  const start = circuitStartOf(project, node);
  return start ? (start.label || '') : '';
}

/** Symboles posés : groupe extérieur translaté (repère non tourné), groupe intérieur pivoté. */
function drawPlacements(svg, project, level, n, selPlace) {
  const side = symbolSideCm(n);
  const fs = side * 0.5;
  for (const pl of level.placements) {
    const node = pl.elementId === project.supply.id ? project.supply : nodeById(project, pl.elementId);
    if (!node) continue;
    const isSupply = node.symbolType === 'compteur';
    const def = symbolOf(isSupply ? 'kwh' : node.symbolType);
    const href = isSupply ? symbolUrl('kwh') : symbolHref(node);
    const h = side * def.h / def.w;
    const g = el('g', {
      transform: `translate(${pl.x},${pl.y})`,
      class: 'plan-sym' + (pl.elementId === selPlace ? ' selected' : ''),
      'data-placement': pl.elementId,
    }, svg);
    const rot = el('g', { transform: `rotate(${pl.rot || 0})` }, g);
    el('rect', { x: -side / 2 - 2, y: -h / 2 - 2, width: side + 4, height: h + 4, class: 'plan-sym-hit' }, rot);
    el('image', { href, x: -side / 2, y: -h / 2, width: side, height: h, preserveAspectRatio: 'xMidYMid meet' }, rot);
    const label = planLabel(project, node);
    if (label) el('text', { x: side / 2 + fs * 0.3, y: fs * 0.35, 'font-size': fs, class: 'plan-label' }, g).textContent = label;
  }
}

/** Remplit le SVG avec le niveau `level` ; `view` = { x, y, w, h } (cm).
 *  opts : { project, n (échelle effective), selWall, selPlace }. */
export function renderPlanLevel(svg, level, view, opts = {}) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);

  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'plan-grid', width: 100, height: 100, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M 100 0 L 0 0 0 100', fill: 'none', stroke: '#e5e7eb', 'stroke-width': 1 }, pat);
  el('rect', { x: -1e6, y: -1e6, width: 2e6, height: 2e6, fill: 'url(#plan-grid)' }, svg);

  const bg = level.bg;
  if (bg && bg.visible) {
    const src = assetGet(bg.asset);
    if (src) {
      el('image', {
        href: src, x: bg.x, y: bg.y, width: bg.w, height: bg.h,
        preserveAspectRatio: 'none', opacity: bg.opacity, 'data-bg': '1',
        class: bg.locked ? 'plan-bg locked' : 'plan-bg',
      }, svg);
    }
  }

  const walls = el('g', { class: 'plan-walls' }, svg);
  for (const w of level.walls) {
    el('line', {
      x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, 'stroke-width': w.t,
      class: 'plan-wall' + (w.id === opts.selWall ? ' selected' : ''), 'data-wall': w.id,
    }, walls);
  }

  if (opts.project) drawPlacements(svg, opts.project, level, opts.n || 100, opts.selPlace);

  el('g', { id: 'plan-overlay' }, svg);
}
