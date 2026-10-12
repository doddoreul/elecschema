// Rendu SVG unifilaire — arbre d'éléments par points d'ancrage.
//   Le compteur (racine) est placé en bas à gauche ; chaque élément s'ancre
//   dans un point libre de son parent, dans une direction cardinale.
//   Un « node » (4 ancrages) peut être inséré entre deux éléments.
// Aucun rendu classique/développé : uniquement le schéma unifilaire.

import { symbolOf, symbolUrl, socketUrl, switchUrl, filUrl } from './symbols.js';
import { anchorKeysOf, baseDir, outputIndex } from './standards.js';
import { nodeById } from './model.js';

const NS = 'http://www.w3.org/2000/svg';

const CW = 80;          // pas horizontal entre deux cellules
const CH = 56;          // pas vertical entre deux cellules
const MARGIN = 40;      // marge gauche/droite
const TOP_PAD = 18;     // petite marge (tete/cartouche hors canvas, dans le PDF)
const BOTTOM_PAD = 18;  // petite marge (pied hors canvas, dans le PDF)

const DIR = { right: [1, 0], left: [-1, 0], top: [0, -1], bottom: [0, 1] };

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

/** Dimensions réelles (px) d'un élément, orientation comprise : un symbole
 *  pivoté (ex. fil 40x80 à l'horizontale) occupe plus que sa cellule. */
/** Tableau : la barre couvre une colonne par sortie (une entrée à gauche). */
const tabSpan = (node) => (node && node.symbolType === 'tableau' ? (node.outputs || 2) - 1 : 0);

function sizeOf(node, span = tabSpan(node)) {
  if (!node || node.symbolType === 'compteur') return { w: 88, h: 64 };
  if (node.symbolType === 'tableau') return { w: span * CW + 64, h: 24 };
  const def = symbolOf(node.symbolType);
  const w = def.w || 40, h = def.h || 40;
  // quart de tour impair => largeur et hauteur échangées
  const quarter = Math.abs(Number(node.orient || 0) / 90) % 2 === 1;
  return quarter ? { w: h, h: w } : { w, h };
}

/** Place l'arbre sur une grille : un élément par cellule, **sans chevauchement**.
 *  Le pas de grille (64x56) est plus petit que certains symboles (compteur 88x64,
 *  fil 40x80, board 120x40) : l'occupation est donc testée au pixel près, sur le
 *  rectangle réellement occupé, et non case par case. */
/** Disposition complète. Une branche qui bloque un tracé est décalée (latéralement pour une
 *  sortie de tableau, vers l'extérieur sinon) puis tout est recalculé, jusqu'à ce que chaque
 *  fil trouve son passage. Les fils ne se croisent jamais. */
let layoutMemo = { key: null, value: null };

export function computeLayout(project) {
  // le tracé ne dépend que de la structure (pas des repères ni des textes) : cache du dernier calcul
  const key = JSON.stringify([project.supply.id, project.elements.map((e) => [e.id, e.parent, e.dir, e.symbolType, e.orient, e.outputs, e.children, e.cable?.montage])]);
  if (layoutMemo.key === key) return layoutMemo.value;
  const bias = new Map();          // id enfant -> décalage supplémentaire (en cases)
  let L = layoutOnce(project, bias);
  for (let iter = 0; iter < 30 && L.bump != null; iter++) {
    if ((bias.get(L.bump) || 0) >= 6) break;      // branche déjà décalée au maximum : détour accepté
    bias.set(L.bump, (bias.get(L.bump) || 0) + 1);
    L = layoutOnce(project, bias);
  }
  layoutMemo = { key, value: L };
  return L;
}

