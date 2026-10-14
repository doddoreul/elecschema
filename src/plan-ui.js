// Interactions de l'onglet « Schéma d'implantation » (DOM). La logique de données
// est dans plan-model.js ; le rendu dans plan-render.js. Ce module n'importe rien
// de l'état interne de ui.js : tout passe par `initPlan(deps)`.
import {
  levelById, addLevel, removeLevel, renameLevel, moveLevel, hasPlanContent, levelBounds,
  effectiveScale, fitScale, fitBounds, frameOverflow, nextPlanId, addWall, removeWall, wallLength, cmToPaperMm,
  snap, orthoTarget, placeElement, unplaceElement, findPlacement, unplacedElements,
  symbolSideCm, addOpening, addRoom, removeOpening, removeRoom, nearestWall,
  planFrame, PLAN_DEFAULT_SCALE, PLAN_MIN_SCALE, PLAN_MAX_SCALE,
} from './plan-model.js';
import { PLAN_SCALES } from './standards.js';
import { symbolName, symbolOf } from './symbols.js';
import { nodeById, circuitStartOf } from './model.js';
import { prepareImage, assetSet } from './plan-assets.js';
import { renderPlanLevel, el, planLabel } from './plan-render.js';

const $ = (sel) => document.querySelector(sel);
const DEFAULT_VIEW = { x: -200, y: -200, w: 1600, h: 1000 };
const MIN_VIEW_CM = 50, MAX_VIEW_CM = 200000;
const MIN_WALL_CM = 1;
const BG_ZOOM_STEP = 1.05;   // pas d'agrandissement du fond par clic (+/- 5 %)
const PLAN_ZOOM_STEP = 1.25; // pas de zoom de la vue par clic sur − / +
const FRAME_KEY = 'elexio.planFrame';   // préférence « afficher le cadre A4 » (mémorisée)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let deps = null;
const ui = {
  levelId: null,
  view: { ...DEFAULT_VIEW },
  tool: 'select',       // 'select' | 'wall' | 'calib'
  calibPts: [],
  spaceDown: false,
  drag: null,           // glissement en cours : pan | bg | end | wall | place | pick
  draft: null,          // point de départ d'un mur en cours de tracé
  cursor: null,         // point visé (aperçu du mur en cours)
  selWall: null,        // id du mur sélectionné
  selPlace: null,       // elementId du symbole sélectionné sur le plan
  selOpening: null,     // id de l'ouverture (porte/fenêtre) sélectionnée
  selRoom: null,        // id du libellé de pièce sélectionné
  placeArmed: null,     // elementId armé depuis la liste « Non placés »
  hideElements: false,  // masquer tous les éléments (ne garder que l'arrière-plan)
  elementOpacity: 1,    // opacité des éléments du plan (murs, ouvertures, pièces, symboles)
  n: 100,               // échelle effective courante (pour la taille des symboles)
  showFrame: true,      // afficher le cadre A4 (feuille, zones, cartouche) à l'écran
  lock: false,          // verrouiller la mise en page : échelle et déplacement du cadre A4
};

function plan() { return deps.getProject().plan; }

function currentLevel() {
  const p = plan();
  let lv = levelById(p, ui.levelId);
  if (!lv) { lv = p.levels[0]; ui.levelId = lv.id; }
  return lv;
}

function selectedWall(lv) {
  return ui.selWall == null ? null : lv.walls.find((w) => w.id === ui.selWall) || null;
}

/** Texte (libellé libre) sélectionné dans le niveau courant. */
function selectedRoom() {
  return ui.selRoom != null ? currentLevel().rooms.find((x) => x.id === ui.selRoom) || null : null;
}

/** État visuel + accessible d'un bouton de mise en forme de texte. */
function setFmtButton(sel, on) {
  const b = $(sel);
  if (!b) return;
  b.classList.toggle('active', !!on);
  b.setAttribute('aria-pressed', String(!!on));
}

function project() { return deps.getProject(); }

function nodeOf(elementId) {
  const p = project();
  return elementId === p.supply.id ? p.supply : nodeById(p, elementId);
}

const svgEl = () => $('#plan-canvas');

/* ---------------------------------------------------------------- initialisation */

