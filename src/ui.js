// Contrôleur d'interface : onglets, formulaire informations, liste circuits, BOM.
// Toute mutation du projet passe par setState() pour rester synchronisé.

import { emptyProject, createCircuit, syncIdCounter, nextId } from './model.js';
import { renderSchema, sheetSize, phaseBalance } from './render.js';
import { SYMBOLS, SYMBOL_CATEGORIES, symbolName } from './symbols.js';
import { validate, RULES_BE, RULE_SEVERITY } from './rules-be.js';
import { CIRCUIT_TYPES, RATINGS, RCD_VALUES, DEFAULT_ICB, isProtection } from './standards.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let project = emptyProject();
let currentFile = null;
let activeTab = 'info';
let dirty = false;
let selectedComponentId = null;
let selectedCircuitId = null;
let selectedSupply = false;
let view = { x: 0, y: 0, w: 2100, h: 1100 };

/* --------------------------------------------------- historique (annuler/rétablir) */

const history = { past: [], future: [] };
let lastSnap = JSON.stringify(project);

function markDirty() {
  const snap = JSON.stringify(project);
  $('#project-file').textContent = (currentFile ? currentFile.split(/[\\/]/).pop() : 'sans titre') + ' • modifié';
  if (snap === lastSnap) return;        // frappe identique : on n'empile pas
  history.past.push(lastSnap);
  if (history.past.length > 150) history.past.shift();
  history.future.length = 0;
  lastSnap = snap;
  dirty = true;
  updateHistoryButtons();
}

function snapshot() { lastSnap = JSON.stringify(project); }

function restore(snap) {
  project = JSON.parse(snap);
  syncIdCounter(project);
  loadInfoForm();
  refreshAll();
}

function undo() {
  if (history.past.length === 0) return;
  history.future.push(lastSnap);
  const prev = history.past.pop();
  restore(prev);
  lastSnap = prev;
  dirty = true;
  updateHistoryButtons();
  status('Annulé.');
}

function redo() {
  if (history.future.length === 0) return;
  const next = history.future.pop();
  history.past.push(lastSnap);
  restore(next);
  lastSnap = next;
  dirty = true;
  updateHistoryButtons();
  status('Rétabli.');
}

function updateHistoryButtons() {
  const u = $('#btn-undo'), r = $('#btn-redo');
  if (u) u.disabled = history.past.length === 0;
  if (r) r.disabled = history.future.length === 0;
}

const status = (t) => ($('#status').textContent = t);

/* ------------------------------------------------------------------ onglets */

