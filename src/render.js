// Rendu SVG unifilaire — arbre d'éléments par points d'ancrage.
//   Le compteur (racine) est placé en bas à gauche ; chaque élément s'ancre
//   dans un point libre de son parent, dans une direction cardinale.
//   Un « node » (4 ancrages) peut être inséré entre deux éléments.
// Aucun rendu classique/développé : uniquement le schéma unifilaire.

import { defOf, symbolUrl, socketUrl, switchUrl, filUrl } from './symbols.js';
import { anchorKeysOf, baseDir, outputIndex } from './standards.js';
import { nodeById } from './model.js';

const NS = 'http://www.w3.org/2000/svg';

const CW = 40;          // pas horizontal de base entre deux cellules
const CH = 28;          // pas vertical de base entre deux cellules
const GAP = 10;         // espace libre minimal (px) entre deux corps adjacents
const MARGIN = 40;      // marge gauche/droite
const TOP_PAD = 18;     // petite marge (tete/cartouche hors canvas, dans le PDF)
const BOTTOM_PAD = 18;  // petite marge (pied hors canvas, dans le PDF)

const DIR = { right: [1, 0], left: [-1, 0], top: [0, -1], bottom: [0, 1] };
const BAR_PITCH = CW;                                    // pas d'une colonne de barre, horizontal ou vertical
const NP_END = 20;                                      // débord de barre au-delà de la première/dernière colonne
const NP_THICK = 12;                                    // épaisseur réservée (hitbox + espacement) d'un node parallèle
const isBarType = (t) => t === 'tableau' || t === 'node_parallel';
const quarterTurns = (node) => { const n = Math.round(Number(node?.orient || 0) / 90); return ((n % 4) + 4) % 4; };
const barVertical = (node) => quarterTurns(node) % 2 === 1;
const barReversed = (node) => quarterTurns(node) >= 2;
/** Ordre horaire des directions (y vers le bas). */
const CARD_CLOCK = ['right', 'bottom', 'left', 'top'];
const anchorDir = (node, key) => {
  const d = baseDir(key);
  const t = (node && node.symbolType === 'node_parallel') ? quarterTurns(node) : 0;
  if (!t) return d;
  const i = CARD_CLOCK.indexOf(d);
  return i < 0 ? d : CARD_CLOCK[(i + t) % 4];
};

/** Sens de croissance des colonnes d'une barre (unitaire, écran y vers le bas) :
 *  horizontale -> a droite (gauche si 180°), verticale -> en haut (bas si 270°).
 *  C'est le cote ou apparaissent les nouvelles sorties (« + » de fin de barre). */
const barAxis = (node) => {
  const rev = barReversed(node) ? -1 : 1;
  return barVertical(node) ? { x: 0, y: -rev } : { x: rev, y: 0 };
};
/** Direction cardinale d'un vecteur unitaire (barAxis). */
const cardOf = (u) => (u.x > 0 ? 'right' : u.x < 0 ? 'left' : u.y < 0 ? 'top' : 'bottom');

/** Format de page de mise en page : A4 paysage (297 x 210 mm à 2 px/mm), pages côte à côte. */
export const PAGE = { w: 594, h: 420, gap: 0 };

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
/** Tableau : la barre couvre une colonne par sortie (une entrée à gauche).
 *  Node parallèle : colonne 0 = entrée, puis une colonne par sortie. */
const tabSpan = (node) => {
  if (!node) return 0;
  if (node.symbolType === 'node_parallel') return node.outputs || 2;
  if (node.symbolType === 'tableau') return (node.outputs || 2) - 1;
  return 0;
};

function sizeOf(node, span = tabSpan(node)) {
  if (!node || node.symbolType === 'compteur') return { w: 88, h: 64 };
  if (node.symbolType === 'tableau') return { w: span * CW + 64, h: 24 };
  if (node.symbolType === 'node_parallel') {
    // colonne 0 = point d'entrée : la barre part de là, sans débord avant lui
    const len = span * BAR_PITCH + NP_END;
    return barVertical(node) ? { w: NP_THICK, h: len } : { w: len, h: NP_THICK };
  }
  const def = defOf(node);
  const w = def.w || 40, h = def.h || 40;
  // quart de tour impair => largeur et hauteur échangées
  const quarter = Math.abs(Number(node.orient || 0) / 90) % 2 === 1;
  return quarter ? { w: h, h: w } : { w, h };
}