export function initPlan(d) {
  deps = d;
  const svg = svgEl();

  $('#plan-levels').addEventListener('click', (e) => {
    const b = e.target.closest('.plan-level');
    if (b) selectLevel(b.dataset.level);
  });
  $('#plan-levels').addEventListener('dblclick', (e) => {
    const b = e.target.closest('.plan-level');
    if (b) renameFlow(b.dataset.level);
  });
  $('#plan-level-add').addEventListener('click', addLevelFlow);
  $('#plan-level-rename').addEventListener('click', () => renameFlow(ui.levelId));
  $('#plan-level-up').addEventListener('click', () => moveFlow(-1));
  $('#plan-level-down').addEventListener('click', () => moveFlow(1));
  $('#plan-level-del').addEventListener('click', removeFlow);

  const scaleInput = $('#plan-scale-input');
  const dl = $('#plan-scale-list');
  if (dl) dl.innerHTML = PLAN_SCALES.map((n) => `<option value="${n}"></option>`).join('');
  scaleInput.addEventListener('change', () => setScale(Number(scaleInput.value)));
  $('#plan-scale-dec').addEventListener('click', () => stepScale(false));
  $('#plan-scale-inc').addEventListener('click', () => stepScale(true));
  scaleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); setScale(Number(scaleInput.value)); }
  });

  const frameShow = $('#plan-frame-show');
  frameShow.checked = loadShowFrame();
  ui.showFrame = frameShow.checked;
  frameShow.addEventListener('change', (e) => {
    ui.showFrame = e.target.checked;
    try { localStorage.setItem(FRAME_KEY, ui.showFrame ? '1' : '0'); } catch (err) { /* ignore */ }
    refreshPlan();
  });
  $('#plan-frame-center').addEventListener('click', () => { centerViewOnFrame(currentLevel()); refreshPlan(); });
  $('#plan-fit-drawing').addEventListener('click', fitDrawing);

  const frameLock = $('#plan-frame-lock');
  frameLock.addEventListener('change', (e) => { ui.lock = e.target.checked; applyLayoutLock(); refreshPlan(); });
  applyLayoutLock();

  $('#plan-tool-select').addEventListener('click', () => setTool('select'));
  $('#plan-tool-wall').addEventListener('click', () => setTool(ui.tool === 'wall' ? 'select' : 'wall'));
  $('#plan-tool-door').addEventListener('click', () => setTool(ui.tool === 'door' ? 'select' : 'door'));
  $('#plan-tool-window').addEventListener('click', () => setTool(ui.tool === 'window' ? 'select' : 'window'));
  $('#plan-tool-room').addEventListener('click', () => setTool(ui.tool === 'room' ? 'select' : 'room'));
  $('#plan-toggle-elements').addEventListener('click', toggleElements);
  $('#plan-recenter').addEventListener('click', () => { fitViewToSheet(currentLevel()); refreshPlan(); });
  $('#plan-zoom-in').addEventListener('click', () => zoomCenter(1 / PLAN_ZOOM_STEP));
  $('#plan-zoom-out').addEventListener('click', () => zoomCenter(PLAN_ZOOM_STEP));

  $('#plan-bg-import').addEventListener('click', importBg);
  $('#plan-bg-calib').addEventListener('click', () => setTool(ui.tool === 'calib' ? 'select' : 'calib'));
  $('#plan-bg-opacity').addEventListener('input', (e) => {
    const bg = currentLevel().bg; if (!bg) return;
    bg.opacity = Number(e.target.value) / 100; refreshPlan();
  });
  $('#plan-bg-opacity').addEventListener('change', () => deps.markDirty());
  // Opacité des éléments (vue seule, non enregistrée) : mise à jour directe du groupe.
  $('#plan-elements-opacity').addEventListener('input', (e) => {
    ui.elementOpacity = Number(e.target.value) / 100;
    const g = svgEl().querySelector('.plan-elements');
    if (g) g.setAttribute('opacity', String(ui.elementOpacity));
  });
  $('#plan-bg-visible').addEventListener('change', (e) => setBg({ visible: e.target.checked }));
  $('#plan-bg-lock').addEventListener('change', (e) => setBg({ locked: e.target.checked }));
  $('#plan-bg-smaller').addEventListener('click', () => scaleBg(1 / BG_ZOOM_STEP));
  $('#plan-bg-bigger').addEventListener('click', () => scaleBg(BG_ZOOM_STEP));
  $('#plan-bg-del').addEventListener('click', removeBg);

  $('#plan-wall-t').addEventListener('change', (e) => {
    const w = selectedWall(currentLevel()); if (!w) return;
    const t = Number(e.target.value);
    if (t >= MIN_WALL_CM) { w.t = t; deps.markDirty(); }
    refreshPlan();
  });
  $('#plan-wall-del').addEventListener('click', deleteSelectedWall);

  $('#plan-opening-w').addEventListener('change', (e) => {
    const o = currentLevel().openings.find((x) => x.id === ui.selOpening);
    const w = Number(e.target.value);
    if (o && w >= 1) { o.w = w; deps.markDirty(); }
    refreshPlan();
  });
  $('#plan-opening-del').addEventListener('click', deleteSelectedOpening);

  // Porte : miroir horizontal (le long du mur) et vertical (de l'autre côté du mur).
  $('#plan-opening-hinge').addEventListener('click', () => {
    const o = currentLevel().openings.find((x) => x.id === ui.selOpening);
    if (!o || o.kind !== 'door') return;
    o.hinge = (o.hinge === 1 ? -1 : 1);
    deps.markDirty(); refreshPlan();
  });
  $('#plan-opening-swing').addEventListener('click', () => {
    const o = currentLevel().openings.find((x) => x.id === ui.selOpening);
    if (!o || o.kind !== 'door') return;
    o.open = (o.open === -1 ? 1 : -1);
    deps.markDirty(); refreshPlan();
  });

  $('#plan-room-name').addEventListener('change', (e) => {
    const r = currentLevel().rooms.find((x) => x.id === ui.selRoom);
    if (r) { r.name = e.target.value; deps.markDirty(); }
    refreshPlan();
  });
  $('#plan-room-del').addEventListener('click', deleteSelectedRoom);

  // Barre « Texte » (visible seulement quand un texte est sélectionné) : taille + styles.
  $('#plan-text-size').addEventListener('change', (e) => {
    const r = selectedRoom();
    if (!r) return;
    r.size = Number(e.target.value) || 1;
    deps.markDirty(); refreshPlan();
  });
  for (const [id, key] of [['#plan-text-bold', 'bold'], ['#plan-text-italic', 'italic'], ['#plan-text-underline', 'underline']]) {
    $(id).addEventListener('click', () => {
      const r = selectedRoom();
      if (!r) return;
      r[key] = !r[key];
      deps.markDirty(); refreshPlan();
    });
  }

  $('#plan-place-rot').addEventListener('change', (e) => {
    const found = ui.selPlace != null ? findPlacement(plan(), ui.selPlace) : null;
    if (!found) return;
    const r = Number(e.target.value);
    if (Number.isFinite(r)) { found.placement.rot = ((r % 360) + 360) % 360; deps.markDirty(); }
    refreshPlan();
  });
  $('#plan-place-del').addEventListener('click', removeSelectedPlace);

  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e, e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerUp);
  svg.addEventListener('dblclick', (e) => {
    ui.draft = null;
    const roomEl = e.target.closest?.('[data-room]');
    if (roomEl) { editRoom(roomEl.dataset.room); return; }
    drawOverlay();
  });
  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { ui.spaceDown = false; $('#plan-host').classList.remove('hand'); }
  });
  window.addEventListener('blur', () => { ui.spaceDown = false; $('#plan-host')?.classList.remove('hand'); });
}

function isTyping(t) { return /INPUT|TEXTAREA|SELECT/.test(t.tagName); }

function onKeyDown(e) {
  if (deps.activeTab() !== 'plan' || isTyping(e.target)) return;
  if (e.code === 'Space') { e.preventDefault(); ui.spaceDown = true; $('#plan-host').classList.add('hand'); return; }
  if (e.key === 'Escape') {
    if (ui.tool === 'calib') { setTool('select'); return; }
    if (ui.draft) { ui.draft = null; drawOverlay(); return; }
    if (ui.tool !== 'select') { setTool('select'); return; }
    if (ui.placeArmed != null) { ui.placeArmed = null; refreshPlan(); return; }
    if (ui.selPlace != null || ui.selWall != null || ui.selOpening != null || ui.selRoom != null) {
      ui.selPlace = null; ui.selWall = null; ui.selOpening = null; ui.selRoom = null; refreshPlan();
    }
    return;
  }
  if (e.key === 'Enter' && ui.draft) { ui.draft = null; drawOverlay(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace')) {
    if (ui.selPlace != null) { e.preventDefault(); removeSelectedPlace(); return; }
    if (ui.selWall != null) { e.preventDefault(); deleteSelectedWall(); return; }
    if (ui.selOpening != null) { e.preventDefault(); deleteSelectedOpening(); return; }
    if (ui.selRoom != null) { e.preventDefault(); deleteSelectedRoom(); return; }
  }
  if (e.key.toLowerCase() === 'r' && ui.selPlace != null) {
    e.preventDefault();
    const found = findPlacement(plan(), ui.selPlace);
    if (found) { found.placement.rot = (((found.placement.rot || 0) + 90) % 360); deps.markDirty(); refreshPlan(); }
    return;
  }
  const step = 5;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    nudge(moves[e.key][0], moves[e.key][1]);
  }
}