function switchTab(name) {
  activeTab = name;
  $$('.tab').forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  $$('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === name));
}

$$('.tab').forEach((btn) => {
  if (btn.disabled) return;
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ------------------------------------------- formulaire « Informations » */

const INFO_PATHS = $$('[data-info]');

function getInfo(path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), project.info);
}

function setInfo(path, value) {
  const keys = path.split('.');
  let obj = project.info;
  keys.slice(0, -1).forEach((k) => {
    if (obj[k] == null) obj[k] = {};
    obj = obj[k];
  });
  obj[keys.at(-1)] = value;
}

function loadInfoForm() {
  for (const input of INFO_PATHS) {
    const path = input.dataset.info;
    const value = getInfo(path);
    input.value = value ?? '';
  }
  refreshTitleBlock();
}

INFO_PATHS.forEach((input) => {
  input.addEventListener('input', () => {
    setInfo(input.dataset.info, input.value);
    markDirty();
    refreshTitleBlock();
  });
});

function refreshTitleBlock() {
  const p = project.info;
  const place = [p.chantier.codePostal && p.chantier.localite].filter(Boolean).join(' ') || p.chantier.denomination || '—';
  $('#sheet-meta').textContent =
    `${p.chantier.denomination || 'Sans titre'} · ${place} · ${p.projet.typeAlim === 'TRI' ? 'triphasé' : 'monophasé'} · v${p.projet.version}`;
}

/* ------------------------------------------------------- liste des circuits */

function circuitIndexById(id) {
  return project.circuits.findIndex((c) => c.id === id);
}

function renderCircuitList() {
  const host = $('#circuit-list');
  host.innerHTML = '';  for (const c of project.circuits) {
    const row = document.createElement('div');
    row.className = 'circuit-item';
    row.dataset.circuit = c.id;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = c.name;
    name.title = 'Renommer (double-clic)';
    name.addEventListener('dblclick', () => renameCircuit(c.id));
    row.addEventListener('click', () => selectCircuit(c.id));

    const ph = document.createElement('span');
    ph.className = 'phases';
    ph.textContent = c.phases > 1 ? '3~' : '1~';

    const up = document.createElement('button');
    up.textContent = '↑';
    up.title = 'Monter';
    up.addEventListener('click', () => moveCircuit(c.id, -1));

    const down = document.createElement('button');
    down.textContent = '↓';
    down.title = 'Descendre';
    down.addEventListener('click', () => moveCircuit(c.id, +1));

    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'Supprimer le circuit';
    del.addEventListener('click', () => deleteCircuit(c.id));

    row.append(name, ph, up, down, del);
    host.appendChild(row);
  }
}

function renameCircuit(id) {
  const c = project.circuits[circuitIndexById(id)];
  if (!c) return;
  const value = prompt('Nom du circuit :', c.name);
  if (value == null) return;
  c.name = value.trim() || c.name;
  markDirty();
  refreshAll();
}

function moveCircuit(id, dir) {
  const i = circuitIndexById(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= project.circuits.length) return;
  [project.circuits[i], project.circuits[j]] = [project.circuits[j], project.circuits[i]];
  markDirty();
  refreshAll();
}

function deleteCircuit(id) {
  const c = project.circuits[circuitIndexById(id)];
  if (!c) return;
  if (!confirm(`Supprimer le circuit « ${c.name} » et ses ${c.components.length} composants ?`)) return;
  project.circuits.splice(circuitIndexById(id), 1);
  markDirty();
  refreshAll();
}

$('#btn-add-circuit').addEventListener('click', async () => {
  const res = await askCircuit();
  if (!res) return;
  const circuit = createCircuit(res.type, res.name || 'Circuit ' + (project.circuits.length + 1));
  project.circuits.push(circuit);
  selectCircuit(circuit.id);
  markDirty();
  status(`Circuit « ${circuit.name} » ajouté. Glissez-y des symboles.`);
});

/* ------------------------------------------------------------- liste BOM */

function circuitInfoText(c) {
  const type = (CIRCUIT_TYPES[c.typeKey] || {}).name || c.typeKey;
  return type + (c.phases > 1 ? ' · 3~' : '');
}

function renderBom() {
  const tbody = $('#bom-table tbody');
  const rows = [];

  for (const c of project.circuits) {
    for (const comp of c.components) {
      rows.push({
        label: comp.label,
        circuit: c.name,
        symbol: symbolName(comp.symbolType),
        detail: comp.detail || '—',
        phases: comp.phases > 1 ? '3~' : '1~',
        info: circuitInfoText(c),
        phase: c.phase || 'L1',
      });
    }
  }
  rows.sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }));

  tbody.innerHTML = rows
    .map((r) => `<tr><td>${escHtml(r.label)}</td><td>${escHtml(r.circuit)}</td><td>${escHtml(r.symbol)}</td>` +
      `<td>${escHtml(r.detail)}</td><td>${r.phases}</td><td>${escHtml(r.phase)}</td><td>${escHtml(r.info)}</td></tr>`)
    .join('');
  $('#bom-empty').hidden = rows.length > 0;
  $('#bom-table').hidden = rows.length === 0;
  $('#bom-count').textContent = rows.length ? `${rows.length} composants` : '';

  // Regroupement par symbole + caractéristique = base de la liste de matériel.
  const groups = new Map();
  for (const r of rows) {
    const key = r.symbol + '||' + r.detail;
    const g = groups.get(key) || { name: r.symbol, detail: r.detail, qty: 0, refs: [] };
    g.qty += 1;
    g.refs.push(r.label);
    groups.set(key, g);
  }
  const gRows = [...groups.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'fr'));
  const gt = $('#bom-grouped tbody');
  gt.innerHTML = gRows
    .map((g) => `<tr><td>${escHtml(g.name)}</td><td>${escHtml(g.detail)}</td><td>${g.qty}</td></tr>`)
    .join('');
  $('#bom-g-empty').hidden = gRows.length > 0;
  $('#bom-grouped').hidden = gRows.length === 0;
  $('#bom-groups').textContent = gRows.length ? `${gRows.length} désignations` : '';
}

$('#btn-bom-csv').addEventListener('click', async () => {
  const csv = await window.elecschema.exportCsv(buildBomCsv(), suggestedName() + '-composants');
  if (csv) status(`CSV exporté : ${csv}`);
});