function layoutOnce(project, bias) {
  const pos = new Map();          // id -> { x, y } (cellule)
  const routes = new Map();       // id enfant -> points [{ x, y }] depuis le port du parent (cellules)
  const rects = [];               // { id, r } : rectangles des éléments (repère grille, en px)
  const wires = [];               // { a, b } : tronçons de fil occupés (cellules)
  let bump = null;                // branche à décaler pour débloquer un tracé

  // colonne (décalée) d'une sortie de tableau : un décalage pousse aussi les sorties suivantes
  const colOf = (node, key) => {
    const k = outputIndex(key);
    // sortie terre (bottom) : au milieu de la barre
    if (k < 0) return Math.floor(spanOf(node) / 2);
    let shift = 0;
    for (let i = 0; i <= k; i++) {
      const cid = (node.children || {})['top-' + (i + 1)];
      if (cid != null) shift += bias.get(cid) || 0;
    }
    return k + shift;
  };
  // largeur (en colonnes) d'un tableau : jusqu'à sa dernière sortie vierge
  const spanOf = (node) => (node.symbolType !== 'tableau' ? 0 : colOf(node, 'top-' + (node.outputs || 2)));

  // rectangle occupé par `node` posé sur la cellule (x, y), centre inclus
  const rectAt = (node, x, y) => {
    const span = spanOf(node);
    const s = sizeOf(node, span);
    const cx = x * CW + CW / 2 + span * CW / 2, cy = y * CH + CH / 2;
    return { x0: cx - s.w / 2, x1: cx + s.w / 2, y0: cy - s.h / 2, y1: cy + s.h / 2 };
  };
  const overlap = (r, o) => r.x0 < o.x1 && o.x0 < r.x1 && r.y0 < o.y1 && o.y0 < r.y1;
  // un tronçon de fil épaissi (pour le tester contre les éléments)
  const thin = (a, b) => {
    const p = { x: a.x * CW + CW / 2, y: a.y * CH + CH / 2 }, q = { x: b.x * CW + CW / 2, y: b.y * CH + CH / 2 };
    return { x0: Math.min(p.x, q.x) - 1, x1: Math.max(p.x, q.x) + 1, y0: Math.min(p.y, q.y) - 1, y1: Math.max(p.y, q.y) + 1 };
  };
  // deux tronçons orthogonaux se touchent ou se croisent ? Le port partagé `shared` est toléré.
  const segHit = (a, b, c, d, shared) => {
    const x0 = Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)), x1 = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x));
    const y0 = Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)), y1 = Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
    if (x0 > x1 || y0 > y1) return false;
    return !(x0 === x1 && y0 === y1 && x0 === shared.x && y0 === shared.y);
  };
  // un tracé est libre s'il ne touche ni un élément (hors parent), ni un autre fil, ni l'enfant lui-même
  const routeFree = (child, C, pts, parentId, port) => {
    const rc = rectAt(child, C.x, C.y);
    for (const it of rects) if (it.id !== parentId && overlap(rc, it.r)) return false;
    for (const w of wires) if (overlap(rc, w.t)) return false;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const sr = thin(a, b);
      for (const it of rects) if (it.id !== parentId && overlap(sr, it.r)) return false;
      for (const w of wires) if (segHit(a, b, w.a, w.b, port)) return false;
    }
    return true;
  };
  // Tracé le plus court : sort du port (de préférence dans sa direction, sinon de biais avec
  // une pénalité), puis tourne de s cases si besoin. Un tracé non rectiligne déclenche un décalage.
  const findRoute = (child, P, [dx, dy], parentId, tMin, detour) => {
    const DIRS4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const R of [8, 24, 60]) {
      const cands = [];
      for (const e of DIRS4) {
        const along = e[0] === dx && e[1] === dy;
        if (!along && !detour) continue;
        const pen = along ? 0 : (e[0] === -dx && e[1] === -dy ? 8 : 4);
        const tStart = along ? tMin : 1;
        const pp = e[0] ? [0, 1] : [1, 0];
        for (let t = tStart; t <= tStart + R; t++) {
          for (let s = -R; s <= R; s++) cands.push({ e, pp, t, s, cost: pen + (t - tStart) + 2 * Math.abs(s) + (s ? 1 : 0) });
        }
      }
      cands.sort((a, b) => a.cost - b.cost);
      for (const { e, pp, t, s } of cands) {
        const Q = { x: P.x + e[0] * t, y: P.y + e[1] * t };
        const C = { x: Q.x + pp[0] * s, y: Q.y + pp[1] * s };
        const pts = s ? [P, Q, C] : [P, C];
        if (routeFree(child, C, pts, parentId, P)) return pts;
      }
    }
    return null;
  };
  // tracé rectiligne, sortant du port dans sa direction
  const along = (pts, [dx, dy]) => pts.length === 2 && Math.sign(pts[1].x - pts[0].x) === dx && Math.sign(pts[1].y - pts[0].y) === dy;

  // Élément bloquant la sortie d'un port : la branche (enfant d'un ancêtre commun) à décaler.
  const blockerOf = (P, [dx, dy], parent) => {
    const anc = new Set();
    for (let n = parent; n; n = nodeById(project, n.parent)) anc.add(n.id);
    // d'abord la direction demandée, puis les autres (un élément entouré de ses enfants)
    const order = [[dx, dy], [1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const [ex, ey] of order) {
      for (let k = 1; k <= 30; k++) {
        const q = { x: (P.x + ex * k) * CW + CW / 2, y: (P.y + ey * k) * CH + CH / 2 };
        const hit = rects.find((it) => it.r.x0 <= q.x && q.x <= it.r.x1 && it.r.y0 <= q.y && q.y <= it.r.y1);
        if (!hit) continue;
        if (anc.has(hit.id)) break;
        let n = nodeById(project, hit.id);
        while (n && !anc.has(n.parent)) n = nodeById(project, n.parent);
        if (n) return n.id;
        break;
      }
    }
    return null;
  };

  // Les branches les plus récentes (id les plus grands) sont posées en premier : les anciennes
  // se décalent et contournent, les fils ne se croisent jamais.
  const place = (node, x, y) => {
    const kids = Object.keys(node.children || {})
      .filter((k) => node.children[k] != null && nodeById(project, node.children[k]))
      .sort((a, b) => node.children[b] - node.children[a]);
    // d'abord les branches rectilignes, puis les détours : un détour ne prend pas la place d'une droite
    let todo = kids;
    for (const detour of [false, true]) {
      const next = [];
      for (const key of todo) {
        const child = nodeById(project, node.children[key]);
        const dir = DIR[baseDir(key)];
        const isOut = node.symbolType === 'tableau';
        // une sortie de tableau part de sa propre colonne (décalée si nécessaire)
        const extra = bias.get(child.id) || 0;
        const P = { x: x + (isOut ? colOf(node, key) : 0), y };
        const tMin = isOut ? 1 : 1 + extra;
        let pts = findRoute(child, P, dir, node.id, tMin, detour);
        if (!pts) {
          if (!detour) { next.push(key); continue; }
          // aucun passage : on décale la branche qui bloque, puis on pose en ligne droite
          if (bump == null) bump = blockerOf(P, dir, node);
          pts = [P, { x: P.x + dir[0] * tMin, y: P.y + dir[1] * tMin }];
        } else if (bump == null && !along(pts, dir)) {
          // tracé non rectiligne : on décale la branche qui bloque, si c'est possible
          bump = blockerOf(P, dir, node);
        }
        const C = pts[pts.length - 1];
        pos.set(child.id, C);
        routes.set(child.id, pts);
        for (let i = 0; i < pts.length - 1; i++) wires.push({ a: pts[i], b: pts[i + 1], t: thin(pts[i], pts[i + 1]) });
        rects.push({ id: child.id, r: rectAt(child, C.x, C.y) });
        place(child, C.x, C.y);
      }
      todo = next;
    }
  };
  if (project.supply) {
    pos.set(project.supply.id, { x: 0, y: 0 });
    rects.push({ id: project.supply.id, r: rectAt(project.supply, 0, 0) });
    place(project.supply, 0, 0);
  }

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  const points = [...pos.values(), ...[...routes.values()].flat()];
  for (const { x, y } of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (pos.size === 0) { minX = maxX = minY = maxY = 0; }

  const px = (x) => MARGIN + (x - minX) * CW + CW / 2;
  const py = (y) => TOP_PAD + (y - minY) * CH + CH / 2;
  const W = (maxX - minX + 1) * CW + 2 * MARGIN;
  const H = (maxY - minY + 1) * CH + TOP_PAD + BOTTOM_PAD;
  return { pos, routes, span: spanOf, col: colOf, bump, px, py, W, H };
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
      const n = typeof c.n === 'number' ? String(c.n) + (c.terre === false ? 'X' : 'G') : (c.n || '');
      const section = c.section != null ? String(c.section).replace('.', ',') + 'mm²' : '';
      return [n + section, c.type].filter(Boolean).join('\n');
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
  // Orientation du bloc de texte : la position suit l'element, la rotation est normale.
  // Automatique : orient - 90°, normalise pour ne jamais 'retourner' le texte.
  const orient = node.orient || 0;
  let rot;
  const manuel = node.labelRot != null && node.labelRot !== 'auto';
  if (manuel) rot = Number(node.labelRot);
  else { rot = orient - 90; if (rot < -90) rot += 180; }
  // un fil : le libellé est remonté de 15 px vers le haut de l'écran
  // (le bloc est pivoté de `rot` : on convertit le décalage écran en coordonnées locales)
  let liftX = 0, liftY = 0;
  if (node.symbolType === 'fil') {
    const a = rot * Math.PI / 180;
    liftX = -30 * Math.sin(a);
    liftY = -30 * Math.cos(a);
  }
  let lx, ly, dx, dy;
  if (pos === 'left') { lx = -(w2 + off) + liftX; ly = liftY; dx = lx; dy = liftY + 14; }
  else if (pos === 'top') { lx = liftX; ly = -(h2 + off) + liftY; dx = liftX; dy = -(h2 + off) - 14 + liftY; }
  else { lx = liftX; ly = h2 + off + liftY; dx = liftX; dy = h2 + off + 14 + liftY; }
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
  const { pos, routes, px, py, W, H } = L;
  const info = project.info;

  svg.innerHTML = '';
  svg.setAttribute('viewBox', opts.viewBox || `0 0 ${W} ${H}`);

  const elements = project.elements || [];
  const emptyEl = document.getElementById('empty-state');
  if (emptyEl) emptyEl.hidden = elements.length > 0;

  // ---- titre ----
  // (le titre, le cartouche et le pied sont hors canvas : voir le PDF / le bandeau HTML)

  // ---- conducteurs (parent -> enfant) : tracés orthogonaux, jamais croisés ----
  // Le fil va du centre d'un élément au centre du suivant.
  for (const node of elements) {
    const pts = routes.get(node.id);
    if (!pts) continue;
    const d = pts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ');
    el('polyline', { points: d, class: 'bus', fill: 'none' }, svg);
  }

  // (les « + » d'ancrage et d'insertion sont dessinés après les symboles,
  //  pour rester au premier plan — cf. plus bas)

  // barre de tableau : entrée à gauche, une colonne par sortie (horizontale, non pivotée)
  const drawBar = (node, c, sel) => {
    const span = L.span(node) * CW, hw = span / 2;
    const g = el('g', { transform: `translate(${px(c.x) + hw},${py(c.y)})`, class: 'sym-wrap' + (sel ? ' selected' : ''), 'data-el': node.id }, svg);
    el('rect', { class: 'outline', x: -hw - 36, y: -14, width: span + 72, height: 28, fill: 'transparent', stroke: 'transparent' }, g);
    el('rect', { x: -hw - 31, y: -2.5, width: span + 62, height: 5, rx: 1.5, fill: '#111827' }, g);
    el('rect', { x: -hw - 31, y: -5.5, width: 4, height: 11, rx: 1.5, fill: '#111827' }, g);
    el('rect', { x: hw + 27, y: -5.5, width: 4, height: 11, rx: 1.5, fill: '#111827' }, g);
    placeLabel(g, { ...node, labelPos: 'bottom', labelRot: 0, labelOffset: node.labelOffset ?? 8 }, { w: span + 62, h: 24 });
  };

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
    if (node.symbolType === 'tableau') { drawBar(node, c, sel); continue; }
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
    const pnode = nodeById(project, pid);
    const cid = (pnode?.children || {})[dir];
    const pts = cid != null ? routes.get(cid) : null;
    if (!pts || pts.length < 2) return;
    // le « + » se place sur le premier tronçon, sorti du parent
    const x1 = px(pts[0].x), y1 = py(pts[0].y), x2 = px(pts[1].x), y2 = py(pts[1].y);
    const [dx, dy] = DIR[baseDir(dir)];
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
    if (opts.accepts && !opts.accepts(node)) return;
    const c = pos.get(node.id);
    if (!c) return;
    const half = halfOf(project, node.id);
    // le compteur n'a qu'un seul point d'ancrage : a droite
    const dirs = node.symbolType === 'compteur' ? ['right'] : anchorKeysOf(node);
    for (const dir of dirs) {
      if ((node.children || {})[dir] != null) continue;
      if (node.symbolType === 'tableau') {
        if (dir === 'bottom') {
          // sortie terre : sous la barre, au milieu de la barre
          plusMark(svg, px(c.x + L.col(node, dir)), py(c.y) + 18, 'ui-only anchor', { 'data-anchor': `${node.id}:${dir}` });
        } else {
          // sortie vierge : au-dessus de la barre, dans sa colonne
          plusMark(svg, px(c.x + L.col(node, dir)), py(c.y) - 18, 'ui-only anchor', { 'data-anchor': `${node.id}:${dir}` });
        }
        continue;
      }
      const [dx, dy] = DIR[dir];
      // juste au-delà du bord du symbole (le compteur est plus large qu'une cellule)
      const ox = Math.max(CW * 0.3, half.w + 6);
      const oy = Math.max(CH * 0.3, half.h + 6);
      plusMark(svg, px(c.x) + dx * ox, py(c.y) + dy * oy, 'ui-only anchor', { 'data-anchor': `${node.id}:${dir}` });
    }
  };

  for (const dir of Object.keys(project.supply.children || {})) if (project.supply.children[dir] != null) drawMid(project.supply.id, dir);
  for (const node of elements) {
    for (const dir of Object.keys(node.children || {})) if (node.children[dir] != null) drawMid(node.id, dir);
  }
  if (anchorsShown(project.supply)) drawAnchors(project.supply);
  for (const node of elements) if (anchorsShown(node)) drawAnchors(node);
  // (pied de page / cartouche : hors canvas, voir le PDF)
}
