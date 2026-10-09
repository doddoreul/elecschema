// Rendu SVG du schéma unifilaire.
// Mise en page automatique : élément d'arrivée + bus en haut, puis un circuit
// par colonne. À l'intérieur d'un circuit : UN rail vertical, et chaque symbole
// posé perpendiculairement à ce rail (branche horizontale).

import { symbolOf } from './symbols.js';
import { CIRCUIT_TYPES } from './standards.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SHEET_W = 1600;
const SHEET_H = 1000;

const COL_W = 210;          // largeur d'une colonne de circuit
const COL_GAP = 16;
const RAIL_OFF = 34;        // décalage du rail dans la colonne
const X0 = 90;              // marge à gauche
const Y_SUPPLY = 150;       // centre de l'élément d'arrivée
const Y_BUS = 240;         // bus / rails de phase
const Y_RAIL_TOP = 300;     // haut du premier rail de circuit
const STEP = 74;            // écart entre deux branches
const SYM_OFF = 34;         // distance rail -> symbole

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

/** Marqueur de phases (traits obliques) au-dessus d'un raccordement. */
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

/** Dessine un symbole dans un <g>translate> déjà positionné. */
export function drawSymbol(g, symbolType, phases) {
  const def = symbolOf(symbolType);
  el('rect', { x: -4, y: -4, width: def.w + 8, height: def.h + 8, fill: 'transparent' }, g);
  g.insertAdjacentHTML('beforeend', def.shape);
  if (phases > 1) phaseTicks(g, def.w / 2, def.h + 22, phases);
  return g;
}

/** Texte d'un différentiel / calibre, affiché sous le symbole. */
function protectionText(comp) {
  const p = comp.params || {};
  if (p.diff != null && p.diff !== '') return `Δ ${p.diff} mA` + (p.rating ? ` · ${p.rating} A` : '');
  if (p.rating != null && p.rating !== '') return `${p.rating} A` + (p.icb ? ` · ${p.icb} A Icn` : '');
  return '';
}

/** Répartition des circuits par phase. Utilisé par le contrôle d'équilibrage. */
export function phaseBalance(project) {
  const counts = { L1: 0, L2: 0, L3: 0 };
  for (const c of project.circuits || []) counts[c.phase || 'L1'] += 1;
  return counts;
}