/** Place l'arbre sur une grille : un élément par cellule, **sans chevauchement**.
 *  L'écart le long de la direction suit la taille réelle des deux corps
 *  (demi-parent + demi-enfant + `GAP`), converti en cellules de `CW`/`CH` px : les
 *  symboles se resserrent au plus près sans se recouvrir. Le compteur (88x64), le fil
 *  (40x80) et le tableau restent testés au pixel près, sur le rectangle réellement occupé. */
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

  // colonne (décalée) d'une sortie de barre : un décalage pousse aussi les sorties suivantes.
  // node parallèle : la colonne 0 est réservée à l'entrée, les sorties commencent en 1.
  const colOf = (node, key) => {
    const k = outputIndex(key);
    // sortie terre (bottom) : au milieu de la barre
    if (k < 0) return Math.floor(spanOf(node) / 2);
    let shift = 0;
    for (let i = 0; i <= k; i++) {
      const cid = (node.children || {})['top-' + (i + 1)];
      if (cid != null) shift += bias.get(cid) || 0;
    }
    return (node?.symbolType === 'node_parallel' ? 1 : 0) + k + shift;
  };
  // largeur (en colonnes) d'un tableau : jusqu'à sa dernière sortie vierge
  const spanOf = (node) => (isBarType(node?.symbolType) ? colOf(node, 'top-' + (node.outputs || 2)) : 0);

  // rectangle occupé par `node` posé sur la cellule (x, y), centre inclus
  const rectAt = (node, x, y) => {
    const span = spanOf(node);
    const s = sizeOf(node, span);
    let cx = x * CW + CW / 2, cy = y * CH + CH / 2;
    if (isBarType(node?.symbolType)) {
      const u = barAxis(node);
      // tableau : barre centrée sur la première colonne + NP_END de chaque côté ;
      // node_parallel : barre qui part de l'entrée (aucun débord avant elle)
      const half = node.symbolType === 'node_parallel'
        ? (span * BAR_PITCH + NP_END) / 2
        : (span / 2) * BAR_PITCH + NP_END;
      cx += u.x * half;
      cy += u.y * half;
    }
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
        const isOut = isBarType(node?.symbolType);
        // une sortie de tableau/barre parallèle part de sa propre colonne (décalée si nécessaire),
        // selon son orientation (axe horizontal ou vertical, sens direct ou inversé)
        const extra = bias.get(child.id) || 0;
        const P = isOut ? (() => {
          const k = colOf(node, key);
          const u = barAxis(node);
          return { x: x + u.x * k * (BAR_PITCH / CW), y: y + u.y * k * (BAR_PITCH / CH) };
        })() : { x, y };
        const dir = DIR[anchorDir(node, key)];
        // écart minimal le long de la direction : les deux corps ne se chevauchent pas
        const pitch = dir[0] ? CW : CH;
        const sp = sizeOf(node, spanOf(node));
        const sc = sizeOf(child, spanOf(child));
        const halfP = (dir[0] ? sp.w : sp.h) / 2;
        const halfC = (dir[0] ? sc.w : sc.h) / 2;
        const tMin = (halfP + halfC + GAP) / pitch + extra;
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
  return { pos, routes, span: spanOf, col: colOf, bump, px, py, W, H, rects };
}

export function sheetSize(project) {
  const L = computeLayout(project);
  return { w: Math.max(560, L.W), h: Math.max(380, L.H) };
}

