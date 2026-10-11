// Rendu SVG unifilaire — arbre d'éléments par points d'ancrage.
//   Le compteur (racine) est placé en bas à gauche ; chaque élément s'ancre
//   dans un point libre de son parent, dans une direction cardinale.
//   Un « node » (4 ancrages) peut être inséré entre deux éléments.
// Aucun rendu classique/développé : uniquement le schéma unifilaire.

import { symbolOf, symbolUrl, socketUrl, switchUrl, filUrl } from './symbols.js';
import { anchorsOf } from './standards.js';
import { nodeById } from './model.js';

const NS = 'http://www.w3.org/2000/svg';

const CW = 64;          // pas horizontal entre deux cellules
const CH = 56;          // pas vertical entre deux cellules
const MARGIN = 40;      // marge gauche/droite
const TOP_PAD = 18;     // petite marge (tete/cartouche hors canvas, dans le PDF)
const BOTTOM_PAD = 18;  // petite marge (pied hors canvas, dans le PDF)

const DIR = { right: [1, 0], left: [-1, 0], top: [0, -1], bottom: [0, 1] };
const DIR_ORDER = ['right', 'top', 'bottom', 'left'];

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function txt(parent, x, y, content, cls = 'lbl', anchor = 'start') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, parent);
  t.textContent = content;
  return t;
}

/* ------------------------------------------------------------- mise en page */

/** Place l'arbre sur une grille : un élément par cellule, sans recouvrement. */
function computeLayout(project) {
  const pos = new Map();          // id -> { x, y }
  const occupied = new Set();     // "x,y"
  const key = (x, y) => x + ',' + y;

  const place = (node, x, y) => {
    occupied.add(key(x, y));
    pos.set(node.id, { x, y });
    for (const dir of DIR_ORDER) {
      const cid = (node.children || {})[dir];
      if (cid == null) continue;
      const child = nodeById(project, cid);
      if (!child) continue;
      const [dx, dy] = DIR[dir];
      let nx = x + dx, ny = y + dy, guard = 0;
      while (occupied.has(key(nx, ny)) && guard++ < 1000) { nx += dx; ny += dy; }
      place(child, nx, ny);
    }
  };
  if (project.supply) place(project.supply, 0, 0);

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const { x, y } of pos.values()) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (pos.size === 0) { minX = maxX = minY = maxY = 0; }

  const px = (x) => MARGIN + (x - minX) * CW + CW / 2;
  const py = (y) => TOP_PAD + (y - minY) * CH + CH / 2;
  const W = (maxX - minX + 1) * CW + 2 * MARGIN;
  const H = (maxY - minY + 1) * CH + TOP_PAD + BOTTOM_PAD;
  return { pos, px, py, W, H };
}

export function sheetSize(project) {
  const L = computeLayout(project);
  return { w: Math.max(560, L.W), h: Math.max(380, L.H) };
}

/* ---------------------------------------------------------------------- dessin */

export function deviceDetail(node) {
  const p = node.params || {};
  switch (node.symbolType) {
    case 'rcd': {
      const poles = node.poles || '2P';
      const diff = p.diff != null ? '\u0394' + p.diff + 'mA' : '';
      const rating = p.rating != null ? poles + ' - ' + p.rating + 'A' : poles;
      const t = p.type ? 'Type ' + p.type : '';
      return [diff, rating, t].filter(Boolean).join('\n');
    }
    case 'breaker': {
      const poles = node.poles || '1P';
      const cal = (p.curve || '') + (p.rating != null ? p.rating + 'A' : '');
      return cal ? (poles + ' - ' + cal) : poles;
    }
    case 'fuse':
      return [(p.rating != null ? p.rating + 'A' : '')].filter(Boolean).join('');
    case 'socket':
      return '';
    case 'fil': {
      const c = node.cable || {};
      const section = c.section != null ? String(c.section).replace('.', ',') + 'mm²' : '';
      return [c.type, section].filter(Boolean).join(' ');
    }
    default:
      return node.detail || '';
  }
}

/** Place repère + caractéristique dans le repère LOCAL de l'élément (tourne avec lui) :
 *  rotation du bloc = orient - 90° (à 0° : à droite, texte -90° ; à 90° : en bas, texte 0° ;
 *  à 180° : à gauche, texte 90° ; à -90° : au-dessus, texte 180°). */