export function renderSchema(svg, project, opts = {}) {
  svg.innerHTML = '';
  svg.setAttribute('width', SHEET_W);
  svg.setAttribute('height', SHEET_H);
  svg.setAttribute('viewBox', opts.viewBox || `0 0 ${SHEET_W} ${SHEET_H}`);

  const circuits = project.circuits || [];
  const tri = project.info.projet.typeAlim === 'TRI';
  const phases = tri ? 3 : 1;

  const emptyEl = document.getElementById('empty-state');
  if (emptyEl) emptyEl.hidden = circuits.length > 0;

  // ---- cadre feuille ----
  el('rect', { x: 8, y: 8, width: SHEET_W - 16, height: SHEET_H - 16, fill: 'none', stroke: '#d1d5db' }, svg);
  el('rect', { x: 16, y: 16, width: SHEET_W - 32, height: SHEET_H - 32, fill: 'none', stroke: '#111827', 'stroke-width': 1.5 }, svg);

  // ---- cartouche ----
  const c = project.info;
  const cg = el('g', {}, svg);
  el('rect', { x: 16, y: SHEET_H - 96, width: SHEET_W - 32, height: 80, fill: '#fff', stroke: '#111827', 'stroke-width': 1.5 }, cg);
  el('line', { x1: 16, y1: SHEET_H - 62, x2: SHEET_W - 16, y2: SHEET_H - 62, stroke: '#111827' }, cg);
  el('line', { x1: SHEET_W - 320, y1: SHEET_H - 96, x2: SHEET_W - 320, y2: SHEET_H - 16, stroke: '#111827' }, cg);
  txt(cg, 26, SHEET_H - 82, 'Installation : ' + (c.chantier.denomination || '—'), 'lbl-sm', 'start');
  txt(cg, 26, SHEET_H - 70, (c.chantier.adresse ? c.chantier.adresse + ', ' : '') + (c.chantier.codePostal || '') + ' ' + (c.chantier.localite || ''), 'lbl-sm', 'start');
  txt(cg, SHEET_W - 310, SHEET_H - 82, 'Installateur : ' + (c.installateur.societe || '—'), 'lbl-sm', 'start');
  txt(cg, SHEET_W - 310, SHEET_H - 70, 'Dessinateur : ' + (c.dessinateur.nom || '—'), 'lbl-sm', 'start');
  txt(cg, SHEET_W - 310, SHEET_H - 54, 'Domaine : ' + c.projet.domaine + ' · ' + (tri ? 'Triphasé' : 'Monophasé'), 'lbl-sm', 'start');
  txt(cg, 26, SHEET_H - 48, 'Date : ' + (c.chantier.dateTravaux || c.projet.dateModification), 'lbl-sm', 'start');
  txt(cg, 26, SHEET_H - 36, 'Version : ' + c.projet.version + ' · RGIE/AREI', 'lbl-sm', 'start');
  txt(cg, SHEET_W - 310, SHEET_H - 42, 'Feuille 1 — Schéma unifilaire', 'lbl-sm', 'start');
  txt(cg, SHEET_W - 60, SHEET_H - 42, c.projet.dateModification, 'lbl-sm', 'end');

  // ---- titre ----
  txt(svg, 26, 40, 'SCHÉMA UNIFILAIRE — INSTALLATION DOMESTIQUE', 'lbl', 'start');
  txt(svg, 26, 56, (c.chantier.localite || c.chantier.denomination || 'Nouveau projet'), 'lbl-sm', 'start');

  // ---- élément d'arrivée (compteur), cliquable et éditable ----
  const supply = project.supply || {};
  const sg = el('g', { class: 'sym-wrap', 'data-supply': '1' }, svg);
  const sw = tri ? 150 : 110;
  const supplyX = X0;
  const isSelSupply = opts.selectedSupply === true;
  if (isSelSupply) el('rect', { x: supplyX - 6, y: Y_SUPPLY - 34, width: sw + 12, height: 62, fill: 'none', stroke: '#2563eb', 'stroke-width': 1.6, 'stroke-dasharray': '4 3', rx: 5 }, sg);
  el('rect', { x: supplyX, y: Y_SUPPLY - 28, width: sw, height: 52, fill: '#fff', stroke: '#111827', 'stroke-width': 1.5 }, sg);
  txt(sg, supplyX + sw / 2, Y_SUPPLY - 12, supply.label || 'W1', 'lbl-sm');
  txt(sg, supplyX + sw / 2, Y_SUPPLY + 4, tri ? '3N~ 400/230 V' : '1N~ 230 V', 'lbl-sm');
  const supDetail = supply.detail ? supply.detail : 'Compteur kWh';
  txt(sg, supplyX + sw / 2, Y_SUPPLY + 20, supDetail, 'lbl-sm');

  // ---- liaison arrivée -> bus ----
  el('line', { x1: supplyX + sw / 2, y1: Y_SUPPLY + 24, x2: supplyX + sw / 2, y2: Y_BUS, class: 'bus' }, svg);
  if (tri) phaseMarker(svg, supplyX + sw / 2 + 22, Y_SUPPLY + 34, 3);

  // ---- bus : un rail par phase en triphasé ----
  const busEnd = circuits.length ? X0 + circuits.length * (COL_W + COL_GAP) : SHEET_W - 60;
  if (tri) {
    const lanes = { L1: Y_BUS - 14, L2: Y_BUS, L3: Y_BUS + 14 };
    for (const [lbl, y] of Object.entries(lanes)) {
      el('line', { x1: supplyX + sw / 2, y1: y, x2: busEnd, y2: y, class: 'bus' }, svg);
      txt(svg, busEnd + 16, y + 4, lbl, 'lbl-sm', 'start');
    }
  } else {
    el('line', { x1: supplyX + sw / 2, y1: Y_BUS, x2: busEnd, y2: Y_BUS, class: 'bus' }, svg);
  }

  // ---- circuits ----
  circuits.forEach((circ, i) => {
    const x = X0 + i * (COL_W + COL_GAP);
    const railX = x + RAIL_OFF;
    const cx = x + COL_W / 2;
    const n = (circ.components || []).length;
    const railBottom = Y_RAIL_TOP + Math.max(n - 1, 0) * STEP;

    // fond de colonne = zone de dépôt
    const col = el('g', { class: 'circuit-col', 'data-circuit': circ.id }, svg);
    const colH = Math.max(railBottom - Y_BUS + 40, 90);
    el('rect', { class: 'bg', x, y: Y_BUS - 6, width: COL_W, height: colH, fill: '#fafafa', stroke: '#e5e7eb', rx: 6 }, col);

    // en-tête de circuit
    el('rect', { x, y: Y_BUS + 4, width: COL_W, height: 34, fill: '#fff', stroke: '#111827', 'stroke-width': 1.2, rx: 4 }, svg);
    txt(svg, cx, Y_BUS + 18, circ.name, 'lbl');
    const typeName = (CIRCUIT_TYPES[circ.typeKey] || {}).name || '';
    if (typeName) txt(svg, cx, Y_BUS + 30, typeName + (circ.phases > 1 ? ' · 3~' : ''), 'lbl-sm');

    //rail vertical du circuit
    const laneY = tri
      ? { L1: Y_BUS - 14, L2: Y_BUS, L3: Y_BUS + 14 }[circ.phase || 'L1']
      : Y_BUS;
    el('line', { x1: railX, y1: laneY, x2: railX, y2: railBottom, class: 'bus' }, svg);
    if (tri) txt(svg, railX - 10, laneY + 12, circ.phase || 'L1', 'lbl-sm', 'end');

    // composants, posés perpendiculairement au rail
    (circ.components || []).forEach((comp, j) => {
      const def = symbolOf(comp.symbolType);
      const y = Y_RAIL_TOP + j * STEP;
      const cy = y + def.h / 2;
      const compX = railX + SYM_OFF;

      // branche horizontale depuis le rail
      el('line', { x1: railX, y1: cy, x2: compX, y2: cy, class: 'wire' }, svg);
      if (comp.phases > 1) phaseTicks(svg, railX + 12, cy - 8, comp.phases);

      const g = el('g', {
        transform: `translate(${compX},${y})`,
        class: 'sym-wrap' + (opts.selectedComponentId === comp.id ? ' selected' : ''),
        'data-comp': comp.id,
      }, svg);
      el('rect', { class: 'outline', x: -5, y: -5, width: def.w + 10, height: def.h + 10, fill: 'none', stroke: 'transparent' }, g);
      drawSymbol(g, comp.symbolType, comp.phases);

      txt(svg, compX + def.w + 8, y + 4, comp.label, 'lbl-sm', 'start');
      const extra = [comp.detail, protectionText(comp)].filter(Boolean).join(' · ');
      if (extra) txt(svg, compX + def.w + 8, y + def.h + 4, extra, 'lbl-sm', 'start');
    });
  });
}

export { SHEET_W, SHEET_H };