/** Vrai si la mise en page a dû forcer un tracé (décalages épuisés) : chevauchements possibles. */
export function layoutForced(project) {
  return computeLayout(project).bump != null;
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
  if (node.symbolType === 'node' || node.symbolType === 'node_parallel') return;   // un node n'a aucune propriété affichée
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
  // Un fil est bien plus long que large : son libellé court le long du conducteur et se
  // resserre contre lui. La distance perpendiculaire se prend donc sur la demi-largeur `w2`
  // (et non `h2`, qui l'écarterait de 20 px), et rien n'est décalé le long du fil.
  const across = node.symbolType === 'fil' ? w2 : h2;
  let lx, ly, dx, dy;
  if (pos === 'left') { lx = -(w2 + off); ly = 0; dx = lx; dy = 14; }
  else if (pos === 'top') { lx = 0; ly = -(across + off); dx = 0; dy = -(across + off) - 14; }
  else { lx = 0; ly = across + off; dx = 0; dy = across + off + 14; }
  const spinRot = rot - orient;
  const spin = el('g', { transform: 'rotate(' + spinRot + ')' }, g);
  if (lab) txt(spin, lx, ly, lab, cls, 'middle');
  if (det) txt(spin, dx, dy, det, 'lbl-sm', 'middle');
}

/** URL du fichier SVG d'un élément (même résolution pour le schéma et le plan d'implantation). */
export function symbolHref(node) {
  return node.symbolType === 'socket' ? socketUrl(node.socketType)
    : node.symbolType === 'switch' ? switchUrl(node.switchType)
    : node.symbolType === 'fil' ? filUrl(node)
    : symbolUrl(node.symbolType);
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
  el('circle', { r: 7.5, class: 'plus-hit', fill: 'transparent' }, g);
  el('circle', { r: 5, class: 'plus-bg' }, g);
  el('line', { x1: -2.5, y1: 0, x2: 2.5, y2: 0, class: 'plus-bar' }, g);
  el('line', { x1: 0, y1: -2.5, x2: 0, y2: 2.5, class: 'plus-bar' }, g);
  return g;
}

/** Demi-dimensions du corps d'un symbole (le compteur est plus large qu'une cellule).
 *  Passe par `sizeOf` : suit l'orientation ET la taille réelle d'une barre
 *  (tableau / node parallèle), dont la largeur grandit avec ses sorties. */
function halfOf(project, id) {
  const n = nodeById(project, id);
  if (!n || n.symbolType === 'compteur') return { w: 44, h: 32 };
  const s = sizeOf(n);
  return { w: s.w / 2, h: s.h / 2 };
}

/** Mise en page : cadres A4 paysage (2 px/mm), alignés à droite, + cartouche par page.
 *  Élément décoratif, retiré de l'impression (le PDF redessine le cartouche). */
function drawPrintPreview(svg, project, opts = {}) {
  const { w: A4W, h: A4H, gap } = PAGE;
  const nPages = Math.max(1, (project.pages || []).length);
  for (let i = 0; i < nPages; i++) {
    const x = i * (A4W + gap);
    el('rect', { class: 'page-guide ui-only' + (i === (opts.currentPage || 0) ? ' current' : ''), x, y: 0, width: A4W, height: A4H }, svg);
    txt(svg, x + 6, 12, 'Page ' + (i + 1), 'lbl-sm').setAttribute('class', 'lbl-sm ui-only page-label');
    drawCartouche(svg, project, x).setAttribute('class', 'cartouche ui-only');
  }
}

/** Cartouche de bas de page (chantier, occupant, installateur, projet), en coordonnées de page.
 *  Dessiné dans l'aperçu et sur chaque page du PDF. */
