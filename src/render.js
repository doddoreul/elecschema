// Rendu SVG du schéma unifilaire, calque sur la mise en page de reference :
//   - un circuit par colonne, numeroote en haut
//   - protection en tete de colonne
//   - rail vertical, symboles poses perpendiculairement (rotation -90 deg)
//   - bus horizontal en bas, avec lettre de groupe
//   - cartouche a colonnes en pied de feuille

import { symbolOf } from './symbols.js';
import { CIRCUIT_TYPES, DEFAULT_ICB } from './standards.js';

const NS = 'http://www.w3.org/2000/svg';

const SHEET_W = 2100;
const SHEET_H = 1160;

const X0 = 210;            // premiere colonne de circuit
const COL_W = 116;
const COL_GAP = 8;
const RAIL_OFF = 16;       // rail depuis le bord gauche de la colonne
const BRANCH_GAP = 16;     // rail -> centre du symbole

const Y_NUM = 152;         // boite du numero de circuit
const NUM_H = 30;
const Y_PROT = 198;        // bloc protection
const PROT_H = 64;
const Y_RAIL_TOP = 276;    // haut du rail
const STEP = 62;           // ecart entre deux branches
const MIN_H = 900;
const MIN_W = 900;
const BUS_GAP = 90;        // ecart entre le dernier symbole et le bus
const CART_H = 222;        // hauteur du cartouche

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function txt(parent, x, y, content, cls = 'lbl', anchor = 'middle') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, parent);
  t.textContent = content;
  return t;
}

function phaseTicks(parent, cx, y, phases) {
  if (phases <= 1) return;
  let s = '<g stroke="#111827" stroke-width="1.4">';
  for (let i = 0; i < phases; i++) {
    const ox = (i - (phases - 1) / 2) * 7;
    s += `<line x1="${cx + ox - 5}" y1="${y + 5}" x2="${cx + ox + 5}" y2="${y - 5}"/>`;
  }
  s += '</g>';
  parent.insertAdjacentHTML('beforeend', s);
}

function phaseMarker(parent, x, y, phases) {
  const g = el('g', {}, parent);
  el('line', { x1: x - 7, y1: y + 7, x2: x + 7, y2: y - 7, class: 'wire' }, g);
  if (phases > 1) txt(g, x + 14, y + 4, phases + '~', 'lbl-sm', 'start');
}

/** Lettre de groupe A, B, C... a partir de l'index. */
function groupLetter(index) {
  return String.fromCharCode(65 + (index % 26));
}

/**
 * Dessine un symbole ROTATE DE -90 DEG : les ports haut/bas du symbole
 * deviennent gauche/droite, ce qui correspond a une branche horizontale.
 */
export function drawSymbol(parent, comp, cx, cy, selected) {
  const def = symbolOf(comp.symbolType);
  const outer = el('g', {
    transform: `translate(${cx},${cy})`,
    class: 'sym-wrap' + (selected ? ' selected' : ''),
    'data-comp': comp.id,
  }, parent);

  // zone cliquable = boite englobante apres rotation
  el('rect', {
    class: 'outline', x: -def.h / 2 - 5, y: -def.w / 2 - 5,
    width: def.h + 10, height: def.w + 10, fill: 'none', stroke: 'transparent',
  }, outer);

  const inner = el('g', { transform: 'rotate(-90)' }, outer);
  const g = el('g', { transform: `translate(${-def.w / 2},${-def.h / 2})` }, inner);
  g.insertAdjacentHTML('beforeend', def.shape);
  if (comp.phases > 1) phaseTicks(g, def.w / 2, def.h + 24, comp.phases);
  return outer;
}

/** Texte de protection affiche sous un symbole de protection. */
function protectionText(comp) {
  const p = comp.params || {};
  if (p.diff != null && p.diff !== '') return `Δ ${p.diff} mA`;
  if (p.rating != null && p.rating !== '') return `${p.rating} A` + (p.icb ? ` / ${p.icb}` : '');
  return '';
}

/** Repartition des circuits par phase. */
export function phaseBalance(project) {
  const counts = { L1: 0, L2: 0, L3: 0 };
  for (const c of project.circuits || []) counts[c.phase || 'L1'] += 1;
  return counts;
}

/** Dimensions de la feuille et position du bus, calculees d'apres le contenu reel. */
export function sheetSize(project) {
  const circuits = project.circuits || [];
  const w = Math.max(MIN_W, X0 + circuits.length * (COL_W + COL_GAP) + 40);
  const maxComps = circuits.reduce((m, c) => Math.max(m, (c.components || []).length), 0);
  const railBottom = Y_RAIL_TOP + Math.max(maxComps - 1, 0) * STEP;
  const bus = railBottom + BUS_GAP;
  const h = Math.max(MIN_H, bus + 150 + CART_H);
  return { w, h, bus };
}