/** Déplace le symbole sélectionné, sinon le mur sélectionné (accrochage à la grille). */
function nudge(dx, dy) {
  const lv = currentLevel();
  if (ui.selPlace != null) {
    const found = findPlacement(plan(), ui.selPlace);
    if (found) {
      found.placement.x = snap(found.placement.x + dx);
      found.placement.y = snap(found.placement.y + dy);
      deps.markDirty(); refreshPlan();
    }
  } else if (ui.selWall != null) {
    const w = selectedWall(lv);
    if (w) {
      w.x1 = snap(w.x1 + dx); w.y1 = snap(w.y1 + dy);
      w.x2 = snap(w.x2 + dx); w.y2 = snap(w.y2 + dy);
      deps.markDirty(); refreshPlan();
    }
  } else if (ui.selRoom != null) {
    const r = lv.rooms.find((x) => x.id === ui.selRoom);
    if (r) { r.x = snap(r.x + dx); r.y = snap(r.y + dy); deps.markDirty(); refreshPlan(); }
  }
}

/** Outil courant : 'select' | 'wall' | 'door' | 'window' | 'room' | 'calib'. */
function setTool(name) {
  ui.tool = name;
  ui.draft = null; ui.cursor = null; ui.calibPts = [];
  if (name !== 'select') { ui.selWall = null; ui.selPlace = null; ui.selOpening = null; ui.selRoom = null; }
  refreshPlan();
}

/* ------------------------------------------------------------------- rendu */

/** Redessine l'onglet si affiché. Appelée depuis refreshAll et au changement d'onglet. */
export function refreshPlan() {
  if (!deps || deps.activeTab() !== 'plan') return;
  const p = plan();
  const lv = currentLevel();
  ui.n = effectiveScale(lv);
  renderLevelBar(p);
  renderScale(lv);
  renderBgPanel(lv);
  renderWallPanel(lv);
  renderOpeningPanel(lv);
  renderRoomPanel(lv);
  renderToolButtons();
  renderUnplaced(project());
  renderPlacePanel();
  renderPlanLevel(svgEl(), lv, ui.view, { project: project(), n: ui.n, frame: ui.showFrame ? planFrame(lv) : undefined, hideElements: ui.hideElements, elementOpacity: ui.elementOpacity, selWall: ui.selWall, selPlace: ui.selPlace, selOpening: ui.selOpening, selRoom: ui.selRoom });
  drawOverlay();
  svgEl().classList.toggle('place-armed', ui.placeArmed != null);
  $('#plan-hint').textContent = hintText(lv);
}

/** Calque d'aperçu : brouillon de mur, poignées, anneau du symbole, points de calibration.
 *  Redessiné seul pendant les mouvements (le fond n'est pas recréé). */
function drawOverlay() {
  const g = svgEl().querySelector('#plan-overlay');
  if (!g) return;
  g.replaceChildren();
  const lv = currentLevel();
  drawFrame(g, lv);              // cadre A4 : toujours visible, même « dessin masqué »
  if (ui.hideElements) return;   // vue « arrière-plan seul » : aucun calque d'aperçu
  if (ui.tool === 'wall' && ui.draft && ui.cursor) {
    const t = ui.altKey ? ui.cursor : orthoTarget(ui.draft.x, ui.draft.y, ui.cursor.x, ui.cursor.y);
    el('line', { x1: ui.draft.x, y1: ui.draft.y, x2: t.x, y2: t.y, class: 'plan-wall-preview' }, g);
  }
  const w = selectedWall(lv);
  if (w && ui.tool === 'select') {
    for (const [x, y, end] of [[w.x1, w.y1, '1'], [w.x2, w.y2, '2']]) {
      el('circle', { cx: x, cy: y, r: ui.view.w / 120, class: 'plan-handle', 'data-end': end }, g);
    }
  }
  if (ui.selPlace != null && !ui.hideElements) {
    const found = findPlacement(plan(), ui.selPlace);
    if (found) {
      const node = nodeOf(found.placement.elementId);
      const def = symbolOf(node.symbolType === 'compteur' ? 'kwh' : node.symbolType);
      const side = symbolSideCm(ui.n);
      const h = side * def.h / def.w;
      el('rect', { x: found.placement.x - side / 2 - 3, y: found.placement.y - h / 2 - 3, width: side + 6, height: h + 6, class: 'plan-sel-ring' }, g);
    }
  }
  for (const pt of ui.calibPts) el('circle', { cx: pt.x, cy: pt.y, r: ui.view.w / 150, class: 'plan-calib' }, g);
}

function renderLevelBar(p) {
  const host = $('#plan-levels');
  host.innerHTML = p.levels.map((l) =>
    `<button class="plan-level${l.id === ui.levelId ? ' active' : ''}" role="tab" data-level="${esc(l.id)}" aria-selected="${l.id === ui.levelId}" title="Double-clic pour renommer">${esc(l.name)}</button>`
  ).join('');
  const i = p.levels.findIndex((l) => l.id === ui.levelId);
  $('#plan-level-del').disabled = p.levels.length <= 1;
  $('#plan-level-up').disabled = i <= 0;
  $('#plan-level-down').disabled = i < 0 || i >= p.levels.length - 1;
}

function renderToolButtons() {
  for (const t of ['select', 'wall', 'door', 'window', 'room']) {
    $(`#plan-tool-${t}`)?.classList.toggle('active', ui.tool === t);
  }
  const btn = $('#plan-toggle-elements');
  if (btn) {
    // Libellé fixe « Afficher / masquer le dessin » ; l'état est visible (aria-pressed + style).
    btn.setAttribute('aria-pressed', String(ui.hideElements));
    btn.title = ui.hideElements
      ? 'Réafficher le dessin (murs, ouvertures, pièces, symboles)'
      : 'Masquer le dessin pour ne garder que l’arrière-plan';
  }
  svgEl().classList.toggle('hide-elements', ui.hideElements);
}

/** Masque / affiche tous les éléments (murs, ouvertures, pièces, symboles) : ne
 *  laisse que l'arrière-plan, pour comparer avant / après. */
function toggleElements() {
  ui.hideElements = !ui.hideElements;
  refreshPlan();
}