function buildBomCsv() {
  const head = ['Repère', 'Circuit', 'Symbole', 'Caractéristique', 'Phases', 'Phase', 'Type'];
  const lines = [head.join(';')];
  const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  for (const c of project.circuits) {
    for (const comp of c.components) {
      lines.push([comp.label, c.name, symbolName(comp.symbolType), comp.detail || '',
        comp.phases > 1 ? '3~' : '1~', c.phase || 'L1', circuitInfoText(c)].map(q).join(';'));
    }
  }
  return lines.join('\r\n');
}

/* -------------------------------------------------------------- rendu global */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Panneau d'anomalies (règles RGIE) cliquable. */
function renderIssues() {
  const host = $('#issues');
  const issues = validate(project);
  if (project.circuits.length === 0) { host.hidden = true; host.innerHTML = ''; return; }
  const errs = issues.filter((i) => i.rule.severity === RULE_SEVERITY.ERROR);
  if (issues.length === 0) {
    host.hidden = false;
    host.innerHTML = `<span class="ok">✔ Aucune anomalie détectée (${RULES_BE.length} règles).</span>`;
    return;
  }
  host.hidden = false;
  host.innerHTML =
    `<div class="head">${errs.length} erreur(s) · ${issues.length - errs.length} avertissement(s)</div><ul>` +
    issues.map((i, n) =>
      `<li class="${i.rule.severity === 'erreur' ? 'err' : 'warn'}" data-issue="${n}">` +
      `<span class="sev">${i.rule.severity}</span>` +
      `<span>${escHtml(i.message)}<span class="src">${escHtml(i.rule.id)} · ${escHtml(i.rule.source)}</span></span></li>`
    ).join('') + '</ul>';

  host.querySelectorAll('[data-issue]').forEach((li) => {
    li.addEventListener('click', () => {
      const issue = issues[Number(li.dataset.issue)];
      if (issue.circuitId != null) { selectCircuit(issue.circuitId); }
      else status(`${issue.rule.severity.toUpperCase()} ${issue.rule.id} — ${issue.message}`);
    });
  });
}

function refreshAll() {
  renderCircuitList();
  renderBom();
  renderBalance();
  renderIssues();
  renderProps();
  const vb = `${view.x} ${view.y} ${view.w} ${view.h}`;
  renderSchema($('#canvas'), project, {
    viewBox: vb,
    selectedComponentId,
    selectedSupply,
  });
  refreshTitleBlock();
}

function clearDirty(file) {
  dirty = false;
  currentFile = file || null;
  $('#project-file').textContent = currentFile ? currentFile.split(/[\\/]/).pop() : 'sans titre';
  snapshot();
}

/* ----------------------------------------------------------- barre d'outils */

$('#btn-new').addEventListener('click', async () => {
  if (dirty && !confirm('Des modifications ne sont pas enregistrées. Créer un nouveau projet ?')) return;
  project = emptyProject();
  loadProject(project, null);
  status('Nouveau projet. Remplissez les informations d’installation.');
});

$('#btn-save').addEventListener('click', async () => {
  project.info.projet.dateModification = new Date().toISOString().slice(0, 10);
  const file = await window.elecschema.save(project);
  if (file) {
    await window.elecschema.openPath(file).catch(() => { /* ajout aux récents seul */ });
    loadRecents();
  }
  clearDirty(file);
  status(file ? `Enregistré : ${file}` : 'Enregistrement annulé.');
});

async function loadRecents() {
  const list = await window.elecschema.recents();
  const sel = $('#recent-select');
  sel.innerHTML = list.length
    ? '<option value="">— Projets récents —</option>' +
      list.map((r) => `<option value="${escHtml(r.path)}">${escHtml(r.name)}</option>`).join('')
    : '<option value="">(aucun projet récent)</option>';
}

$('#recent-select').addEventListener('change', async (e) => {
  const p = e.target.value;
  if (!p) return;
  if (dirty && !confirm('Des modifications ne sont pas enregistrées. Ouvrir un autre projet ?')) { e.target.value = ''; return; }
  try {
    const { filePath, data } = await window.elecschema.openPath(p);
    loadProject(data, filePath);
    status(`Projet ouvert : ${filePath}`);
  } catch (err) {
    alert(`Ouverture impossible.\n\n${p}\n\n${err.message}`);
    e.target.value = '';
  }
});

function loadProject(data, filePath) {
  const base = emptyProject();
  project = {
    ...base,
    ...data,
    supply: { ...base.supply, ...(data.supply || {}) },
    info: { ...base.info, ...(data.info || {}) },
  };
  syncIdCounter(project);
  loadInfoForm();
  selectedCircuitId = null;
  selectedComponentId = null;
  selectedSupply = false;
  history.past.length = 0;
  history.future.length = 0;
  updateHistoryButtons();
  clearDirty(filePath || null);
  refreshAll();
  switchTab('info');
}