export function renderSchema(svg, project, opts = {}) {
  const size = sheetSize(project);
  const SHEET_W = size.w;
  const SHEET_H = size.h;
  const Y_BUS = size.bus;

  svg.innerHTML = '';
  svg.setAttribute('width', SHEET_W);
  svg.setAttribute('height', SHEET_H);
  svg.setAttribute('viewBox', opts.viewBox || `0 0 ${SHEET_W} ${SHEET_H}`);

  const circuits = project.circuits || [];
  const tri = project.info.projet.typeAlim === 'TRI';
  const info = project.info;

  const emptyEl = document.getElementById('empty-state');
  if (emptyEl) emptyEl.hidden = circuits.length > 0;

  // ---- cadre ----
  el('rect', { x: 8, y: 8, width: SHEET_W - 16, height: SHEET_H - 16, fill: 'none', stroke: '#d1d5db' }, svg);
  el('rect', { x: 16, y: 16, width: SHEET_W - 32, height: SHEET_H - 32, fill: 'none', stroke: '#111827', 'stroke-width': 1.5 }, svg);

  // ---- titre ----
  txt(svg, 30, 48, 'SCHÉMA UNIFILAIRE — INSTALLATION DOMESTIQUE', 'lbl', 'start');
  txt(svg, 30, 66, `${info.chantier.denomination || 'Sans titre'} · ${info.chantier.adresse || ''} ${info.chantier.codePostal || ''} ${info.chantier.localite || ''}`.trim(),
    'lbl-sm', 'start');

  // ---- element d'arrivee (gauche) ----
  const supply = project.supply || {};
  const selSup = opts.selectedSupply === true;
  const sg = el('g', { class: 'sym-wrap', 'data-supply': '1' }, svg);
  if (selSup) el('rect', { x: 44, y: 84, width: 116, height: 60, fill: 'none', stroke: '#2563eb', 'stroke-width': 1.6, 'stroke-dasharray': '4 3', rx: 5 }, sg);
  el('rect', { x: 50, y: 90, width: 104, height: 48, fill: '#fff', stroke: '#111827', 'stroke-width': 1.5 }, sg);
  txt(sg, 102, 108, supply.label || 'W1', 'lbl-sm');
  txt(sg, 102, 126, tri ? '230/400 V ~' : '230 V ~', 'lbl-sm');

  // ---- liaison arrivee -> bus du bas (colonne d'alimentation) ----
  const supplyX = 102;
  el('line', { x1: supplyX, y1: 138, x2: supplyX, y2: Y_BUS, class: 'bus' }, svg);
  txt(svg, 128, 300, supply.detail || 'Compteur kWh', 'lbl-sm', 'start');

  // ---- bus horizontal : trace apres les fonds de colonne pour rester visible ----
  const busEnd = circuits.length
    ? X0 + circuits.length * (COL_W + COL_GAP) - COL_GAP
    : supplyX;

  // ---- circuits ----
  circuits.forEach((circ, i) => {
    const x = X0 + i * (COL_W + COL_GAP);
    const railX = x + RAIL_OFF;
    const n = (circ.components || []).length;
    const railBottom = Y_RAIL_TOP + Math.max(n - 1, 0) * STEP;
    const isCircuitSelected = opts.selectedCircuitId === circ.id;
    const letter = groupLetter(i);

    // fond de colonne = zone de depot + cible de clic
    const col = el('g', { class: 'circuit-col', 'data-circuit': circ.id }, svg);
    const colTop = Y_NUM - 4;
    const colH = Math.max(Y_BUS - colTop, 120);
    el('rect', {
      class: 'bg', x, y: colTop, width: COL_W, height: colH,
      fill: isCircuitSelected ? '#dbeafe' : '#fafafa',
      stroke: isCircuitSelected ? '#2563eb' : '#e5e7eb',
      'stroke-width': isCircuitSelected ? 1.6 : 1, rx: 6,
    }, col);

    // numero de circuit (en-tete cliquable)
    const head = el('g', { class: 'circuit-head', 'data-circuit': circ.id, style: 'cursor:pointer' }, svg);
    el('line', { x1: railX, y1: Y_NUM + NUM_H, x2: railX, y2: Y_RAIL_TOP, class: 'wire' }, head);
    el('rect', {
      x: x + COL_W / 2 - 16, y: Y_NUM, width: 32, height: NUM_H,
      fill: '#fff', stroke: '#111827', 'stroke-width': 1.4, rx: 3,
    }, head);
    txt(head, x + COL_W / 2, Y_NUM + 21, String(i + 1), 'lbl');

    // bloc protection en tete de colonne : symbole sur le rail, texte centre dessous
    const prot = (circ.components || []).find((c) => ['breaker', 'rcd', 'fuse'].includes(c.symbolType));
    if (prot) {
      const cy = Y_PROT + 16;
      const pcx = railX + BRANCH_GAP + 20;
      drawSymbol(head, prot, pcx, cy, false);
      const l1 = [];
      if (prot.params?.rating != null) l1.push(`${prot.params.rating} A`);
      if (prot.params?.curve) l1.push(prot.params.curve);
      if (prot.params?.diff != null) l1.push(`Δ${prot.params.diff}`);
      if (l1.length) txt(head, pcx, Y_PROT + 48, l1.join(' '), 'lbl-sm');
      if (prot.params?.icb) txt(head, pcx, Y_PROT + 61, `${prot.params.icb} A`, 'lbl-sm');
    } else {
      txt(head, railX + 36, Y_PROT + 24, 'protection', 'lbl-sm', 'start');
    }

    // lettre de groupe sur le bus
    txt(svg, x + COL_W / 2, Y_BUS + 18, letter, 'lbl');
    el('line', { x1: railX, y1: railBottom, x2: railX, y2: Y_BUS, class: 'bus' }, svg);

    // symboles en branches horizontales
    (circ.components || []).forEach((comp, j) => {
      const def = symbolOf(comp.symbolType);
      const y = Y_RAIL_TOP + j * STEP;
      const cx = railX + BRANCH_GAP + def.h / 2;

      el('line', { x1: railX, y1: y, x2: cx - def.h / 2, y2: y, class: 'wire' }, svg);
      if (comp.phases > 1) phaseTicks(svg, railX + 11, y - 9, comp.phases);

      const g = drawSymbol(svg, comp, cx, y, opts.selectedComponentId === comp.id);
      txt(g, def.h / 2 + 8, 4, comp.label, 'lbl-sm', 'start');
      if (comp.detail) txt(g, def.h / 2 + 8, def.w / 2 + 4, comp.detail, 'lbl-sm', 'start');
    });

    // type de circuit sous la lettre de groupe
    const typeName = (CIRCUIT_TYPES[circ.typeKey] || {}).name;
    if (typeName) txt(svg, x + COL_W / 2, Y_BUS + 34, typeName, 'lbl-sm');
  });

  // ---- bus horizontal, trace en dernier pour rester au-dessus des fonds ----
  el('line', { x1: supplyX, y1: Y_BUS, x2: Math.max(busEnd, supplyX + 40), y2: Y_BUS, class: 'bus' }, svg);

  // ---- cartouche a colonnes ----
  drawTitleBlock(svg, info, SHEET_H);
}