export function drawCartouche(parent, project, ox) {
  const { w: A4W, h: A4H } = PAGE;
  const info = project.info;
  const ch = info.chantier || {}, occ = info.occupant || {};
  const inst = info.installateur || {}, pr = info.projet || {};
  const date = ch.dateTravaux || pr.dateCreation || '';
  const place = [ch.codePostal && ch.localite].filter(Boolean).join(' ') || '';
  const occupant = [occ.nom, occ.prenom].filter(Boolean).join(' ');

  const CW2 = 250, CH2 = 62, CX = ox + A4W - CW2, CY = A4H - CH2;
  const g = el('g', { class: 'cartouche' }, parent);
  el('rect', { x: CX, y: CY, width: CW2, height: CH2, fill: '#fff', stroke: '#9ca3af', 'stroke-width': 1 }, g);
  el('line', { x1: CX, y1: CY + 13, x2: CX + CW2, y2: CY + 13, stroke: '#d1d5db', 'stroke-width': 1 }, g);
  const lines = [
    { t: ch.denomination || 'Installation domestique', cls: 'cart-title' },
    { t: [ch.adresse, place].filter(Boolean).join(', '), cls: 'cart-line' },
    { t: [occupant && 'Occupant : ' + occupant, occ.telephone].filter(Boolean).join(' · '), cls: 'cart-line' },
    { t: [inst.societe && 'Installateur : ' + inst.societe, date, 'v' + (pr.version || '1')].filter(Boolean).join(' · '), cls: 'cart-line' },
    { t: (pr.typeAlim === 'TRI' ? 'Triphasé' : 'Monophasé') + ' · RGIE/AREI · ' + (info.dessinateur?.nom || ''), cls: 'cart-line' },
  ];
  let y = CY + 9;
  for (const l of lines) {
    if (l.t) txt(g, CX + 5, y, l.t, l.cls);
    y += 11;
  }
  return g;
}

function drawNodeParallel(node, L, svg, c, sel, px, py) {
  const span = L.span(node);
  const u = barAxis(node);                                    // sens de la barre (colonnes)
  const [wx, wy] = DIR[anchorDir(node, 'top-1')];             // cote des sorties
  const rx = px(c.x), ry = py(c.y);                          // racine = colonne 0 (arrivée du parent)
  // point de la barre : d = décalage le long de l'axe (px), o = décalage côté sorties (px)
  const pt = (d, o) => ({ x: rx + u.x * d + wx * o, y: ry + u.y * d + wy * o });
  const g = el('g', { class: 'sym-wrap' + (sel ? ' selected' : ''), 'data-el': node.id }, svg);
  // barre fine : du point d'entrée (colonne 0, arrivée du parent) jusqu'au-delà de la
  // dernière colonne. Aucun débord avant l'entrée (sinon un « tiret » rebique vers le fil).
  const a = pt(0, 0), b = pt(span * BAR_PITCH + NP_END, 0);
  el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'bus' }, g);
  // une petite barre par sortie OCCUPÉE seulement : un emplacement libre n'a que son « + »
  // (sinon le tiret du haut, non recouvert par un fil, apparaît en trop).
  for (const key of Object.keys(node.children || {})) {
    if (node.children[key] == null || outputIndex(key) < 0) continue;
    const d = L.col(node, key) * BAR_PITCH;
    const p0 = pt(d, 0), p1 = pt(d, 6);
    el('line', { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, class: 'bus' }, g);
  }
  // zone cliquable : enveloppe de la barre et de ses sorties
  const pts = [a, b, pt(0, 6), pt(span * BAR_PITCH, 6)];
  const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
  const y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
  el('rect', { class: 'outline', x: x0 - 4, y: y0 - 4, width: x1 - x0 + 8, height: y1 - y0 + 8, fill: 'transparent', stroke: 'transparent' }, g);
  placeLabel(g, { ...node, labelPos: 'bottom', labelRot: 0, labelOffset: node.labelOffset ?? 8 }, { w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) });
}