/** « Verrouiller la mise en page » : neutralise l'échelle et le déplacement du cadre A4. */
function applyLayoutLock() {
  for (const sel of ['#plan-scale-input', '#plan-scale-dec', '#plan-scale-inc', '#plan-fit-drawing']) {
    const b = $(sel);
    if (b) b.disabled = ui.lock;
  }
}

function renderScale(lv) {
  const eff = effectiveScale(lv);
  const input = $('#plan-scale-input');
  if (input && document.activeElement !== input) input.value = String(eff);
  const overflow = frameOverflow(fitBounds(lv), undefined, eff);
  $('#plan-scale-eff').textContent = `1:${eff}` + (overflow ? ' — dessin trop grand pour une page' : '');
}

/** Applique une échelle 1:N saisie (bornée), garde le centre et recale la vue sur la feuille. */
function setScale(raw) {
  if (ui.lock) return;
  const lv = currentLevel();
  const v = Math.round(Number(raw));
  const n = Number.isFinite(v) ? Math.min(PLAN_MAX_SCALE, Math.max(PLAN_MIN_SCALE, v)) : effectiveScale(lv);
  if (n !== effectiveScale(lv)) { lv.printScale = n; deps.markDirty(); }
  fitViewToSheet(lv);
  refreshPlan();
}

/** Change d'échelle par pas de la gamme normalisée. `largerN` : 1:N plus grand (dessin plus petit). */
function stepScale(largerN) {
  if (ui.lock) return;
  const lv = currentLevel();
  const s = effectiveScale(lv);
  const idx = PLAN_SCALES.indexOf(s);
  let next = s;
  if (idx >= 0) {
    next = PLAN_SCALES[Math.min(PLAN_SCALES.length - 1, Math.max(0, idx + (largerN ? 1 : -1)))];
  } else {
    const list = largerN ? PLAN_SCALES.filter((x) => x > s) : PLAN_SCALES.filter((x) => x < s).reverse();
    next = list.length ? list[0] : s;
  }
  if (next === s) return;
  lv.printScale = next;
  deps.markDirty();
  fitViewToSheet(lv);
  refreshPlan();
}

/** « Ajuster au dessin » : choisit l'échelle qui fait tenir le tracé dans la page et centre dessus. */
function fitDrawing() {
  if (ui.lock) return;
  const lv = currentLevel();
  const b = fitBounds(lv);
  lv.printScale = b ? fitScale(b).n : PLAN_DEFAULT_SCALE;
  lv.printCenter = b ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 } : null;
  deps.markDirty();
  fitViewToSheet(lv);
  refreshPlan();
}

/** Préférence mémorisée : afficher le cadre A4 (vrai par défaut). */
function loadShowFrame() {
  try { const v = localStorage.getItem(FRAME_KEY); return v === null ? true : v === '1'; } catch (err) { return true; }
}

/** Cadre A4 à l'écran : voile hors zone de tracé, bords des zones, cartouche, étiquette,
 *  poignée de déplacement. Traits `non-scaling-stroke` (épaisseur constante au zoom). */
function drawFrame(g, lv) {
  if (!ui.showFrame) return;
  const f = planFrame(lv);
  const fs = ui.view.w / 55;                       // taille de police écran (~constante au zoom)
  const noPointer = { 'pointer-events': 'none', 'vector-effect': 'non-scaling-stroke', fill: 'none' };
  const v = ui.view;
  const d = `M${v.x} ${v.y} H${v.x + v.w} V${v.y + v.h} H${v.x} Z `
    + `M${f.plot.x} ${f.plot.y} H${f.plot.x + f.plot.w} V${f.plot.y + f.plot.h} H${f.plot.x} Z`;
  el('path', { d, 'fill-rule': 'evenodd', class: 'plan-veil ui-only', 'pointer-events': 'none' }, g);
  el('rect', { x: f.sheet.x, y: f.sheet.y, width: f.sheet.w, height: f.sheet.h, class: 'plan-frame-sheet ui-only', ...noPointer }, g);
  el('rect', { x: f.printable.x, y: f.printable.y, width: f.printable.w, height: f.printable.h, class: 'plan-frame-printable ui-only', ...noPointer }, g);
  el('rect', { x: f.plot.x, y: f.plot.y, width: f.plot.w, height: f.plot.h, class: 'plan-frame-plot ui-only', ...noPointer }, g);
  el('rect', { x: f.cartouche.x, y: f.cartouche.y, width: f.cartouche.w, height: f.cartouche.h, class: 'plan-frame-cartouche ui-only', ...noPointer }, g);
  el('line', { x1: f.cartouche.x, y1: f.cartouche.y + f.cartouche.h * 0.42, x2: f.cartouche.x + f.cartouche.w, y2: f.cartouche.y + f.cartouche.h * 0.42, class: 'plan-frame-cartouche ui-only', ...noPointer }, g);
  el('text', { x: f.sheet.x, y: f.sheet.y - fs * 0.3, 'font-size': fs, class: 'plan-frame-label ui-only', 'pointer-events': 'none' }, g)
    .textContent = `${lv.name} — 1:${f.n}`;
  if (ui.tool === 'select' && !ui.lock) {
    el('circle', { cx: f.center.x, cy: f.center.y, r: ui.view.w / 120, class: 'plan-frame-handle ui-only', 'pointer-events': 'none' }, g);
    el('circle', { cx: f.center.x, cy: f.center.y, r: ui.view.w / 45, class: 'plan-frame-hit ui-only', 'data-frame-move': '1' }, g);
  }
}

function renderBgPanel(lv) {
  const bg = lv.bg;
  $('#plan-bg-panel').hidden = !bg;
  if (!bg) return;
  $('#plan-bg-state').textContent = bg.calibrated
    ? 'Calibré.'
    : 'Non calibré : les distances ne sont pas exactes.';
  $('#plan-bg-calib').textContent = bg.calibrated ? 'Recalibrer…' : 'Calibrer…';
  $('#plan-bg-opacity').value = String(Math.round(bg.opacity * 100));
  $('#plan-bg-visible').checked = bg.visible;
  $('#plan-bg-lock').checked = bg.locked;
  // Agrandir / rétrécir : seulement quand le fond est déverrouillé.
  $('#plan-bg-smaller').disabled = bg.locked;
  $('#plan-bg-bigger').disabled = bg.locked;
}

function renderWallPanel(lv) {
  const w = selectedWall(lv);
  $('#plan-wall-panel').hidden = !w;
  if (!w) return;
  $('#plan-wall-t').value = String(w.t);
  const len = wallLength(w);
  const scale = effectiveScale(lv);
  $('#plan-wall-info').textContent = `Longueur ${Math.round(len)} cm — sur papier à 1:${scale} : ${cmToPaperMm(len, scale).toFixed(1)} mm`;
}