function placeLabel(g, node, def, cls = 'lbl') {
  if (node.symbolType === 'node') return;   // un node n'a aucune propriété affichée
  const det = deviceDetail(node);
  // Repère masqué par défaut : ne s'affiche que si l'option est explicitement activée.
  const showRep = node.showLabel === true;
  const lab = showRep ? node.label : '';
  if (!lab && !det) return;
  const pos = node.labelPos || 'bottom';
  // Distance réglable du bloc de texte au bord du symbole, sur un seul axe (pixels).
  const off = node.labelOffset == null ? -5 : Number(node.labelOffset);
  const w2 = def.w / 2, h2 = def.h / 2;
  let lx, ly, dx, dy;
  if (pos === 'left') { lx = -(w2 + off); ly = 0; dx = lx; dy = 14; }
  else if (pos === 'top') { lx = 0; ly = -(h2 + off); dx = 0; dy = -(h2 + off) - 14; }
  else { lx = 0; ly = h2 + off; dx = 0; dy = h2 + off + 14; }
  // Orientation du bloc de texte : la position suit l'element, la rotation est normale.
  // Automatique : orient - 90, normalise pour ne jamais 'retourner' le texte.
  // Automatique : orient - 90°, normalise pour ne jamais 'retourner' le texte.
  const orient = node.orient || 0;
  let rot;
  const manuel = node.labelRot != null && node.labelRot !== 'auto';
  if (manuel) rot = Number(node.labelRot);
  else { rot = orient - 90; if (rot < -90) rot += 180; }
  const spinRot = rot - orient;
  const spin = el('g', { transform: 'rotate(' + spinRot + ')' }, g);
  if (lab) txt(spin, lx, ly, lab, cls, 'middle');
  if (det) txt(spin, dx, dy, det, 'lbl-sm', 'middle');
}

function symbolGroup(svg, def, href, cx, cy, selected, attrs, orient = 0) {
  const g = el('g', { transform: `translate(${cx},${cy})`, class: 'sym-wrap' + (selected ? ' selected' : ''), ...attrs }, svg);
  // le groupe pivoté contient TOUT l'élément (image + zone cliquable) :
  // quand on l'oriente (ex. un fil 40x80 mis à l'horizontale), la hitbox suit.
  const rot = el('g', { transform: `rotate(${orient})`, class: 'sym-rot' }, g);
  el('rect', { class: 'outline', x: -def.w / 2 - 6, y: -def.h / 2 - 6, width: def.w + 12, height: def.h + 12, fill: 'transparent', stroke: 'transparent' }, rot);
  rot.appendChild(el('image', { href, x: -def.w / 2, y: -def.h / 2, width: def.w, height: def.h, class: 'sym-img' }));
  return { g, rot };
}

/** Petite croix cliquable (« + ») pour un point d'ancrage ou une insertion. */
function plusMark(svg, cx, cy, cls, attrs) {
  const g = el('g', { class: 'plus ' + cls, transform: `translate(${cx},${cy})`, ...attrs }, svg);
  el('circle', { r: 15, class: 'plus-hit', fill: 'transparent' }, g);
  el('circle', { r: 10, class: 'plus-bg' }, g);
  el('line', { x1: -5, y1: 0, x2: 5, y2: 0, class: 'plus-bar' }, g);
  el('line', { x1: 0, y1: -5, x2: 0, y2: 5, class: 'plus-bar' }, g);
  return g;
}

/** Demi-dimensions du corps d'un symbole (le compteur est plus large qu'une cellule). */
function halfOf(project, id) {
  const n = nodeById(project, id);
  if (!n || n.symbolType === 'compteur') return { w: 44, h: 32 };
  const def = symbolOf(n.symbolType);
  return { w: (def.w || 40) / 2, h: (def.h || 40) / 2 };
}

