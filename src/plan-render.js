// Rendu SVG d'un niveau du plan d'implantation (écran). Coordonnées en cm.
// Le zoom/panoramique ne re-rend pas : seul le viewBox change (voir plan-ui.js).
// Le calque `#plan-overlay` (aperçus, poignées) est redessiné seul.
import { assetGet } from './plan-assets.js';

const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

/** Remplit le SVG avec le niveau `level` ; `view` = { x, y, w, h } (cm) ; `selWall` = id du mur sélectionné. */
export function renderPlanLevel(svg, level, view, selWall = null) {
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
      class: 'plan-wall' + (w.id === selWall ? ' selected' : ''), 'data-wall': w.id,
    }, walls);
  }

  el('g', { id: 'plan-overlay' }, svg);
}