function renderOpeningPanel(lv) {
  const o = ui.selOpening != null ? lv.openings.find((x) => x.id === ui.selOpening) : null;
  $('#plan-opening-panel').hidden = !o;
  $('#plan-opening-w-wrap').hidden = !o;
  // Les miroirs ne concernent que les portes : masqués hors sélection et pour une fenêtre.
  $('#plan-door-panel').hidden = !o || o.kind !== 'door';
  // La ligne « options » ne sert qu'aux réglages d'ouverture : masquée (sinon vide) sans sélection.
  $('#plan-options-row').hidden = !o;
  if (!o) return;
  const nom = o.kind === 'door' ? 'Porte' : 'Fenêtre';
  const w = lv.walls.find((x) => x.id === o.wall);
  $('#plan-opening-info').textContent = `${nom} sur ${w ? 'mur ' + w.id : 'mur supprimé'}`;
  $('#plan-opening-w').value = String(o.w);
}

function renderRoomPanel() {
  const r = selectedRoom();
  $('#plan-room-panel').hidden = !r;
  const bar = $('#plan-text-bar');
  if (bar) bar.hidden = !r;                       // barre dédiée : seulement texte sélectionné
  if (!r) return;
  $('#plan-room-name').value = r.name || '';
  $('#plan-text-size').value = String(r.size > 0 ? r.size : 1);
  setFmtButton('#plan-text-bold', r.bold);
  setFmtButton('#plan-text-italic', r.italic);
  setFmtButton('#plan-text-underline', r.underline);
}

/** Liste « Non placés » : éléments posables pas encore placés, triés de façon stable. */
function renderUnplaced(p) {
  const host = $('#plan-unplaced');
  const list = unplacedElements(p);
  host.innerHTML = list.length === 0 ? '<p class="count">Tout est placé.</p>' : '';
  for (const it of list) {
    const node = nodeOf(it.elementId);
    const div = document.createElement('div');
    div.className = 'plan-unplaced-item';
    div.dataset.id = it.elementId;
    const lbl = esc(planLabel(p, node) || '—');
    const tp = esc(symbolName(node.symbolType === 'compteur' ? 'kwh' : node.symbolType));
    div.innerHTML = `<span class="lbl">${lbl}</span><span class="tp">${tp}</span>`;
    host.appendChild(div);
    makeDraggable(div);
  }
}

function renderPlacePanel() {
  const found = ui.selPlace != null ? findPlacement(plan(), ui.selPlace) : null;
  $('#plan-place-panel').hidden = !found;
  if (!found) return;
  const node = nodeOf(found.placement.elementId);
  const start = circuitStartOf(project(), node);
  const nom = node.symbolType === 'compteur' ? 'Compteur' : symbolName(node.symbolType);
  $('#plan-place-info').textContent =
    `${planLabel(project(), node) || '—'} · ${nom} · ${found.level.name}` + (start ? ` · circuit ${start.label || '—'}` : '');
  $('#plan-place-rot').value = String(found.placement.rot || 0);
}

function hintText(lv) {
  if (ui.tool === 'calib') {
    return ui.calibPts.length === 0
      ? 'Calibration : cliquez le 1er point (distance connue). Échap pour annuler.'
      : 'Calibration : cliquez le 2e point.';
  }
  if (ui.tool === 'wall') {
    return 'Mur : clic pour commencer, clic pour poursuivre. Entrée, Échap ou double-clic pour finir. Alt : angle libre.';
  }
  if (ui.tool === 'door' || ui.tool === 'window') {
    return ui.tool === 'door' ? 'Porte : cliquez près d’un mur pour la poser.' : 'Fenêtre : cliquez près d’un mur pour la poser.';
  }
  if (ui.tool === 'room') return 'Texte : cliquez pour poser un texte ; saisissez son contenu dans la boîte.';
  if (ui.placeArmed != null) return 'Cliquez sur le plan pour poser. Échap pour annuler.';
  if (lv.bg && !lv.bg.locked) return 'Fond déverrouillé : glissez-le ou changez sa taille. Les autres éléments restent modifiables.';
  return 'Clic sur un mur ou un symbole : sélection. R : rotation. Suppr : retirer. Molette : zoom · Espace ou bouton milieu : déplacer la vue.';
}

/* ----------------------------------------------------------------- vue (zoom) */

function applyView() {
  const v = ui.view;
  svgEl().setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
}

function hostAspect() {
  const h = $('#plan-host');
  return h && h.clientWidth > 0 && h.clientHeight > 0 ? h.clientHeight / h.clientWidth : DEFAULT_VIEW.h / DEFAULT_VIEW.w;
}