export function renderSchema(svg, project, opts = {}) {
  const L = computeLayout(project);
  const { pos, px, py, W, H } = L;
  const info = project.info;

  svg.innerHTML = '';
  svg.setAttribute('viewBox', opts.viewBox || `0 0 ${W} ${H}`);

  const elements = project.elements || [];
  const emptyEl = document.getElementById('empty-state');
  if (emptyEl) emptyEl.hidden = elements.length > 0;

  // ---- titre ----
  // (le titre, le cartouche et le pied sont hors canvas : voir le PDF / le bandeau HTML)

  // ---- conducteurs (parent -> enfant) ----
  for (const node of elements) {
    const p = nodeById(project, node.parent);
    const a = p && pos.get(p.id) ? pos.get(p.id) : null;
    const b = pos.get(node.id);
    if (!a || !b) continue;
    el('line', { x1: px(a.x), y1: py(a.y), x2: px(b.x), y2: py(b.y), class: 'bus' }, svg);
  }
  // conducteur compteur -> premier élément
  for (const dir of DIR_ORDER) {
    const cid = (project.supply.children || {})[dir];
    if (cid == null) continue;
    const b = pos.get(cid);
    const a = pos.get(project.supply.id);
    if (a && b) el('line', { x1: px(a.x), y1: py(a.y), x2: px(b.x), y2: py(b.y), class: 'bus' }, svg);
  }

  // (les « + » d'ancrage et d'insertion sont dessinés après les symboles,
  //  pour rester au premier plan — cf. plus bas)

  // ---- compteur (bas à gauche) ----
  const sc = pos.get(project.supply.id);
  if (sc) {
    const cx = px(sc.x), cy = py(sc.y);
    const sup = project.supply;
    const g = el('g', { class: 'sym-wrap' + ((opts.selectedIds ? opts.selectedIds.has(sup.id) : opts.selectedId === sup.id) ? ' selected' : ''), transform: `translate(${cx},${cy})`, 'data-el': sup.id }, svg);
    const srot = el('g', { transform: `rotate(${sup.orient || 0})`, class: 'sym-rot' }, g);
    el('rect', { class: 'outline', x: -44, y: -32, width: 88, height: 64, fill: 'transparent', stroke: 'transparent' }, srot);
    srot.appendChild(el('rect', { x: -38, y: -26, width: 76, height: 52, rx: 4, fill: '#fff', stroke: '#111827', 'stroke-width': 1.6 }));
    // distance réglable du libellé, sur l'axe vertical
    const so = sup.labelOffset == null ? -5 : Number(sup.labelOffset);
    if (sup.showLabel === true && (sup.label || '').trim()) txt(g, 0, -4 - so, sup.label, 'lbl', 'middle');
    txt(g, 0, 12 + so, sup.detail || '', 'lbl-sm', 'middle');
  }

  // ---- éléments ----
  for (const node of elements) {
    const c = pos.get(node.id);
    if (!c) continue;
    const cx = px(c.x), cy = py(c.y);
    const sel = opts.selectedIds ? opts.selectedIds.has(node.id) : opts.selectedId === node.id;
    const def = symbolOf(node.symbolType);
    const href = node.symbolType === 'socket' ? socketUrl(node.socketType)
      : node.symbolType === 'switch' ? switchUrl(node.switchType)
      : node.symbolType === 'fil' ? filUrl(node)
      : symbolUrl(node.symbolType);
    const { g, rot } = symbolGroup(svg, def, href, cx, cy, sel, { 'data-el': node.id }, node.orient || 0);
    placeLabel(rot, node, def);
  }

  // ---- insertion de node au milieu de chaque conducteur ----
  //      Dernière couche : toujours cliquable, même au-dessus du symbole du compteur.
  const drawMid = (pid, dir) => {
    const a = pos.get(pid);
    const cid = (nodeById(project, pid)?.children || {})[dir];
    const b = cid != null ? pos.get(cid) : null;
    if (!a || !b) return;
    const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
    const [dx, dy] = DIR[dir];
    const vx = x2 - x1, vy = y2 - y1;
    const span = Math.abs(dx * vx) + Math.abs(dy * vy);
    const halfP = halfOf(project, pid), halfC = halfOf(project, cid);
    const padP = dx ? halfP.w : halfP.h;
    const padC = dx ? halfC.w : halfC.h;
    let t = 0.5;
    if (span > 0) {
      // on décale vers l'enfant tant que le « + » serait sous le parent
      const min = Math.min(0.85, (padP + 5) / span);
      t = Math.max(0.5, min);
      // ... sans le placer sous l'enfant
      const max = Math.max(0.15, 1 - (padC + 5) / span);
      t = Math.min(t, max);
    }
    plusMark(svg, x1 + vx * t, y1 + vy * t, 'ui-only link-add', { 'data-link': `${pid}:${dir}` });
  };

  // ---- points d'ancrage libres : visibles seulement si l'élément est sélectionné
  //      (ou pendant un glisser-déposer depuis la palette) ----
  const anchorsShown = (node) => (opts.selectedIds ? opts.selectedIds.has(node.id) : node.id === opts.selectedId) || !!opts.showAnchors;
  const drawAnchors = (node) => {
    if (!anchorsShown(node)) return;
    const hasChild = node.children && Object.values(node.children).some((v) => v != null);
    // node et compteur restent ramifiables : leurs points d'ancrage libres restent visibles
    const ramifiable = node.symbolType === 'node' || node.symbolType === 'tableau';
    if (hasChild && !ramifiable) return;
    const c = pos.get(node.id);
    if (!c) return;
    const half = halfOf(project, node.id);
    // le compteur n'a qu'un seul point d'ancrage : a droite
    const dirs = node.symbolType === 'compteur' ? ['right'] : anchorsOf(node.symbolType);
    for (const dir of dirs) {
      if ((node.children || {})[dir] != null) continue;
      const [dx, dy] = DIR[dir];
      // juste au-delà du bord du symbole (le compteur est plus large qu'une cellule)
      const ox = Math.max(CW * 0.3, half.w + 6);
      const oy = Math.max(CH * 0.3, half.h + 6);
      plusMark(svg, px(c.x) + dx * ox, py(c.y) + dy * oy, 'ui-only anchor', { 'data-anchor': `${node.id}:${dir}` });
    }
  };

  for (const dir of DIR_ORDER) if ((project.supply.children || {})[dir] != null) drawMid(project.supply.id, dir);
  for (const node of elements) {
    for (const dir of DIR_ORDER) if ((node.children || {})[dir] != null) drawMid(node.id, dir);
  }
  if (anchorsShown(project.supply)) drawAnchors(project.supply);
  for (const node of elements) if (anchorsShown(node)) drawAnchors(node);
  // (pied de page / cartouche : hors canvas, voir le PDF)
}