export function renderSchema(root, project, opts = {}) {
  const L = computeLayout(project);
  const { pos, routes, px, py, W, H } = L;
  const info = project.info;

  root.innerHTML = '';
  root.setAttribute('viewBox', opts.viewBox || `0 0 ${W} ${H}`);

  // ---- mise en page : cadre A4 + cartouche (aperçu) ----
  if (opts.printPreview) drawPrintPreview(root, project, opts);

  // ---- le dessin entier, déplaçable et redimensionnable comme un seul objet ----
  const lay = project.layout || { x: 0, y: 0, scale: 0.6 };
  const svg = el('g', { id: 'drawing', transform: `translate(${lay.x},${lay.y}) scale(${lay.scale})` }, root);

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
    if (node.symbolType === 'node_parallel') { drawNodeParallel(node, L, svg, c, sel, px, py); continue; }
    const def = defOf(node);
    const { g, rot } = symbolGroup(svg, def, symbolHref(node), cx, cy, sel, { 'data-el': node.id }, node.orient || 0);
    placeLabel(rot, node, def);
  }

  // ---- insertion de node au milieu de chaque conducteur ----
  //      Dernière couche : toujours cliquable, même au-dessus du symbole du compteur.
  const drawMid = (pid, dir) => {
    if (opts.printPreview) return;
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
  const anchorsShown = (node) => !opts.printPreview && ((opts.selectedIds ? opts.selectedIds.has(node.id) : node.id === opts.selectedId) || !!opts.showAnchors);
  const drawAnchors = (node) => {
    if (!anchorsShown(node)) return;
    const hasChild = node.children && Object.values(node.children).some((v) => v != null);
    // node et compteur restent ramifiables : leurs points d'ancrage libres restent visibles
    const ramifiable = node.symbolType === 'node' || node.symbolType === 'tableau' || node.symbolType === 'node_parallel';
    if (hasChild && !ramifiable) return;
    if (opts.accepts && !opts.accepts(node)) return;
    const c = pos.get(node.id);
    if (!c) return;
    const half = halfOf(project, node.id);
    // le compteur n'a qu'un seul point d'ancrage : a droite
    const dirs = node.symbolType === 'compteur' ? ['right'] : anchorKeysOf(node);
    for (const dir of dirs) {
      if ((node.children || {})[dir] != null) continue;
      if (isBarType(node.symbolType)) {
        let anchorSide;
        if (node.symbolType === 'node_parallel') {
          anchorSide = cardOf(barAxis(node));
        } else {
          anchorSide = anchorDir(node, dir);
        }
        const [dx, dy] = DIR[anchorSide];
        const colIndex = L.col(node, dir);
        const u = barAxis(node);
        const step = { x: u.x * colIndex * (BAR_PITCH / CW), y: u.y * colIndex * (BAR_PITCH / CH) };
        const ax = px(c.x + step.x) + dx * 18;
        const ay = py(c.y + step.y) + dy * 18;
        plusMark(svg, ax, ay, 'ui-only anchor', { 'data-anchor': `${node.id}:${dir}` });
        continue;
      }
      const [dx, dy] = DIR[dir];
      // juste au-delà du bord du symbole, d'après sa taille réelle (compteur 44×32 -> +50/+38).
      // Aucun plancher : un petit élément (carrefour 5×5) garde ses « + » contre lui.
      const ox = half.w + 6;
      const oy = half.h + 6;
      plusMark(svg, px(c.x) + dx * ox, py(c.y) + dy * oy, 'ui-only anchor', { 'data-anchor': `${node.id}:${dir}` });
    }
  };

  for (const dir of Object.keys(project.supply.children || {})) if (project.supply.children[dir] != null) drawMid(project.supply.id, dir);
  for (const node of elements) {
    for (const dir of Object.keys(node.children || {})) if (node.children[dir] != null) drawMid(node.id, dir);
  }
  if (anchorsShown(project.supply)) drawAnchors(project.supply);
  for (const node of elements) if (anchorsShown(node)) drawAnchors(node);
  // zone de déplacement du dessin entier (en mise en page seulement, hors impression)
  const bb = svg.getBBox();
  svg.insertBefore(el('rect', { class: 'move-hit ui-only', x: bb.x - 10, y: bb.y - 10, width: bb.width + 20, height: bb.height + 20, 'data-move': '1' }), svg.firstChild);
  // (la zone de déplacement reste sous les éléments ; les éléments ne captent rien en mise en page)
  // (pied de page / cartouche : hors canvas, voir le PDF)
}