/** Cadre la feuille A4 entière (zoom + centrage). */
function fitViewToSheet(lv) {
  const b = planFrame(lv).sheet;
  const pad = Math.max(b.w, b.h) * 0.04;
  const bw = b.w + 2 * pad, bh = b.h + 2 * pad;
  const aspect = hostAspect();
  const w = Math.max(bw, bh / aspect), h = w * aspect;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ui.view = { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Centre la vue sur le cadre sans changer le zoom. */
function centerViewOnFrame(lv) {
  const b = planFrame(lv).sheet;
  ui.view.x = b.x + b.w / 2 - ui.view.w / 2;
  ui.view.y = b.y + b.h / 2 - ui.view.h / 2;
}

/** Cadre le niveau (emprise + marge), ou la vue par défaut s'il est vide. */
function fitLevel(lv) {
  const b = levelBounds(lv);
  if (!b) { ui.view = { ...DEFAULT_VIEW }; return; }
  const pad = 100;
  const bw = Math.max(b.x1 - b.x0 + 2 * pad, 300), bh = Math.max(b.y1 - b.y0 + 2 * pad, 300);
  const aspect = hostAspect();
  const w = Math.max(bw, bh / aspect), h = w * aspect;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  ui.view = { x: cx - w / 2, y: cy - h / 2, w, h };
}

function zoomAt(e, k) {
  const svg = svgEl();
  const anchor = toWorld(e);
  const v = ui.view;
  const nw = Math.min(MAX_VIEW_CM, Math.max(MIN_VIEW_CM, v.w * k));
  const f = nw / v.w;
  const nh = v.h * f;
  const r = svg.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  ui.view = { x: anchor.x - nw * fx, y: anchor.y - nh * fy, w: nw, h: nh };
  applyView();
  drawOverlay();
}

/** Zoom de la vue autour du centre de la zone de travail (boutons − / +). */
function zoomCenter(k) {
  const r = $('#plan-host').getBoundingClientRect();
  zoomAt({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, k);
}

/** Coordonnées monde (cm) d'un événement souris. */
function toWorld(e) {
  const svg = svgEl();
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

function toWorldFromClient(cx, cy) {
  const svg = svgEl();
  const pt = svg.createSVGPoint();
  pt.x = cx; pt.y = cy;
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

/** Point visé : extrémité de mur proche (accrochage prioritaire), sinon grille 5 cm.
 *  En cours de tracé, orthogonal sauf Alt. */
function targetPoint(e) {
  const lv = currentLevel();
  const raw = toWorld(e);
  const tol = ui.view.w * 0.012;
  let best = null;
  for (const w of lv.walls) {
    for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) {
      const d = Math.hypot(raw.x - x, raw.y - y);
      if (d <= tol && (!best || d < best.d)) best = { x, y, d };
    }
  }
  let p = best ? { x: best.x, y: best.y } : { x: snap(raw.x), y: snap(raw.y) };
  if (ui.tool === 'wall' && ui.draft && !e.altKey) p = orthoTarget(ui.draft.x, ui.draft.y, p.x, p.y);
  return p;
}

/* ------------------------------------------------------------ souris */

function onPointerDown(e) {
  if (e.button === 1 || (e.button === 0 && ui.spaceDown)) {
    e.preventDefault();
    ui.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: ui.view.x, vy: ui.view.y };
    svgEl().setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0) return;
  const lv = currentLevel();

  // Poignée de déplacement du cadre : déplace le centre d'impression (printCenter).
  if (ui.tool === 'select' && !ui.lock && e.target.closest?.('[data-frame-move]')) {
    const f = planFrame(lv);
    ui.drag = { kind: 'frame', start: toWorld(e), orig: { x: f.center.x, y: f.center.y }, moved: false };
    svgEl().setPointerCapture(e.pointerId);
    return;
  }

  if (ui.tool === 'calib') { addCalibPoint(toWorld(e)); return; }

  if (ui.tool === 'wall') {
    const p = targetPoint(e);
    ui.altKey = e.altKey;
    if (!ui.draft) { ui.draft = p; drawOverlay(); return; }
    if (p.x !== ui.draft.x || p.y !== ui.draft.y) {
      addWall(plan(), lv, { x1: ui.draft.x, y1: ui.draft.y, x2: p.x, y2: p.y });
      deps.markDirty();
      ui.draft = p;
      refreshPlan();
    }
    return;
  }

  if (ui.tool === 'door' || ui.tool === 'window') {
    const pt = toWorld(e);
    const tol = ui.view.w * 0.02;
    const near = nearestWall(lv, pt.x, pt.y, tol);
    if (near) {
      const o = addOpening(plan(), lv, { kind: ui.tool, wall: near.wall.id, pos: near.pos });
      ui.selOpening = o.id; ui.selRoom = null; ui.selWall = null; ui.selPlace = null;
      deps.markDirty(); refreshPlan();
    } else {
      deps.status('Cliquez près d’un mur pour poser une porte ou une fenêtre.');
    }
    return;
  }

  if (ui.tool === 'room') {
    const pt = toWorld(e);
    setTool('select');                              // outil à usage unique
    askValue('Texte', 'Contenu', '').then((txt) => {
      if (txt == null) return;                      // saisie annulée : rien n'est posé
      const r = addRoom(plan(), lv, { x: snap(pt.x), y: snap(pt.y), name: txt });
      ui.selRoom = r.id; ui.selOpening = null; ui.selWall = null; ui.selPlace = null;
      deps.markDirty(); refreshPlan();
    });
    return;
  }

  // Pose depuis la liste (clic après armement, ou glisser-déposer géré dans makeDraggable)
  if (ui.placeArmed != null) {
    const id = ui.placeArmed;
    if (placeElement(plan(), lv.id, id, snap(toWorld(e).x), snap(toWorld(e).y))) {
      ui.selPlace = id;
      ui.placeArmed = null;
      deps.selectElement(id);          // sélection partagée avec le schéma
      deps.markDirty();
    }
    refreshPlan();
    return;
  }

  // outil Sélection : poignée > mur > symbole > fond
  const handle = e.target.closest?.('[data-end]');
  const wallEl = e.target.closest?.('[data-wall]');
  const placeEl = e.target.closest?.('[data-placement]');
  if (handle) {
    const w = selectedWall(lv);
    if (w) {
      ui.drag = { kind: 'end', wall: w.id, which: handle.dataset.end };
      svgEl().setPointerCapture(e.pointerId);
    }
    return;
  }
  if (wallEl) {
    ui.selWall = wallEl.dataset.wall;
    ui.selPlace = null; ui.selOpening = null; ui.selRoom = null;
    const w = selectedWall(lv);
    const start = toWorld(e);
    ui.drag = { kind: 'wall', wall: w.id, start, orig: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }, moved: false };
    svgEl().setPointerCapture(e.pointerId);
    refreshPlan();
    return;
  }
  if (placeEl) {
    const id = Number(placeEl.dataset.placement);
    ui.selPlace = id;
    ui.selWall = null;
    const found = findPlacement(plan(), id);
    const start = toWorld(e);
    ui.drag = { kind: 'place', id, start, orig: found ? { x: found.placement.x, y: found.placement.y } : null, moved: false };
    svgEl().setPointerCapture(e.pointerId);
    deps.selectElement(id);            // sélection partagée avec le schéma
    refreshPlan();
    return;
  }
  const openEl = e.target.closest?.('[data-opening]');
  if (openEl) {
    ui.selOpening = openEl.dataset.opening;
    ui.selRoom = null; ui.selWall = null; ui.selPlace = null;
    svgEl().setPointerCapture(e.pointerId);
    ui.drag = { kind: 'opening', id: ui.selOpening, moved: false };
    refreshPlan();
    return;
  }
  const roomEl = e.target.closest?.('[data-room]');
  if (roomEl) {
    ui.selRoom = roomEl.dataset.room;
    ui.selOpening = null; ui.selWall = null; ui.selPlace = null;
    const r = lv.rooms.find((x) => x.id === ui.selRoom);
    const start = toWorld(e);
    ui.drag = { kind: 'room', id: ui.selRoom, start, orig: r ? { x: r.x, y: r.y } : null, moved: false };
    svgEl().setPointerCapture(e.pointerId);
    refreshPlan();
    return;
  }
  if (lv.bg && !lv.bg.locked && e.target.closest?.('[data-bg]')) {
    ui.drag = { kind: 'bg', start: toWorld(e), bx: lv.bg.x, by: lv.bg.y, moved: false };
    ui.selWall = null; ui.selPlace = null; ui.selOpening = null; ui.selRoom = null;
    svgEl().setPointerCapture(e.pointerId);
    return;
  }
  if (ui.selWall != null || ui.selPlace != null || ui.selOpening != null || ui.selRoom != null) { ui.selWall = null; ui.selPlace = null; ui.selOpening = null; ui.selRoom = null; refreshPlan(); }
}

function onPointerMove(e) {
  const lv = currentLevel();
  if (ui.tool === 'wall' && ui.draft) {
    ui.cursor = targetPoint(e);
    ui.altKey = e.altKey;
    drawOverlay();
    return;
  }
  const d = ui.drag;
  if (!d) return;
  if (d.kind === 'pan') {
    const m = svgEl().getScreenCTM();
    const s = m ? m.a : 1;
    ui.view.x = d.vx - (e.clientX - d.sx) / s;
    ui.view.y = d.vy - (e.clientY - d.sy) / s;
    applyView();
    drawOverlay();
  } else if (d.kind === 'frame') {
    const pt = toWorld(e);
    lv.printCenter = { x: d.orig.x + (pt.x - d.start.x), y: d.orig.y + (pt.y - d.start.y) };
    d.moved = true;
    refreshPlan();
  } else if (d.kind === 'bg') {
    const pt = toWorld(e);
    const bg = lv.bg;
    if (!bg) return;
    bg.x = d.bx + (pt.x - d.start.x);
    bg.y = d.by + (pt.y - d.start.y);
    d.moved = true;
    refreshPlan();
  } else if (d.kind === 'end') {
    const w = selectedWall(lv);
    if (!w) return;
    const p = targetPoint(e);
    if (d.which === '1') { w.x1 = p.x; w.y1 = p.y; } else { w.x2 = p.x; w.y2 = p.y; }
    d.moved = true;
    updateWallEl(w);
    drawOverlay();
  } else if (d.kind === 'wall') {
    const w = selectedWall(lv);
    if (!w) return;
    const pt = toWorld(e);
    const dx = snap(pt.x - d.start.x), dy = snap(pt.y - d.start.y);
    w.x1 = d.orig.x1 + dx; w.y1 = d.orig.y1 + dy;
    w.x2 = d.orig.x2 + dx; w.y2 = d.orig.y2 + dy;
    d.moved = true;
    updateWallEl(w);
    drawOverlay();
  } else if (d.kind === 'place') {
    const found = findPlacement(plan(), d.id);
    if (!found || !d.orig) return;
    const pt = toWorld(e);
    found.placement.x = snap(d.orig.x + (pt.x - d.start.x));
    found.placement.y = snap(d.orig.y + (pt.y - d.start.y));
    d.moved = true;
    updatePlaceEl(found);
    drawOverlay();
  } else if (d.kind === 'opening') {
    const o = lv.openings.find((x) => x.id === d.id);
    if (!o) return;
    const pt = toWorld(e);
    const near = nearestWall(lv, pt.x, pt.y, ui.view.w * 0.06);
    if (near) { o.wall = near.wall.id; o.pos = near.pos; d.moved = true; refreshPlan(); }
  } else if (d.kind === 'room') {
    const r = lv.rooms.find((x) => x.id === d.id);
    if (!r || !d.orig) return;
    const pt = toWorld(e);
    r.x = snap(d.orig.x + (pt.x - d.start.x));
    r.y = snap(d.orig.y + (pt.y - d.start.y));
    d.moved = true;
    refreshPlan();
  }
}

function onPointerUp(e) {
  const d = ui.drag;
  ui.drag = null;
  try { svgEl().releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
  if (d && d.moved) { deps.markDirty(); refreshPlan(); }
}

/** Met à jour seulement un objet pendant un glissement (pas de re-rendu complet). */
function updateWallEl(w) {
  const line = svgEl().querySelector(`[data-wall="${w.id}"]`);
  if (!line) return;
  line.setAttribute('x1', w.x1); line.setAttribute('y1', w.y1);
  line.setAttribute('x2', w.x2); line.setAttribute('y2', w.y2);
}

function updatePlaceEl(found) {
  const g = svgEl().querySelector(`[data-placement="${found.placement.elementId}"]`);
  if (g) g.setAttribute('transform', `translate(${found.placement.x},${found.placement.y})`);
}

/* ----------------------------------------------------------------- murs */

function deleteSelectedWall() {
  const lv = currentLevel();
  if (ui.selWall == null) return;
  removeWall(lv, ui.selWall);
  ui.selWall = null;
  deps.markDirty(); refreshPlan();
}

function deleteSelectedOpening() {
  const lv = currentLevel();
  if (ui.selOpening == null) return;
  removeOpening(lv, ui.selOpening);
  ui.selOpening = null;
  deps.markDirty(); refreshPlan();
}

/** Dialogue de saisie du contenu d'un texte (double-clic sur le texte pour le modifier). */
function editRoom(id) {
  const r = currentLevel().rooms.find((x) => x.id === id);
  if (!r) return;
  askValue('Texte', 'Contenu', r.name || '').then((txt) => {
    if (txt == null) return;
    r.name = txt;
    deps.markDirty(); refreshPlan();
  });
}

function deleteSelectedRoom() {
  const lv = currentLevel();
  if (ui.selRoom == null) return;
  removeRoom(lv, ui.selRoom);
  ui.selRoom = null;
  deps.markDirty(); refreshPlan();
}

/* ---------------------------------------------------------------- placements */

/** Retire le symbole du plan ; l'élément du schéma est conservé. */
function removeSelectedPlace() {
  if (ui.selPlace == null) return;
  unplaceElement(plan(), ui.selPlace);
  ui.selPlace = null;
  deps.markDirty(); refreshPlan();
}

/** Glisser-déposer depuis la liste « Non placés ». Clic simple = armer. */
function makeDraggable(item) {
  item.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const id = Number(item.dataset.id);
    const sx = e.clientX, sy = e.clientY;
    let ghost = null;
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) {
        ghost = document.createElement('div');
        ghost.id = 'plan-ghost';
        ghost.textContent = item.textContent;
        document.body.appendChild(ghost);
      }
      if (ghost) { ghost.style.left = `${ev.clientX + 8}px`; ghost.style.top = `${ev.clientY + 8}px`; }
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const r = svgEl().getBoundingClientRect();
      const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (ghost) {
        ghost.remove();
        if (inside) {
          const pt = toWorldFromClient(ev.clientX, ev.clientY);
          if (placeElement(plan(), currentLevel().id, id, snap(pt.x), snap(pt.y))) {
            ui.selPlace = id;
            ui.placeArmed = null;
            deps.selectElement(id);
            deps.markDirty();
          }
          refreshPlan();
        }
      } else {
        ui.placeArmed = ui.placeArmed === id ? null : id;
        refreshPlan();
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}

/* ------------------------------------------------------------------ niveaux */

function selectLevel(id) {
  if (id === ui.levelId) return;
  ui.levelId = id;
  ui.tool = 'select'; ui.calibPts = []; ui.draft = null; ui.selWall = null; ui.selPlace = null; ui.placeArmed = null;
  fitViewToSheet(currentLevel());
  refreshPlan();
}

async function addLevelFlow() {
  const lv = addLevel(plan());
  ui.levelId = lv.id;
  ui.selWall = null; ui.selPlace = null; ui.draft = null;
  fitViewToSheet(lv);
  deps.markDirty(); refreshPlan();
}

async function renameFlow(id) {
  const lv = levelById(plan(), id);
  if (!lv) return;
  const name = await askValue('Renommer l’étage', 'Nom :', lv.name);
  if (name === null) return;
  if (renameLevel(plan(), id, name)) { deps.markDirty(); refreshPlan(); }
}

function moveFlow(delta) {
  if (moveLevel(plan(), ui.levelId, delta)) { deps.markDirty(); refreshPlan(); }
}

function removeFlow() {
  const p = plan();
  const lv = currentLevel();
  if (p.levels.length <= 1) return;
  if (hasPlanContent(lv) && !confirm(`Supprimer l’étage « ${lv.name} » et son tracé ? Les éléments du schéma sont conservés.`)) return;
  removeLevel(p, lv.id);
  ui.levelId = p.levels[0].id;
  ui.selWall = null; ui.selPlace = null; ui.draft = null;
  fitViewToSheet(currentLevel());
  deps.markDirty(); refreshPlan();
}

/* ---------------------------------------------------------------------- fond */

function setBg(patch) {
  const bg = currentLevel().bg;
  if (!bg) return;
  Object.assign(bg, patch);
  deps.markDirty(); refreshPlan();
}

/** Agrandit (k>1) ou rétrécit (k<1) l'arrière-plan autour de son centre, pour
 *  l'ajuster au plan tracé. Sans effet tant que le fond est verrouillé. */
function scaleBg(k) {
  const bg = currentLevel().bg;
  if (!bg || bg.locked) return;
  const cx = bg.x + bg.w / 2, cy = bg.y + bg.h / 2;
  bg.w = Math.max(1, bg.w * k);
  bg.h = Math.max(1, bg.h * k);
  bg.x = cx - bg.w / 2;
  bg.y = cy - bg.h / 2;
  deps.markDirty(); refreshPlan();
}

function importBg() {
  const lv = currentLevel();
  if (lv.bg && !confirm('Remplacer le fond de plan actuel ?')) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const { dataURL, w, h } = await prepareImage(file);
      const p = plan();
      const target = currentLevel();
      const key = nextPlanId(p, 'p');
      assetSet(key, dataURL);
      target.bg = { asset: key, x: 0, y: 0, w, h, opacity: 0.5, visible: true, locked: true, calibrated: false };
      ui.tool = 'calib'; ui.calibPts = [];
      fitLevel(target);
      deps.markDirty(); refreshPlan();
      deps.status('Fond importé. Calibrez-le : deux points de distance connue.');
    } catch (err) {
      alert('Import impossible.\n\n' + err.message);
    }
  };
  input.click();
}

function removeBg() {
  const lv = currentLevel();
  if (!lv.bg || !confirm('Supprimer le fond de plan ? (Annuler restaure l’image.)')) return;
  lv.bg = null;
  setTool('select');
  deps.markDirty();
}

async function addCalibPoint(pt) {
  ui.calibPts.push(pt);
  if (ui.calibPts.length < 2) { refreshPlan(); return; }
  const [a, b] = ui.calibPts;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  if (dist <= 0) { ui.calibPts = []; refreshPlan(); return; }
  const m = await askValue('Calibration', 'Distance réelle entre les deux points (en mètres) :', '', 'number');
  const meters = m === null ? NaN : Number(String(m).replace(',', '.'));
  ui.tool = 'select'; ui.calibPts = [];
  const bg = currentLevel().bg;
  if (!(meters > 0) || !bg) { refreshPlan(); return; }
  const k = (meters * 100) / dist;   // cm réels par unité de plan
  bg.x *= k; bg.y *= k; bg.w *= k; bg.h *= k;
  bg.calibrated = true;
  fitLevel(currentLevel());
  deps.markDirty(); refreshPlan();
  deps.status('Fond calibré.');
}

/* ------------------------------------------------------------------ dialogue */

/** Saisie dans le dialogue modal commun (prompt() est bloqué sous Electron). */
function askValue(title, label, value = '', type = 'text') {
  return new Promise((resolve) => {
    const dlg = $('#plan-dialog');
    const form = $('#plan-dialog-form');
    const input = $('#plan-dialog-input');
    $('#plan-dialog-title').textContent = title;
    $('#plan-dialog-label').textContent = label;
    input.type = type;
    input.value = value;
    dlg.returnValue = '';                          // remis à zéro à chaque ouverture

    let done = false;
    const finish = (ok) => {
      if (done) return;                            // une seule résolution par boîte
      done = true;
      form.removeEventListener('submit', onSubmit);
      dlg.removeEventListener('close', onClose);
      dlg.removeEventListener('keydown', onKey);
      resolve(ok ? input.value : null);
    };
    // Clé = bouton réellement cliqué (« ok » valide, « cancel » annule).
    const onSubmit = (e) => finish(!e.submitter || e.submitter.value === 'ok');
    // Entrée valide (sinon la soumission implicite viserait « Annuler », 1ᵉʳ bouton).
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); dlg.close('ok'); finish(true); }
      else if (e.key === 'Escape') { finish(false); }
    };
    const onClose = () => finish(dlg.returnValue === 'ok');

    form.addEventListener('submit', onSubmit);
    dlg.addEventListener('close', onClose);
    dlg.addEventListener('keydown', onKey);
    dlg.showModal();
    input.focus();
    input.select();
  });
}

/* ------------------------------------------------------------- API publique */

/** Appelée par ui.js après chargement / ouverture d'un projet : repart du premier niveau. */
export function resetPlanView() {
  ui.levelId = null;
  ui.tool = 'select';
  ui.calibPts = [];
  ui.drag = null;
  ui.draft = null;
  ui.selWall = null;
  ui.selPlace = null;
  ui.placeArmed = null;
  ui.selOpening = null;
  ui.selRoom = null;
  fitViewToSheet(currentLevel());
}
