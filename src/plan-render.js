// Rendu SVG d'un niveau du plan d'implantation (écran). Coordonnées en cm.
// Le zoom/panoramique ne re-rend pas : seul le viewBox change (voir plan-ui.js).
// Le calque `#plan-overlay` (aperçus, poignées) est redessiné seul.
import { assetGet } from './plan-assets.js';
import { symbolOf, symbolUrl } from './symbols.js';
import { symbolHref } from './render.js';
import { nodeById, circuitStartOf } from './model.js';
import { symbolSideCm, pointOnWall, wallLength } from './plan-model.js';

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
function drawPlacements(parent, project, level, n, selPlace) {
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
    }, parent);
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

  // « Masquer les éléments » : on ne garde que l'arrière-plan (pour l'avant / après).
  const hide = !!opts.hideElements;

  if (opts.print) {
    // fond blanc opaque (plan lisible en N&B), pas de grille
    el('rect', { x: view.x, y: view.y, width: view.w, height: view.h, fill: '#fff' }, svg);
  } else if (!hide) {
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'plan-grid', width: 100, height: 100, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M 100 0 L 0 0 0 100', fill: 'none', stroke: '#e5e7eb', 'stroke-width': 1 }, pat);
    el('rect', { x: -1e6, y: -1e6, width: 2e6, height: 2e6, fill: 'url(#plan-grid)' }, svg);
  }

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

  if (!hide) {
    // Groupe unique pour l'opacité des éléments (murs, ouvertures, pièces, symboles).
    const elements = el('g', { class: 'plan-elements', opacity: opts.elementOpacity ?? 1 }, svg);

    const walls = el('g', { class: 'plan-walls' }, elements);
    for (const w of level.walls) {
      el('line', {
        x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, 'stroke-width': w.t,
        class: 'plan-wall' + (w.id === opts.selWall ? ' selected' : ''), 'data-wall': w.id,
      }, walls);
    }

    if (opts.project) drawPlacements(elements, opts.project, level, opts.n || 100, opts.selPlace);
    drawOpenings(elements, level, opts.selOpening);
    drawRooms(elements, level, opts.n || 100, opts.selRoom);
  }

  el('g', { id: 'plan-overlay' }, svg);
}

/** Ouvertures (portes, fenêtres) posées sur un mur : le mur est interrompu visuellement.
 *  Rendu dans le repère local du mur (origine sur le mur, x le long du mur). */
function drawOpenings(parent, level, selOpening) {
  const g = el('g', { class: 'plan-openings' }, parent);
  for (const o of level.openings) {
    const w = level.walls.find((x) => x.id === o.wall);
    if (!w) continue;
    const L = wallLength(w);
    if (L === 0) continue;
    const dx = (w.x2 - w.x1) / L, dy = (w.y2 - w.y1) / L;
    const P = pointOnWall(w, o.pos);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const og = el('g', {
      transform: `translate(${P.x},${P.y}) rotate(${angle})`,
      class: 'plan-opening' + (o.id === selOpening ? ' selected' : ''),
      'data-opening': o.id,
    }, g);
    // interruption du mur (fond opaque par-dessus le trait)
    el('rect', { x: -o.w / 2, y: -(w.t + 4) / 2, width: o.w, height: w.t + 4, fill: '#fff', stroke: 'none' }, og);
    if (o.kind === 'door') {
      // Battant + arc d'ouverture (quart de cercle). La charnière est sur un bord de
      // l'ouverture (`hinge` : -1 gauche, +1 droite) et la porte s'ouvre d'un côté du mur
      // (`open` : -1 / +1). L'arc est centré sur la charnière et rejoint l'autre bord.
      const hinge = o.hinge === 1 ? 1 : -1;
      const open = o.open === -1 ? -1 : 1;
      const hx = hinge * (o.w / 2);
      const ey = open * o.w;
      const sweep = hinge * open > 0 ? 1 : 0;
      el('line', { x1: hx, y1: 0, x2: hx, y2: ey, 'stroke-width': 2 }, og);
      el('path', { d: `M ${hx} ${ey} A ${o.w} ${o.w} 0 0 ${sweep} ${-hx} 0`, 'stroke-width': 1.5 }, og);
    } else {
      // fenêtre : double trait
      const off = Math.max(2, w.t / 4);
      el('line', { x1: -o.w / 2, y1: -off, x2: o.w / 2, y2: -off, 'stroke-width': 2 }, og);
      el('line', { x1: -o.w / 2, y1: off, x2: o.w / 2, y2: off, 'stroke-width': 2 }, og);
    }
  }
}

/** Libellés de pièces : texte libre, taille constante sur papier (comme les repères). */
function drawRooms(parent, level, n, selRoom) {
  const fs = symbolSideCm(n) * 0.5;
  for (const r of level.rooms) {
    const t = el('text', {
      x: r.x, y: r.y, 'font-size': fs,
      class: 'plan-room' + (r.id === selRoom ? ' selected' : ''),
      'data-room': r.id,
    }, parent);
    t.textContent = r.name || 'Pièce';
  }
}
