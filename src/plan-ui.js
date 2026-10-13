// Interactions de l'onglet « Schéma d'implantation » (DOM). La logique de données
// est dans plan-model.js ; le rendu dans plan-render.js. Ce module n'importe rien
// de l'état interne de ui.js : tout passe par `initPlan(deps)`.
import {
  levelById, addLevel, removeLevel, renameLevel, moveLevel, hasPlanContent, levelBounds,
  effectiveScale, chooseScale, nextPlanId, addWall, removeWall, wallLength, paperMm,
  snap, orthoTarget,
} from './plan-model.js';
import { PLAN_SCALES } from './standards.js';
import { prepareImage, assetSet } from './plan-assets.js';
import { renderPlanLevel, el } from './plan-render.js';

const $ = (sel) => document.querySelector(sel);
const DEFAULT_VIEW = { x: -200, y: -200, w: 1600, h: 1000 };
const MIN_VIEW_CM = 50, MAX_VIEW_CM = 200000;
const MIN_WALL_CM = 1;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let deps = null;
const ui = {
  levelId: null,
  view: { ...DEFAULT_VIEW },
  tool: 'select',       // 'select' | 'wall' | 'calib'
  calibPts: [],
  spaceDown: false,
  drag: null,           // glissement en cours : pan | bg | end | wall
  draft: null,          // point de départ d'un mur en cours de tracé
  cursor: null,         // point visé (aperçu du mur en cours)
  selWall: null,        // id du mur sélectionné
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

  const scale = $('#plan-scale');
  scale.innerHTML = '<option value="auto">Automatique</option>' +
    PLAN_SCALES.map((n) => `<option value="${n}">1:${n}</option>`).join('');
  scale.addEventListener('change', () => {
    const lv = currentLevel();
    lv.printScale = scale.value === 'auto' ? 'auto' : Number(scale.value);
    deps.markDirty(); refreshPlan();
  });

  $('#plan-tool-select').addEventListener('click', () => setTool('select'));
  $('#plan-tool-wall').addEventListener('click', () => setTool(ui.tool === 'wall' ? 'select' : 'wall'));

  $('#plan-bg-import').addEventListener('click', importBg);
  $('#plan-bg-calib').addEventListener('click', () => setTool(ui.tool === 'calib' ? 'select' : 'calib'));
  $('#plan-bg-opacity').addEventListener('input', (e) => {
    const bg = currentLevel().bg; if (!bg) return;
    bg.opacity = Number(e.target.value) / 100; refreshPlan();
  });
  $('#plan-bg-opacity').addEventListener('change', () => deps.markDirty());
  $('#plan-bg-visible').addEventListener('change', (e) => setBg({ visible: e.target.checked }));
  $('#plan-bg-lock').addEventListener('change', (e) => setBg({ locked: e.target.checked }));
  $('#plan-bg-del').addEventListener('click', removeBg);

  $('#plan-wall-t').addEventListener('change', (e) => {
    const w = selectedWall(currentLevel()); if (!w) return;
    const t = Number(e.target.value);
    if (t >= MIN_WALL_CM) { w.t = t; deps.markDirty(); }
    refreshPlan();
  });
  $('#plan-wall-del').addEventListener('click', deleteSelectedWall);

  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e, e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerUp);
  svg.addEventListener('dblclick', () => { ui.draft = null; drawOverlay(); });
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
    if (ui.tool === 'wall') { setTool('select'); return; }
    ui.selWall = null; refreshPlan();
    return;
  }
  if (e.key === 'Enter' && ui.draft) { ui.draft = null; drawOverlay(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selWall != null) {
    e.preventDefault();
    deleteSelectedWall();
  }
}

/** Outil courant : 'select' | 'wall' | 'calib'. Réinitialise les brouillons. */
function setTool(name) {
  ui.tool = name;
  ui.draft = null; ui.cursor = null; ui.calibPts = [];
  refreshPlan();
}

/* ------------------------------------------------------------------- rendu */

/** Redessine l'onglet si affiché. Appelée depuis refreshAll et au changement d'onglet. */
export function refreshPlan() {
  if (!deps || deps.activeTab() !== 'plan') return;
  const p = plan();
  const lv = currentLevel();
  renderLevelBar(p);
  renderScale(lv);
  renderBgPanel(lv);
  renderWallPanel(lv);
  renderToolButtons();
  renderPlanLevel(svgEl(), lv, ui.view, ui.selWall);
  drawOverlay();
  $('#plan-hint').textContent = hintText(lv);
}