$('#btn-undo').addEventListener('click', undo);
$('#btn-redo').addEventListener('click', redo);

$('#btn-open').addEventListener('click', async () => {
  if (dirty && !confirm('Des modifications ne sont pas enregistrées. Ouvrir un autre projet ?')) return;
  const res = await window.elecschema.open();
  if (!res) return;
  loadProject(res.data, res.filePath);
  loadRecents();
  status('Projet ouvert.');
});

$('#btn-pdf').addEventListener('click', async () => {
  if (project.circuits.length === 0) {
    alert('Ajoutez au moins un circuit avant d’exporter un PDF.');
    return;
  }
  const html = buildPrintHtml();
  const file = await window.elecschema.exportPdf(html, suggestedName());
  if (file) status(`PDF exporté : ${file}`);
});

function suggestedName() {
  const i = project.info;
  return [i.chantier.denomination || 'schema', i.chantier.localite, 'v' + i.projet.version]
    .filter(Boolean).join('-').replace(/[^\w\-\.À-ÿ]+/g, '_');
}

/** Page autonome pour l'impression : clone du SVG + en-tête. */
function buildPrintHtml() {
  const clone = $('#canvas').cloneNode(true);
  clone.querySelectorAll('.hit').forEach((n) => n.remove());
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.setAttribute('style', 'width:100%;height:auto');

  const i = project.info;
  const d = new Date(i.chantier.dateTravaux || Date.now());
  const date = d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-BE') : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${esc(i.chantier.denomination || 'Schéma unifilaire')}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: sans-serif; color:#111827; margin:0; }
  h1 { font-size:16px; margin:0 0 2px; }
  .sub { font-size:11px; color:#6b7280; margin-bottom:8px; }
  .wire { stroke:#111827; stroke-width:1.6; fill:none; }
  .bus { stroke:#111827; stroke-width:3; fill:none; }
  text { font-family: sans-serif; }
  .lbl { font-size:9px; fill:#374151; }
  .lbl-sm { font-size:8px; fill:#4b5563; }
</style></head><body>
<h1>Schéma unifilaire — installation domestique</h1>
<div class="sub">${esc(i.chantier.denomination || '')} · ${esc(i.chantier.adresse || '')}, ${esc(i.chantier.codePostal || '')} ${esc(i.chantier.localite || '')} · ${date} · version ${esc(i.projet.version)} · RGIE/AREI</div>
${clone.outerHTML}
</body></html>`;
}

/* ------------------------------------------------ palette RGIE & glisser-déposer */

function renderPalette() {
  const host = $('#palette-groups');
  host.innerHTML = SYMBOL_CATEGORIES.map((cat) => {
    const items = Object.entries(SYMBOLS)
      .filter(([, s]) => s.category === cat.id)
      .map(([key, s]) => {
        const thumb = `<svg viewBox="-6 -6 ${s.w + 12} ${s.h + 12}" xmlns="http://www.w3.org/2000/svg">${
          s.shape.replace(/stroke-width="2"/g, 'stroke-width="1.6"')
        }</svg>`;
        return `<button class="sym-btn" draggable="true" data-symbol="${key}" title="${escHtml(s.name)} (tableau 2.23 – ${s.ref})">
          ${thumb}<span class="sym-name">${escHtml(s.name)}</span></button>`;
      }).join('');
    return `<h4>${escHtml(cat.name)}</h4>${items}`;
  }).join('');

  host.querySelectorAll('.sym-btn').forEach((btn) => {
    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/x-elecschema-symbol', btn.dataset.symbol);
      e.dataTransfer.effectAllowed = 'copy';
    });
    // Clic = ajout au dernier circuit (raccourci sans glisser-déposer)
    btn.addEventListener('click', () => addComponentToLastCircuit(btn.dataset.symbol));
  });
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function addComponentToLastCircuit(type) {
  const circuit = project.circuits[project.circuits.length - 1];
  if (!circuit) { status('Créez d’abord un circuit.'); switchTab('schema'); return; }
  addComponent(circuit.id, type);
  switchTab('schema');
}

function addComponent(circuitId, symbolType) {
  const circuit = project.circuits.find((c) => c.id === circuitId);
  if (!circuit || !symbolType) return null;
  const comp = { id: nextId(), symbolType, label: nextLabel(circuit, symbolType), labelLocked: false, detail: '', phases: circuit.phases };
  if (isProtection(symbolType)) {
    comp.params = { rating: null, curve: 'C', icb: DEFAULT_ICB, diff: null };
  }
  circuit.components.push(comp);
  markDirty();
  return comp;
}

function nextLabel(circuit, symbolType) {
  const prefix = { breaker: 'Q', rcd: 'Q', fuse: 'F', switch: 'S', socket: 'X', light: 'E', kwh: 'W' }[symbolType] || 'C';
  const used = circuit.components
    .map((c) => c.label)
    .filter((l) => new RegExp('^' + prefix + '(\\d+)$').test(l))
    .map((l) => Number(l.slice(prefix.length)));
  const n = used.length ? Math.max(...used) + 1 : 1;
  return prefix + n;
}

/* ------------------------------------------------------- dépôt sur le canvas */

const canvasHost = $('#canvas-host');
const svgEl = $('#canvas');

canvasHost.addEventListener('dragover', (e) => {
  if (!e.dataTransfer.types.includes('text/x-elecschema-symbol')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  canvasHost.classList.add('drag-over');
});

canvasHost.addEventListener('dragleave', () => canvasHost.classList.remove('drag-over'));

canvasHost.addEventListener('drop', (e) => {
  e.preventDefault();
  canvasHost.classList.remove('drag-over');
  const type = e.dataTransfer.getData('text/x-elecschema-symbol');
  if (!type) return;
  const circuitId = circuitAt(e);
  if (circuitId == null) { status('Déposez le symbole à l’intérieur d’une colonne de circuit.'); return; }
  const comp = addComponent(circuitId, type);
  if (comp) { selectComponent(comp.id); status(`${symbolName(type)} ajouté (${comp.label}).`); }
});

/** Retourne l'id du circuit sous le curseur, sinon null. */
function circuitAt(e) {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svgEl.getScreenCTM().inverse());
  const cols = [...svgEl.querySelectorAll('.circuit-col')].reverse();
  const match = cols.find((g) => {
    const r = g.querySelector('rect.bg');
    const x = Number(r.getAttribute('x')), y = Number(r.getAttribute('y'));
    const w = Number(r.getAttribute('width')), h = Number(r.getAttribute('height'));
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  });
  return match ? Number(match.dataset.circuit) : null;
}

/* --------------------------------------------------- sélection de composant */

svgEl.addEventListener('click', (e) => {
  const supply = e.target.closest('[data-supply]');
  if (supply) { selectSupply(true); return; }
  const comp = e.target.closest('[data-comp]');
  if (comp) { selectSupply(false); selectComponent(Number(comp.dataset.comp)); return; }
  const circ = e.target.closest('[data-circuit]');
  if (circ) { selectSupply(false); selectCircuit(Number(circ.dataset.circuit)); return; }
  selectSupply(false);
  selectComponent(null);
});

/* -------------------------------------------------------------------- zoom */

const zoomLabel = $('#zoom-label');

function applyView() {
  const s = sheetSize(project);
  const pct = Math.round((s.w / view.w) * 100);
  zoomLabel.textContent = pct + ' %';
  refreshAll();
}

function zoomBy(factor, cx, cy) {
  const s = sheetSize(project);
  if (cx == null) { cx = view.x + view.w / 2; cy = view.y + view.h / 2; }
  const w = Math.min(s.w * 1.5, Math.max(300, view.w / factor));
  const h = (w / s.w) * s.h;
  const r = (view.w - w) / view.w;
  view.x += (cx - view.x) * r;
  view.y += (cy - view.y) * r;
  view.w = w;
  view.h = h;
  applyView();
}

svgEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svgEl.getScreenCTM().inverse());
  zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
}, { passive: false });

$('#btn-zoom-in').addEventListener('click', () => zoomBy(1.3));
$('#btn-zoom-out').addEventListener('click', () => zoomBy(1 / 1.3));
$('#btn-zoom-reset').addEventListener('click', () => {
  const s = sheetSize(project);
  view.x = 0; view.y = 0; view.w = s.w; view.h = s.h;
  applyView();
});

/* ---------------------------------------------------- déplacement (pan) */

let panning = null;
canvasHost.addEventListener('pointerdown', (e) => {
  if (e.button !== 1 && !(e.button === 0 && e.altKey)) return;
  panning = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, scale: svgEl.clientWidth / view.w };
  canvasHost.setPointerCapture(e.pointerId);
  e.preventDefault();
});
canvasHost.addEventListener('pointermove', (e) => {
  if (!panning) return;
  view.x = panning.vx - (e.clientX - panning.x) / panning.scale;
  view.y = panning.vy - (e.clientY - panning.y) / panning.scale;
  refreshAll();
});
canvasHost.addEventListener('pointerup', () => { panning = null; });

/* --------------------------------------------------- clavier : suppr / échap */

/* --------------------------------------------------- clavier : suppr / échap */

function isTyping(t) { return /INPUT|TEXTAREA|SELECT/.test(t.tagName); }

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;

  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 'c' && !isTyping(e.target)) { e.preventDefault(); copySelection(); return; }
  if (mod && e.key.toLowerCase() === 'v' && !isTyping(e.target)) { e.preventDefault(); pasteClipboard(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); $('#btn-save').click(); return; }
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); $('#btn-new').click(); return; }

  if (activeTab !== 'schema' || isTyping(e.target)) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedComponentId != null) {
    e.preventDefault();
    deleteSelectedComponent();
  }
  if (e.key === 'Escape') { selectComponent(null); }
});

function deleteSelectedComponent() {
  const id = selectedComponentId;
  if (id == null) return;
  for (const c of project.circuits) {
    const i = c.components.findIndex((x) => x.id === id);
    if (i >= 0) {
      const removed = c.components.splice(i, 1)[0];
      markDirty();
      selectComponent(null);
      status(`${symbolName(removed.symbolType)} supprimé.`);
      return;
    }
  }
}

/* ------------------------------------ sélection : circuit + panneau propriétés */

function selectedCircuit() {
  return project.circuits.find((c) => c.id === selectedCircuitId) || null;
}

function selectComponent(id, circuitId = null) {
  selectedComponentId = id;
  selectedSupply = false;
  if (id != null) {
    const c = project.circuits.find((x) => x.components.some((k) => k.id === id));
    if (c) selectedCircuitId = c.id;
  }
  refreshAll();
}

function selectCircuit(id) {
  selectedCircuitId = id;
  selectedComponentId = null;
  selectedSupply = false;
  refreshAll();
}

function selectSupply(on) {
  selectedSupply = !!on;
  if (selectedSupply) { selectedCircuitId = null; selectedComponentId = null; }
  refreshAll();
}

/** Affichage de l'équilibrage des phases. */
function renderBalance() {
  const host = $('#balance');
  const tri = project.info.projet.typeAlim === 'TRI';
  if (!tri || project.circuits.length === 0) { host.innerHTML = ''; return; }
  const b = phaseBalance(project);
  const vals = Object.values(b);
  const spread = Math.max(...vals) - Math.min(...vals);
  host.innerHTML = `<b>Répartition par phase</b><br>L1 ${b.L1} · L2 ${b.L2} · L3 ${b.L3}` +
    (spread > 1
      ? `<br><span class="warn">⚠ écart de ${spread} circuits entre phases : à rééquilibrer.</span>`
      : '<br>Équilibrage correct.');
}

function renderProps() {
  const circ = selectedCircuit();
  const comp = selectedComponentId != null
    ? circ?.components.find((x) => x.id === selectedComponentId) || null
    : null;

  $('#props-empty').hidden = !!(circ || comp || selectedSupply);
  $('#props-circuit').hidden = !circ || !!comp || selectedSupply;
  $('#props-component').hidden = !comp;
  $('#props-supply').hidden = !selectedSupply;

  if (circ) {
    $('#c-name').value = circ.name;
    $('#c-desc').value = circ.description || '';
    $('#c-type').value = circ.typeKey;
    $('#c-phases').value = String(circ.phases || 1);
    $('#c-phase').value = circ.phase || 'L1';
  }
  if (comp) {
    $('#p-type').value = symbolName(comp.symbolType);
    $('#p-label').value = comp.label;
    $('#p-locked').checked = !!comp.labelLocked;
    $('#p-detail').value = comp.detail || '';
    $('#p-phases').value = String(comp.phases || 1);
    const prot = isProtection(comp.symbolType);
    $('#p-prot-box').hidden = !prot;
    if (prot) {
      const p = comp.params || (comp.params = { rating: null, curve: 'C', icb: DEFAULT_ICB, diff: null });
      $('#p-prot-rating').value = p.rating == null ? '' : String(p.rating);
      $('#p-prot-curve').value = p.curve || 'C';
      $('#p-prot-diff').value = p.diff == null ? '' : String(p.diff);
      $('#p-prot-icb').value = p.icb ?? DEFAULT_ICB;
    }
  }
  if (selectedSupply) {
    $('#s-label').value = selectedSupply.label || '';
    $('#s-detail').value = selectedSupply.detail || '';
  }
}

/* ---- liaisons du panneau circuit ---- */
$('#c-name').addEventListener('input', (e) => {
  const c = selectedCircuit(); if (!c) return;
  c.name = e.target.value.trim() || c.name; markDirty(); refreshAll();
});
$('#c-desc').addEventListener('input', (e) => {
  const c = selectedCircuit(); if (!c) return;
  c.description = e.target.value; markDirty(); refreshAll();
});
$('#c-type').addEventListener('change', (e) => {
  const c = selectedCircuit(); if (!c) return;
  c.typeKey = e.target.value; markDirty(); refreshAll();
});
$('#c-phases').addEventListener('change', (e) => {
  const c = selectedCircuit(); if (!c) return;
  c.phases = Number(e.target.value) || 1;
  c.components.forEach((x) => { x.phases = c.phases; });
  markDirty(); refreshAll();
});
$('#c-phase').addEventListener('change', (e) => {
  const c = selectedCircuit(); if (!c) return;
  c.phase = e.target.value; markDirty(); refreshAll();
});

/* ---- liaisons du panneau composant ---- */
$('#p-label').addEventListener('input', (e) => {
  const comp = selectedComponent(); if (!comp) return;
  comp.label = e.target.value.trim() || comp.label; markDirty(); refreshAll();
});
$('#p-locked').addEventListener('change', (e) => {
  const comp = selectedComponent(); if (!comp) return;
  comp.labelLocked = e.target.checked; markDirty(); refreshAll();
});
$('#p-detail').addEventListener('input', (e) => {
  const comp = selectedComponent(); if (!comp) return;
  comp.detail = e.target.value.trim(); markDirty(); refreshAll();
});
$('#p-phases').addEventListener('change', (e) => {
  const comp = selectedComponent(); if (!comp) return;
  comp.phases = Number(e.target.value) || 1; markDirty(); refreshAll();
});
$('#p-prot-rating').addEventListener('change', (e) => {
  const comp = selectedComponent(); if (!comp) return;
  comp.params = comp.params || { rating: null, curve: 'C', icb: DEFAULT_ICB, diff: null };
  comp.params.rating = e.target.value === '' ? null : Number(e.target.value);
  markDirty(); refreshAll();
});
$('#p-prot-curve').addEventListener('change', (e) => {
  const comp = selectedComponent(); if (!comp) return;
  comp.params = comp.params || { rating: null, curve: 'C', icb: DEFAULT_ICB, diff: null };
  comp.params.curve = e.target.value; markDirty(); refreshAll();
});
$('#p-prot-diff').addEventListener('change', (e) => {
  const comp = selectedComponent(); if (!comp) return;
  comp.params = comp.params || { rating: null, curve: 'C', icb: DEFAULT_ICB, diff: null };
  comp.params.diff = e.target.value === '' ? null : Number(e.target.value);
  markDirty(); refreshAll();
});
$('#p-prot-icb').addEventListener('input', (e) => {
  const comp = selectedComponent(); if (!comp) return;
  comp.params = comp.params || { rating: null, curve: 'C', icb: DEFAULT_ICB, diff: null };
  comp.params.icb = Number(e.target.value) || DEFAULT_ICB; markDirty(); refreshAll();
});
$('#p-up').addEventListener('click', () => moveComponent(-1));
$('#p-down').addEventListener('click', () => moveComponent(+1));
$('#p-dup').addEventListener('click', duplicateSelectedComponent);
$('#p-del').addEventListener('click', deleteSelectedComponent);

/* ---- panneau élément d'arrivée ---- */
$('#s-label').addEventListener('input', (e) => {
  if (!selectedSupply) return;
  selectedSupply.label = e.target.value.trim() || 'W1'; markDirty(); refreshAll();
});
$('#s-detail').addEventListener('input', (e) => {
  if (!selectedSupply) return;
  selectedSupply.detail = e.target.value.trim(); markDirty(); refreshAll();
});

function selectedComponent() {
  const c = selectedCircuit();
  if (!c || selectedComponentId == null) return null;
  return c.components.find((x) => x.id === selectedComponentId) || null;
}

function moveComponent(dir) {
  const c = selectedCircuit(); if (!c) return;
  const i = c.components.findIndex((x) => x.id === selectedComponentId);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= c.components.length) return;
  [c.components[i], c.components[j]] = [c.components[j], c.components[i]];
  markDirty(); refreshAll();
}

function duplicateSelectedComponent() {
  const c = selectedCircuit(); if (!c) return;
  const i = c.components.findIndex((x) => x.id === selectedComponentId);
  if (i < 0) return;
  const src = c.components[i];
  const copy = { ...src, id: nextId(), label: nextLabel(c, src.symbolType), labelLocked: false };
  c.components.splice(i + 1, 0, copy);
  markDirty();
  selectComponent(copy.id);
  status(`Composant dupliqué (${copy.label}).`);
}

/* ------------------------------------------------ création de circuit typé */

function fillTypeSelect() {
  $('#c-type').innerHTML = Object.entries(CIRCUIT_TYPES)
    .map(([k, v]) => `<option value="${k}">${escHtml(v.name)}</option>`).join('');
}

/** Remplit les listes normalisées (calibres, différentiels). */
function fillProtectionLists() {
  $('#p-prot-rating').innerHTML =
    '<option value="">—</option>' + RATINGS.map((v) => `<option value="${v}">${v} A</option>`).join('');
  $('#p-prot-diff').innerHTML =
    '<option value="">aucun</option>' + RCD_VALUES.map((v) => `<option value="${v}">${v} mA</option>`).join('');
}

const dlg = $('#dialog');
let dlgResolve = null;

function closeDialog(value) {
  dlg.hidden = true;
  dlgResolve?.(value);
  dlgResolve = null;
}

$('#dialog-cancel').addEventListener('click', () => closeDialog(null));
$('#dialog-ok').addEventListener('click', () => {
  const name = dlg.querySelector('#dlg-name')?.value.trim();
  const type = dlg.querySelector('#dlg-type')?.value;
  closeDialog({ name: name || null, type: type || 'libre' });
});

async function askCircuit() {
  const types = Object.entries(CIRCUIT_TYPES)
    .map(([k, v]) => `<option value="${k}">${escHtml(v.name)}</option>`).join('');
  $('#dialog-title').textContent = 'Nouveau circuit';
  $('#dialog-body').innerHTML = `
    <label>Nom du circuit<input id="dlg-name" type="text" placeholder="ex. Prises séjour" autofocus></label>
    <label>Type (définit protection et section par défaut)<select id="dlg-type">${types}</select></label>`;
  dlg.hidden = false;
  $('#dlg-name')?.focus();
  return new Promise((res) => { dlgResolve = res; });
}

/* -------------------------------------------------- presse-papiers interne */

let clipboard = null;   // { kind:'component'|'circuit', data }
const PASTE_OFFSET = 0;

function copySelection() {
  const c = selectedCircuit(); if (!c) { status('Sélectionnez d’abord un circuit.'); return; }
  const comp = selectedComponentId != null
    ? c.components.find((x) => x.id === selectedComponentId) : null;

  if (comp) {
    clipboard = { kind: 'component', circuitId: c.id, data: JSON.parse(JSON.stringify(comp)) };
    status(`Symbole copié (${comp.label}).`);
  } else {
    clipboard = { kind: 'circuit', data: JSON.parse(JSON.stringify(c)) };
    status(`Circuit copié (${c.name}).`);
  }
}

function pasteClipboard() {
  if (!clipboard) { status('Rien à coller.'); return; }

  if (clipboard.kind === 'component') {
    const target = project.circuits.find((c) => c.id === selectedCircuitId)
      || project.circuits[project.circuits.length - 1];
    if (!target) { status('Créez d’abord un circuit.'); return; }
    const src = clipboard.data;
    const copy = {
      ...src,
      id: nextId(),
      label: nextLabel(target, src.symbolType),
      labelLocked: false,
    };
    target.components.push(copy);
    markDirty();
    selectComponent(copy.id);
    status(`Symbole collé dans « ${target.name} » (${copy.label}).`);
    return;
  }

  const src = clipboard.data;
  const copy = JSON.parse(JSON.stringify(src));
  const remap = new Map();
  copy.id = nextId();
  remap.set(src.id, copy.id);
  copy.name = src.name + ' (copie)';
  copy.components = (src.components || []).map((k) => {
    const n = nextId();
    remap.set(k.id, n);
    return { ...k, id: n, labelLocked: false };
  });
  project.circuits.push(copy);
  markDirty();
  selectCircuit(copy.id);
  status(`Circuit collé (${copy.name}).`);
}

/* -------------------------------------------------------------------- init */

renderPalette();
loadInfoForm();
fillTypeSelect();
loadRecents();
refreshAll();
updateHistoryButtons();
switchTab('info');
status('Prêt. Onglet « Informations sur l’installation » pour commencer.');