/** Boite englobante du symbole de protection dans son bloc (toujours 40x40 ici). */
function prot0() { return 20; }

function drawTitleBlock(svg, info, sheetH) {
  const top = sheetH - CART_H + 30;
  const h = CART_H - 42;
  const left = 30;
  const right = SHEET_W - 30;
  const cols = [
    {
      head: "L'installateur",
      rows: [
        ["Nom", info.installateur.societe || ''],
        ["TVA", info.installateur.numeroTVA || ''],
        ["Adresse", info.installateur.adresse || ''],
        ["Signature", ''],
      ],
    },
    {
      head: 'Le propriétaire / occupant',
      rows: [
        ["Nom", `${info.occupant.nom || ''} ${info.occupant.prenom || ''}`.trim()],
        ["Adresse", info.chantier.adresse || ''],
        ["Téléphone", info.occupant.telephone || ''],
        ["Signature", ''],
      ],
    },
    {
      head: "L'organisme de contrôle",
      rows: [
        ["Organisme", info.controle.organisme || ''],
        ["Contact", info.controle.contact || ''],
        ["Date", info.controle.datePrevue || ''],
        ["Signature", ''],
      ],
    },
    {
      head: 'Conducteurs nus',
      rows: [
        ["Section arrivée", '—'],
        ["Section terre", '—'],
        ["Longueur", '—'],
        ["Signature", ''],
      ],
    },
  ];

  const w = right - left;
  const cw = w / cols.length;

  el('rect', { x: left, y: top, width: w, height: h, fill: '#fff', stroke: '#111827', 'stroke-width': 1.5 }, svg);
  el('line', { x1: left, y1: top + 26, x2: right, y2: top + 26, stroke: '#111827' }, svg);
  for (let i = 1; i < cols.length; i++) {
    el('line', { x1: left + i * cw, y1: top, x2: left + i * cw, y2: top + h, stroke: '#111827' }, svg);
  }
  // lignes de lignes
  for (let r = 1; r < cols[0].rows.length; r++) {
    const y = top + 26 + r * ((h - 26) / cols[0].rows.length);
    el('line', { x1: left, y1: y, x2: right, y2: y, stroke: '#9ca3af', 'stroke-width': 0.6 }, svg);
  }

  cols.forEach((col, i) => {
    const cx = left + i * cw;
    el('rect', { x: cx, y: top, width: cw, height: 26, fill: '#1e3a5f' }, svg);
    txt(svg, cx + cw / 2, top + 18, col.head, 'lbl-head', 'middle');
    col.rows.forEach((row, r) => {
      const ry = top + 26 + r * ((h - 26) / col.rows.length);
      txt(svg, cx + 8, ry + 14, row[0], 'lbl-sm', 'start');
      txt(svg, cx + 8, ry + 30, row[1] || '', 'lbl-sm', 'start');
    });
  });
}

export { SHEET_W, SHEET_H };