/** Calque d'aperçu : brouillon de mur, poignées du mur sélectionné, points de calibration.
 *  Redessiné seul pendant les mouvements (le fond n'est pas recréé). */
function drawOverlay() {
  const g = svgEl().querySelector('#plan-overlay');
  if (!g) return;
  g.replaceChildren();
  const lv = currentLevel();
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
  $('#plan-tool-select').classList.toggle('active', ui.tool === 'select');
  $('#plan-tool-wall').classList.toggle('active', ui.tool === 'wall');
}

function renderScale(lv) {
  $('#plan-scale').value = String(lv.printScale);
  const eff = effectiveScale(lv);
  const fits = typeof lv.printScale === 'number' || chooseScale(levelBounds(lv)).fits;
  $('#plan-scale-eff').textContent = `Échelle 1:${eff}` + (fits ? '' : ' — dessin trop grand pour une page');
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
}

function renderWallPanel(lv) {
  const w = selectedWall(lv);
  $('#plan-wall-panel').hidden = !w;
  if (!w) return;
  $('#plan-wall-t').value = String(w.t);
  const len = wallLength(w);
  const scale = effectiveScale(lv);
  $('#plan-wall-info').textContent = `Longueur ${Math.round(len)} cm — sur papier à 1:${scale} : ${paperMm(len, scale).toFixed(1)} mm`;
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
  if (lv.bg && !lv.bg.locked) return 'Fond déverrouillé : glissez-le. Verrouillez-le avant de tracer.';
  return 'Clic sur un mur : sélection (poignées pour l’étirer). Molette : zoom · Espace ou bouton milieu : déplacer la vue.';
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

  // outil Sélection : poignée > mur > fond
  const handle = e.target.closest?.('[data-end]');
  const wallEl = e.target.closest?.('[data-wall]');
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
    const w = selectedWall(lv);
    const start = toWorld(e);
    ui.drag = { kind: 'wall', wall: w.id, start, orig: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }, moved: false };
    svgEl().setPointerCapture(e.pointerId);
    refreshPlan();
    return;
  }
  if (lv.bg && !lv.bg.locked && e.target.closest?.('[data-bg]')) {
    ui.drag = { kind: 'bg', start: toWorld(e), bx: lv.bg.x, by: lv.bg.y, moved: false };
    ui.selWall = null;
    svgEl().setPointerCapture(e.pointerId);
    return;
  }
  if (ui.selWall != null) { ui.selWall = null; refreshPlan(); }
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
  }
}

function onPointerUp(e) {
  const d = ui.drag;
  ui.drag = null;
  try { svgEl().releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
  if (d && d.moved) { deps.markDirty(); refreshPlan(); }
}

/** Met à jour seulement la ligne d'un mur pendant un glissement (pas de re-rendu complet). */
function updateWallEl(w) {
  const line = svgEl().querySelector(`[data-wall="${w.id}"]`);
  if (!line) return;
  line.setAttribute('x1', w.x1); line.setAttribute('y1', w.y1);
  line.setAttribute('x2', w.x2); line.setAttribute('y2', w.y2);
}

/* ----------------------------------------------------------------- murs */

function deleteSelectedWall() {
  const lv = currentLevel();
  if (ui.selWall == null) return;
  removeWall(lv, ui.selWall);
  ui.selWall = null;
  deps.markDirty(); refreshPlan();
}

/* ------------------------------------------------------------------ niveaux */

function selectLevel(id) {
  if (id === ui.levelId) return;
  ui.levelId = id;
  ui.tool = 'select'; ui.calibPts = []; ui.draft = null; ui.selWall = null;
  fitLevel(currentLevel());
  refreshPlan();
}

async function addLevelFlow() {
  const lv = addLevel(plan());
  ui.levelId = lv.id;
  ui.selWall = null; ui.draft = null;
  fitLevel(lv);
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
  ui.selWall = null; ui.draft = null;
  fitLevel(currentLevel());
  deps.markDirty(); refreshPlan();
}

/* ---------------------------------------------------------------------- fond */

function setBg(patch) {
  const bg = currentLevel().bg;
  if (!bg) return;
  Object.assign(bg, patch);
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
    const input = $('#plan-dialog-input');
    $('#plan-dialog-title').textContent = title;
    $('#plan-dialog-label').textContent = label;
    input.type = type;
    input.value = value;
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok' ? input.value : null), { once: true });
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
  fitLevel(currentLevel());
}
