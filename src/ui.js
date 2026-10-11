// Contrôleur d'interface : onglets, informations, palette, arbre d'éléments, BOM.
// Toute mutation du projet passe par markDirty() + refreshAll() pour rester synchronisé.

import { emptyProject, createElement, syncIdCounter, nodeById, treeOrder, nextId, PREFIXES } from './model.js';
import { renderSchema, sheetSize, deviceDetail } from './render.js';
import { SYMBOLS, SYMBOL_CATEGORIES, symbolName, symbolUrl, SOCKET_TYPES, DEFAULT_SOCKET_TYPE, SWITCH_TYPES, DEFAULT_SWITCH_TYPE } from './symbols.js';
import { validate, RULES_BE, RULE_SEVERITY } from './rules-be.js';
import { RATINGS, RCD_VALUES, RCD_RATINGS, DEFAULT_ICB, isProtection, anchorsOf, ANCHOR_DIRECTIONS, SECTIONS, CABLE_TYPES, MOUNT_TYPES, mountName, DEFAULT_CABLE } from './standards.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let project = emptyProject();
let currentFile = null;
let activeTab = 'info';
let dirty = false;
let selectedIds = new Set();  // sélection multiple (Maj + clic)
let selectedId = null;       // id d'élément (ou du compteur)
let pendingAnchor = null;    // { parentId, dir } en attente de symbole
let lastAddDir = null;       // direction du dernier ajout (les suivants suivent)
let lastAddId = null;        // id du dernier élément ajouté (tête de la chaîne)
let dragActive = false;      // glisser-déposer depuis la palette en cours
let view = { x: 0, y: 0, w: 2100, h: 1100 };

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Libellés de catégorie pour la liste BOM. */
const TYPE_LABELS = {
  compteur: 'Compteur', rcd: 'Différentiel', breaker: 'Disjoncteur', fuse: 'Fusible',
  sectionneur: 'Sectionneur', tableau: 'Tableau',
  node: 'Dérivation', socket: 'Prise', light: 'Éclairage', fluo: 'Éclairage',
  projector: 'Éclairage', emergency: 'Éclairage de sécurité', switch: 'Interrupteur',
  push: 'Bouton', heater: 'Chauffage', boiler: 'Chauffe-eau', fan: 'Ventilateur',
  bell: 'Sonnerie', motor: 'Moteur', kwh: 'Compteur', appliance: 'Appareil',
  transformer: 'Transformateur', solar: 'Source', earth: 'Terre',
  fil: 'Fil / câble',
};

/* --------------------------------------------------- historique (annuler/rétablir) */

const history = { past: [], future: [] };
let lastSnap = JSON.stringify(project);

function markDirty() {
  const snap = JSON.stringify(project);
  $('#project-file').textContent = (currentFile ? currentFile.split(/[\\/]/).pop() : 'sans titre') + ' • modifié';
  if (snap === lastSnap) return;
  history.past.push(lastSnap);
  if (history.past.length > 150) history.past.shift();
  history.future.length = 0;
  lastSnap = snap;
  dirty = true;
  updateHistoryButtons();
  persistSnapshot();
}

function snapshot() { lastSnap = JSON.stringify(project); }

function restore(snap) {
  project = JSON.parse(snap);
  syncIdCounter(project);
  loadInfoForm();
  refreshAll();
  persistSnapshot();
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

/* ------------------------------------------------------------- autosave (localStorage) */

const AUTOSAVE_KEY = 'elecschema.autosave';
const TAB_KEY = 'elecschema.tab';   // onglet actif, conservé au refresh

/** Persiste projet + fichier courant dans le localStorage (ne rien perdre au reload). */
function persistSnapshot() {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ project, file: currentFile }));
  } catch (err) {
    console.warn('Autosave impossible :', err);
  }
}

/** Recharge le dernier état enregistré dans le localStorage (si présent). */
function restoreAutosave() {
  let raw;
  try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch (err) { return; }
  if (!raw) return;
  try {
    const rec = JSON.parse(raw);
    if (!rec || !rec.project || !rec.project.supply || !Array.isArray(rec.project.elements)) return;
    loadProject(rec.project, rec.file || null);
    status('Restauration du dernier état (sauvegarde locale).');
  } catch (err) {
    console.warn('Autosave illisible, ignoré :', err);
  }
}

/* ------------------------------------------------------------------ onglets */

function switchTab(name) {
  activeTab = name;
  $$('.tab').forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  $$('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === name));
  try { localStorage.setItem(TAB_KEY, name); } catch (err) { /* ignore */ }
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
    const value = getInfo(input.dataset.info);
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

/* ------------------------------------------------------- arbre d'éléments */

function nodeOf(id) { return id != null ? nodeById(project, id) : null; }
function selectedNode() { return nodeOf(selectedId); }
const isSupplyId = (id) => project.supply && project.supply.id === id;

/** Points d'ancrage d'un élément encore utilisables.
 *  Règle : dès qu'un élément (hors node) a un enfant ancré, il n'accepte plus
 *  rien d'autre — pour continuer, insérer un node (qui, lui, reste ramifiable).
 *  Le compteur fait exception : ses points libres restent utilisables. */
function freeAnchorDirs(node) {
  const hasChild = node.children && Object.values(node.children).some((v) => v != null);
  // Le compteur n'a qu'un seul point d'ancrage : a droite.
  if (node.symbolType === 'compteur') return (node.children || {}).right == null ? ['right'] : [];
  const ramifiable = node.symbolType === 'node' || node.symbolType === 'tableau';
  if (hasChild && !ramifiable) return [];
  return anchorsOf(node.symbolType).filter((d) => (node.children || {})[d] == null);
}

/** Repère automatique global, unique par préfixe. */
function nextGlobalLabel(symbolType) {
  const prefix = PREFIXES[symbolType] || 'C';
  const re = new RegExp('^' + prefix + '(\\d+)$');
  let max = 0;
  for (const e of project.elements) {
    const m = re.exec(e.label || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + (max + 1);
}

/** Met dans l'ordre préféré : la direction du dernier ajout d'abord.
 *  Ainsi des ajouts successifs depuis la palette s'enchaînent dans le même sens. */
function dirsWithLast(dirs) {
  if (!lastAddDir || !dirs.includes(lastAddDir)) return dirs;
  return [lastAddDir, ...dirs.filter((d) => d !== lastAddDir)];
}

/** Cible d'ajout : ancrage choisi, sinon (dans cet ordre) l'élément sélectionné,
 *  le dernier élément ajouté, puis le compteur — en privilégiant `lastAddDir`. */
function resolveTarget() {
  if (pendingAnchor) return pendingAnchor;
  const pick = (parentId) => {
    const dirs = dirsWithLast(freeAnchorDirs(nodeOf(parentId) || project.supply));
    return dirs.length ? { parentId, dir: dirs[0] } : null;
  };
  const sel = selectedNode();
  if (sel) {
    const t = pick(sel.id);
    if (t) return t;
  }
  // l'élément sélectionné est saturé : on reprend à la tête de la chaîne
  if (lastAddId != null && lastAddId !== (sel && sel.id)) {
    const t = pick(lastAddId);
    if (t) return t;
  }
  const t = pick(project.supply.id);
  return t;
}

/** Orientation initiale d'un nouvel élément selon la direction de l'ancrage.
 *  Les symboles sont dessinés « conducteurs verticaux » : ils pivotent d'un quart
 *  de tour quand la liaison est horizontale. */
const ANCHOR_ORIENT = { right: 90, top: 0, left: -90, bottom: 180 };
function orientForDir(dir) {
  return ANCHOR_ORIENT[dir] ?? 0;
}

/** Types sans repère automatique : leur repère reste vide tant que l'utilisateur
 *  ne le saisit pas (le schéma n'affiche alors que la description). */
const NO_AUTO_LABEL = ['node', 'socket'];

/* --------------------------------------------------------- règles de composition */

/** Quels types d'élément chaque type peut recevoir en enfant.
 *  `null` = tout est accepté. Le node (dérivation) et le fil/câble sont hors règles. */
const ACCEPT_RULES = {
  compteur: ['rcd'],
  rcd: ['breaker', 'rcd'],
  breaker: null,
};

function canAccept(parentType, childType) {
  // point de derivation, cable, sectionneur et barre de tableau : hors regles
  if (childType === 'node' || childType === 'fil' || childType === 'sectionneur' || childType === 'tableau') return true;
  const allowed = ACCEPT_RULES[parentType];
  return allowed == null ? true : allowed.includes(childType);
}

function addElement(symbolType, parentId, dir) {
  const parent = nodeOf(parentId);
  if (!parent) return null;
  if ((parent.children || {})[dir] != null) { status('Ce point d’ancrage est déjà occupé.'); return null; }
  if (!canAccept(parent.symbolType, symbolType)) {
    status(`Un ${symbolName(parent.symbolType)} ne peut pas recevoir un ${symbolName(symbolType)}.`);
    return null;
  }
  const e = createElement(symbolType, parentId, dir);
  e.label = NO_AUTO_LABEL.includes(symbolType) ? '' : nextGlobalLabel(symbolType);
  // une barre de tableau reste horizontale par defaut (hors sens de pose)
  e.orient = symbolType === 'tableau' ? 0 : orientForDir(dir);
  parent.children = parent.children || {};
  parent.children[dir] = e.id;
  project.elements.push(e);
  selectedId = e.id;
  lastAddDir = dir;          // les prochains ajouts suivront cette direction
  lastAddId = e.id;          // le prochain élément s'accrochera au dernier ajouté
  noteUsage(symbolType);     // alimente les catégories « Récents »
  markDirty();
  refreshAll();
  return e;
}

function addViaPalette(symbolType) {
  const t = resolveTarget();
  pendingAnchor = null;
  if (!t) { status('Aucun point d’ancrage libre. Insérez un node.'); switchTab('schema'); return; }
  const e = addElement(symbolType, t.parentId, t.dir);
  switchTab('schema');
  if (e) status(`${symbolName(symbolType)} ajouté (${e.label}). Cliquez un « + » pour continuer.`);
}

/** Insère un node (point de dérivation) entre un parent et son enfant. */
function insertNode(parentId, dir) {
  const parent = nodeOf(parentId);
  if (!parent) return;
  const oldChildId = (parent.children || {})[dir] ?? null;
  const c = createElement('node', parentId, dir);
  c.orient = orientForDir(dir);
  parent.children = parent.children || {};
  parent.children[dir] = c.id;
  project.elements.push(c);
  if (oldChildId != null) {
    const old = nodeOf(oldChildId);
    const dirs = anchorsOf('node');
    const keep = dirs.includes(dir) ? dir : dirs[0];
    if (old) { c.children[keep] = old.id; old.parent = c.id; old.dir = keep; }
  }
  selectedId = c.id;
  markDirty();
  refreshAll();
  status('Node inséré. Ajoutez-y des éléments.');
  lastAddDir = dir;          // la chaîne continue dans le même sens
  lastAddId = c.id;
}

/** Supprime un élément ; ses enfants remontent au parent. */
function deleteElement(id) {
  const e = nodeOf(id);
  if (!e || isSupplyId(id)) return;
  const parent = nodeOf(e.parent);
  if (!parent) return;
  const myDir = e.dir;
  const parentAnchors = anchorsOf(parent.symbolType);
  parent.children = parent.children || {};

  const kids = [];
  for (const dir of ANCHOR_DIRECTIONS) {
    const cid = (e.children || {})[dir];
    if (cid != null) { const k = nodeOf(cid); if (k) kids.push({ child: k, dir }); }
  }
  delete parent.children[myDir];

  let promoted = null;
  const same = kids.find((k) => k.dir === myDir);
  if (same && parentAnchors.includes(myDir)) {
    parent.children[myDir] = same.child.id;
    same.child.parent = parent.id; same.child.dir = myDir;
    promoted = same.child;
    kids.splice(kids.indexOf(same), 1);
  }

  for (const k of kids) {
    let target = null, tdir = null;
    const pf = freeAnchorDirs(parent);
    if (pf.length) {
      target = parent;
      tdir = pf.includes(k.dir) ? k.dir : pf[0];
    }
    if (!target && promoted) {
      const pod = freeAnchorDirs(promoted);
      if (pod.length) { target = promoted; tdir = pod[0]; }
    }
    if (target) {
      target.children = target.children || {};
      target.children[tdir] = k.child.id;
      k.child.parent = target.id; k.child.dir = tdir;
    } else {
      removeSubtree(k.child.id);
    }
  }
  project.elements = project.elements.filter((x) => x.id !== id);
  if (selectedId === id) selectedId = null;
  markDirty();
  refreshAll();
  status('Élément supprimé.');
}

function removeSubtree(rootId) {
  const remove = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (remove.has(id)) continue;
    remove.add(id);
    const n = nodeOf(id);
    if (n) for (const dir of ANCHOR_DIRECTIONS) {
      const cid = (n.children || {})[dir];
      if (cid != null) stack.push(cid);
    }
  }
  project.elements = project.elements.filter((x) => !remove.has(x.id));
}

function elementListLabel(node) {
  if (node.symbolType === 'compteur') return '⚡ ' + (node.label || 'W1');
  if (node.symbolType === 'node') return '• node';
  const det = deviceDetail(node);
  return [node.label || '(sans repère)', symbolName(node.symbolType), det].filter(Boolean).join(' · ');
}

function renderElementList() {
  const host = $('#element-list');
  if (!host) return;
  host.innerHTML = '';
  const walk = (node, depth, out) => {
    out.push({ node, depth });
    for (const dir of ANCHOR_DIRECTIONS) {
      const cid = (node.children || {})[dir];
      if (cid != null) { const c = nodeOf(cid); if (c) walk(c, depth + 1, out); }
    }
  };
  const rows = [];
  walk(project.supply, 0, rows);
  for (const { node, depth } of rows) {
    const row = document.createElement('div');
    row.className = 'circuit-item' + (node.id === selectedId ? ' active' : '');
    const name = document.createElement('span');
    name.className = 'name';
    name.style.paddingLeft = depth * 10 + 'px';
    name.textContent = elementListLabel(node);
    row.appendChild(name);
    row.addEventListener('click', () => selectElement(node.id));
    if (!isSupplyId(node.id)) {
      const del = document.createElement('button');
      del.textContent = '✕';
      del.title = 'Supprimer';
      del.addEventListener('click', (ev) => { ev.stopPropagation(); deleteElement(node.id); });
      row.appendChild(del);
    }
    host.appendChild(row);
  }
}

/* ------------------------------------------------------------- liste BOM */

/** Libellé de symbole, en gérant les pseudo-symboles compteur/node. */
function symbolLabel(node) {
  if (node.symbolType === 'compteur') return 'Compteur';
  if (node.symbolType === 'node') return 'Node';
  return symbolName(node.symbolType);
}

function renderBom() {
  const tbody = $('#bom-table tbody');
  const nodes = treeOrder(project).filter((n) => n.symbolType !== 'node');
  const rows = nodes.map((node) => {
    const parent = nodeOf(node.parent);
    const parentLabel = parent ? (parent.label || (parent.symbolType === 'compteur' ? 'W1' : '—')) : '—';
    return {
      label: node.label || (node.symbolType === 'compteur' ? 'W1' : '—'),
      place: node.symbolType === 'compteur' ? '—' : parentLabel,
      symbol: symbolLabel(node),
      detail: node.symbolType === 'compteur' ? (node.detail || 'Compteur') : (deviceDetail(node) || '—'),
      type: TYPE_LABELS[node.symbolType] || node.symbolType,
    };
  });
  rows.sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr', { numeric: true }));

  tbody.innerHTML = rows
    .map((r) => `<tr><td>${escHtml(r.label)}</td><td>${escHtml(r.place)}</td><td>${escHtml(r.symbol)}</td>` +
      `<td>${escHtml(r.detail)}</td><td>${escHtml(r.type)}</td></tr>`)
    .join('');
  $('#bom-empty').hidden = rows.length > 0;
  $('#bom-table').hidden = rows.length === 0;
  $('#bom-count').textContent = rows.length ? `${rows.length} éléments` : '';

  const groups = new Map();
  for (const r of rows) {
    const key = r.symbol + '||' + r.detail;
    const g = groups.get(key) || { name: r.symbol, detail: r.detail, qty: 0 };
    g.qty += 1;
    groups.set(key, g);
  }
  const gRows = [...groups.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'fr'));
  $('#bom-grouped tbody').innerHTML = gRows
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
  const head = ['Repère', 'Emplacement', 'Symbole', 'Caractéristique', 'Type'];
  const lines = [head.join(';')];
  const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  for (const node of treeOrder(project)) {
    const parent = nodeOf(node.parent);
    const parentLabel = node.symbolType === 'compteur' ? '—'
      : (parent ? (parent.label || (parent.symbolType === 'compteur' ? 'W1' : '—')) : '—');
    lines.push([
      node.label || (node.symbolType === 'compteur' ? 'W1' : '—'),
      parentLabel,
      node.symbolType === 'node' ? 'Node' : symbolLabel(node),
      node.symbolType === 'compteur' ? (node.detail || 'Compteur') : (deviceDetail(node) || ''),
      TYPE_LABELS[node.symbolType] || node.symbolType,
    ].map(q).join(';'));
  }
  return lines.join('\r\n');
}

/* -------------------------------------------------------------- rendu global */

function renderIssues() {
  const host = $('#issues');
  const issues = validate(project);
  if ((project.elements || []).length === 0) { host.hidden = true; host.innerHTML = ''; return; }
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
      if (issue.elementId != null) { selectElement(issue.elementId); switchTab('schema'); }
      else status(`${issue.rule.severity.toUpperCase()} ${issue.rule.id} — ${issue.message}`);
    });
  });
}

function refreshAll() {
  renderElementList();
  renderBom();
  renderIssues();
  renderProps();
  renderRecents();
  refreshPaletteAccept();
  renderSchema($('#canvas'), project, {
    viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`,
    selectedIds,
    selectedId,
    showAnchors: dragActive,
  });
  refreshTitleBlock();
}

function clearDirty(file) {
  dirty = false;
  currentFile = file || null;
  $('#project-file').textContent = currentFile ? currentFile.split(/[\\/]/).pop() : 'sans titre';
  snapshot();
  persistSnapshot();
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

/** Convertit un ancien projet (circuits + différentiels) vers l'arbre d'éléments. */
function migrateProject(p) {
  if (Array.isArray(p.elements) && (p.schemaVersion || 0) >= 3) { delete p.circuits; delete p.difs; return; }
  const els = [];
  p.supply = p.supply || {};
  p.supply.symbolType = p.supply.symbolType || 'compteur';
  p.supply.children = { right: null };

  const mk = (type, parentId, dir) => {
    const e = { id: nextId(), symbolType: type, parent: parentId, dir, label: '', labelLocked: false, detail: '', children: {} };
    if (isProtection(type)) e.params = type === 'rcd' ? { rating: 40, diff: 30, type: 'AC' } : { rating: null, curve: 'C', icb: DEFAULT_ICB };
    if (type === 'socket') e.count = 1;
    return e;
  };
  const addEl = (type, parent, dir) => { const e = mk(type, parent.id, dir); parent.children[dir] = e.id; els.push(e); return e; };

  // Différentiels : chaînés depuis le compteur.
  let parent = p.supply;
  for (const d of p.difs || []) {
    const dir = parent === p.supply ? 'right' : (ANCHOR_DIRECTIONS.find((x) => parent.children[x] == null) || 'right');
    const e = addEl('rcd', parent, dir);
    e.label = d.label || '';
    e.params = d.params || { rating: 40, diff: 30, type: 'AC' };
    parent = e;
  }

  // Circuits : composants accrochés en série de nodes (3 emplacements + chaînage).
  let hub = addEl('node', p.supply, 'right');
  let slots = ['top', 'bottom', 'left'];
  let si = 0;
  const attach = (type, label, params, count) => {
    if (si >= slots.length) { hub = addEl('node', hub, 'right'); slots = ['top', 'bottom', 'left']; si = 0; }
    const dir = slots[si++];
    const e = addEl(type, hub, dir);
    e.label = label || '';
    if (params) e.params = params;
    if (count) e.count = count;
  };
  for (const c of p.circuits || []) {
    for (const comp of c.components || []) attach(comp.symbolType, comp.label, comp.params, comp.count);
  }

  p.elements = els;
  p.schemaVersion = 3;
  delete p.circuits;
  delete p.difs;
}

const LEGACY_SOCKETS = { socket: 'generic', socket_earth: 'earth', socket_switch: 'switch', socket_waterproof: 'waterproof' };
const LEGACY_SWITCHES = { switch_2way: 'two_way' };
const LEGACY_SYMBOLS = { carrefour: 'node' };

/** Ramène les anciens types éclatés (prises, interrupteurs) vers le type unique + sa propriété de type. */
function normalizeTypes(p) {
  for (const e of p.elements || []) {
    if (!e || !e.symbolType) continue;
    if (Object.prototype.hasOwnProperty.call(LEGACY_SYMBOLS, e.symbolType)) {
      e.symbolType = LEGACY_SYMBOLS[e.symbolType];
    }
    if (Object.prototype.hasOwnProperty.call(LEGACY_SOCKETS, e.symbolType)) {
      e.socketType = e.socketType || LEGACY_SOCKETS[e.symbolType];
      e.symbolType = 'socket';
    }
    if (Object.prototype.hasOwnProperty.call(LEGACY_SWITCHES, e.symbolType)) {
      e.switchType = e.switchType || LEGACY_SWITCHES[e.symbolType];
      e.symbolType = 'switch';
    }
    if (e.symbolType === 'socket') {
      if (!e.socketType) e.socketType = DEFAULT_SOCKET_TYPE;
      if (!e.count) e.count = 1;
      // plus de repère auto sur les prises : on ne garde que les repères saisis
      if (/^X\d+$/.test(e.label || '')) e.label = '';
    }
    if (e.symbolType === 'switch' && !e.switchType) e.switchType = DEFAULT_SWITCH_TYPE;
    // Un node n'a aucune propriété : on nettoie les anciens champs hérités.
    if (e.symbolType === 'node') {
      e.label = ''; e.labelLocked = false; e.detail = '';
      delete e.labelPos; delete e.showLabel; delete e.poles;
    }
  }
}

function loadProject(data, filePath) {
  const base = emptyProject();
  project = {
    ...base,
    ...data,
    supply: { ...base.supply, ...(data.supply || {}) },
    info: { ...base.info, ...(data.info || {}) },
  };
  syncIdCounter(project);
  migrateProject(project);
  normalizeTypes(project);
  syncIdCounter(project);
  loadInfoForm();
  selectedIds = new Set();
  selectedId = null;
  pendingAnchor = null;
  lastAddDir = null;
  lastAddId = null;
  history.past.length = 0;
  history.future.length = 0;
  updateHistoryButtons();
  clearDirty(filePath || null);
  refreshAll();
  switchTab('info');
  fitView();
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
  if ((project.elements || []).length === 0) {
    alert('Ajoutez au moins un élément avant d’exporter un PDF.');
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
  clone.querySelectorAll('.ui-only').forEach((n) => n.remove());
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.setAttribute('style', 'width:100%;height:auto');

  const i = project.info;
  const d = new Date(i.chantier.dateTravaux || Date.now());
  const date = d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-BE') : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${escHtml(i.chantier.denomination || 'Schéma unifilaire')}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: sans-serif; color:#111827; margin:0; }
  h1 { font-size:16px; margin:0 0 2px; }
  .sub { font-size:11px; color:#6b7280; margin-bottom:8px; }
  .wire { stroke:#111827; stroke-width:1.6; fill:none; }
  .bus { stroke:#111827; stroke-width:2; fill:none; }
  text { font-family: sans-serif; }
  .lbl { font-size:9px; fill:#374151; }
  .lbl-sm { font-size:8px; fill:#4b5563; white-space: pre-line; }
</style></head><body>
<h1>Schéma unifilaire — installation domestique</h1>
<div class="sub">${escHtml(i.chantier.denomination || '')} · ${escHtml(i.chantier.adresse || '')}, ${escHtml(i.chantier.codePostal || '')} ${escHtml(i.chantier.localite || '')} · ${date} · version ${escHtml(i.projet.version)} · RGIE/AREI</div>
${clone.outerHTML}
</body></html>`;
}

/* ------------------------------------------------ palette RGIE & glisser-déposer */

function renderPalette() {
  const host = $('#palette-groups');
  host.innerHTML = '<h4>Récents</h4><div id="palette-recents" class="palette-recents"></div>' +
    SYMBOL_CATEGORIES.map((cat) => {
    const items = Object.entries(SYMBOLS)
      .filter(([, s]) => s.category === cat.id)
      .map(([key]) => symBtnHtml(key))
      .join('');
    return `<h4>${escHtml(cat.name)}</h4>${items}`;
  }).join('');

  host.querySelectorAll('.sym-btn').forEach(bindSymBtn);
  refreshPaletteAccept();
}

/** HTML d'un bouton de symbole (palette, section Récents, menu contextuel). */
function symBtnHtml(key) {
  const s = SYMBOLS[key];
  if (!s) return '';
  const thumb = `<img class="sym-thumb" src="${symbolUrl(key)}" alt="">`;
  return `<button class="sym-btn" draggable="true" data-symbol="${key}" title="${escHtml(s.name)} (tableau 2.23 – ${s.ref})">
          ${thumb}<span class="sym-name">${escHtml(s.name)}</span></button>`;
}

/** Câble un bouton : glisser-déposer, clic, et ouverture du menu si ancrage en attente. */
function bindSymBtn(btn) {
  btn.addEventListener('dragstart', (e) => {
    dragActive = true;
    refreshAll();
    e.dataTransfer.setData('text/x-elecschema-symbol', btn.dataset.symbol);
    e.dataTransfer.effectAllowed = 'copy';
  });
  btn.addEventListener('click', () => addViaPalette(btn.dataset.symbol));
}

/** Remplit la section « Récents » : les 5 symboles les plus utilisés. */
function renderRecents() {
  const host = $('#palette-recents');
  if (!host) return;
  const list = topSymbols(5);
  if (!list.length) {
    host.innerHTML = '<p class="hint">Posez des éléments : les plus utilisés apparaîtront ici.</p>';
    return;
  }
  host.innerHTML = list.map(symBtnHtml).join('');
  host.querySelectorAll('.sym-btn').forEach(bindSymBtn);
}

/** Anti-erreur : grise dans la palette les symboles que la cible courante
 *  (ancrage cliqué ou élément sélectionné) n'a pas le droit de recevoir. */
function refreshPaletteAccept() {
  const target = pendingAnchor ? nodeOf(pendingAnchor.parentId) : selectedNode();
  document.querySelectorAll('.sym-btn').forEach((btn) => {
    btn.classList.toggle('nope', !!target && !canAccept(target.symbolType, btn.dataset.symbol));
  });
}

/* ------------------------------------------------------------ éléments récents */

const RECENT_KEY = 'elecschema.recent';   // { symbole: nombre d'ajouts }

function noteUsage(symbolType) {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
    raw[symbolType] = (raw[symbolType] || 0) + 1;
    localStorage.setItem(RECENT_KEY, JSON.stringify(raw));
  } catch (err) { /* ignore */ }
}

/** Les n symboles les plus utilisés dans l'installation : d'abord la fréquence
 *  dans le projet courant, puis — s'il y a moins de n types — l'historique
 *  d'ajouts pour compléter la liste. */
function topSymbols(n = 5) {
  const out = [];
  const seen = new Set();
  const counts = new Map();
  for (const e of project.elements) {
    if (e && e.symbolType) counts.set(e.symbolType, (counts.get(e.symbolType) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
  for (const [k] of sorted) { if (out.length >= n) break; out.push(k); seen.add(k); }
  if (out.length < n) {
    let hist = [];
    try { hist = Object.entries(JSON.parse(localStorage.getItem(RECENT_KEY) || '{}')); } catch (err) { /* ignore */ }
    hist.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
    for (const [k] of hist) {
      if (out.length >= n) break;
      if (!seen.has(k) && SYMBOLS[k]) { out.push(k); seen.add(k); }
    }
  }
  return out;
}

/* ------------------------------------------- menu contextuel sur un point d'ancrage */

const anchorMenu = $('#anchor-menu');
let menuGuard = false;   // évite la fermeture immédiate par le clic d'ouverture

function openAnchorMenu(clientX, clientY, parentId, dir) {
  const parent = nodeOf(parentId);
  if (!parent) return;
  const items = topSymbols(5).filter((k) => canAccept(parent.symbolType, k));
  if (!items.length) { status(`Un ${symbolName(parent.symbolType)} ne peut rien recevoir ici.`); return; }
  const list = anchorMenu.querySelector('.anchor-menu-list');
  list.innerHTML = items.map((k) => symBtnHtml(k)).join('');
  list.querySelectorAll('.sym-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.symbol;
      closeAnchorMenu();
      pendingAnchor = null;
      const el = addElement(type, parentId, dir);
      if (el) status(`${symbolName(type)} ajouté sur le point d’ancrage.`);
    });
  });
  anchorMenu.dataset.anchor = `${parentId}:${dir}`;
  anchorMenu.hidden = false;
  // positionne le menu au point cliqué, sans sortir de l'écran
  const r = anchorMenu.getBoundingClientRect();
  const x = Math.max(8, Math.min(clientX, window.innerWidth - r.width - 8));
  const y = Math.max(8, Math.min(clientY, window.innerHeight - r.height - 8));
  anchorMenu.style.left = x + 'px';
  anchorMenu.style.top = y + 'px';
  menuGuard = true;
  setTimeout(() => { menuGuard = false; }, 0);
}

function closeAnchorMenu() {
  if (!anchorMenu) return;
  anchorMenu.hidden = true;
  delete anchorMenu.dataset.anchor;
}

// un clic à l'extérieur (et Échap) ferme le menu
document.addEventListener('pointerdown', (e) => {
  if (anchorMenu.hidden || menuGuard) return;
  if (anchorMenu.contains(e.target)) return;
  closeAnchorMenu();
});

/* ------------------------------------------------------- dépôt sur le canvas */

const canvasHost = $('#canvas-host');
const svgEl = $('#canvas');
const zoomLabel = $('#zoom-label');

const baseSize = () => sheetSize(project);

function setView(v) {
  view = v;
  svgEl.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  zoomLabel.textContent = Math.round((baseSize().w / view.w) * 100) + ' %';
}

function fitView() {
  const s = baseSize();
  setView({ x: 0, y: 0, w: s.w, h: s.h });
}

function zoomAt(f, p = { x: view.x + view.w / 2, y: view.y + view.h / 2 }) {
  const w = Math.min(baseSize().w * 4, Math.max(120, view.w * f));
  const k = w / view.w;
  setView({ x: p.x - (p.x - view.x) * k, y: p.y - (p.y - view.y) * k, w, h: view.h * k });
}

function toWorld(e) {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const q = pt.matrixTransform(svgEl.getScreenCTM().inverse());
  return { x: q.x, y: q.y };
}

canvasHost.addEventListener('dragover', (e) => {
  if (!e.dataTransfer.types.includes('text/x-elecschema-symbol')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  canvasHost.classList.add('drag-over');
  const anchorEl = e.target.closest ? e.target.closest('[data-anchor]') : null;
  highlightAnchor(anchorEl || null);
});

canvasHost.addEventListener('dragleave', () => {
  canvasHost.classList.remove('drag-over');
  highlightAnchor(null);
});

function highlightAnchor(anchorEl) {
  for (const a of svgEl.querySelectorAll('[data-anchor].drop-hover')) a.classList.remove('drop-hover');
  if (anchorEl) anchorEl.classList.add('drop-hover');
}

canvasHost.addEventListener('drop', (e) => {
  e.preventDefault();
  canvasHost.classList.remove('drag-over');
  highlightAnchor(null);
  if (dragActive) { dragActive = false; refreshAll(); }
  const type = e.dataTransfer.getData('text/x-elecschema-symbol');
  if (!type) return;
  const anchorEl = e.target.closest ? e.target.closest('[data-anchor]') : null;
  if (!anchorEl) { status('Déposez le symbole sur un point d’ancrage (« + »).'); return; }
  const [pid, dir] = anchorEl.dataset.anchor.split(':');
  pendingAnchor = null;
  const el = addElement(type, Number(pid), dir);
  if (el) status(`${symbolName(type)} ajouté (${el.label}).`);
});

window.addEventListener('dragend', () => {
  if (!dragActive) return;
  dragActive = false;
  canvasHost.classList.remove('drag-over');
  highlightAnchor(null);
  refreshAll();
});

/* ------------------------------------------- sélection, pan, zoom (canvas) */

let gesture = null;

svgEl.addEventListener('pointerdown', (e) => {
  const anchorEl = e.target.closest('[data-anchor]');
  const linkEl = e.target.closest('[data-link]');
  const hit = e.target.closest('[data-el]');

  if (e.button === 1 || (e.button === 0 && (e.altKey || (!hit && !anchorEl && !linkEl)))) {
    gesture = { pan: true, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  } else if (e.button === 0 && anchorEl) {
    const [pid, dir] = anchorEl.dataset.anchor.split(':');
    selectedId = Number(pid);
    pendingAnchor = { parentId: Number(pid), dir };
    refreshAll();
    status('Point d’ancrage choisi — choisissez un symbole dans la palette.');
    openAnchorMenu(e.clientX, e.clientY, Number(pid), dir);
    e.preventDefault();
    return;
  } else if (e.button === 0 && linkEl) {
    const [pid, dir] = linkEl.dataset.link.split(':');
    insertNode(Number(pid), dir);
    e.preventDefault();
    return;
  } else if (e.button === 0 && hit) {
    gesture = { pan: false };
    const elId = Number(hit.dataset.el);
    if (e.shiftKey) toggleElement(elId);      // Maj + clic : sélection multiple
    else selectElement(elId);
  } else return;

  svgEl.setPointerCapture(e.pointerId);
  e.preventDefault();
});

svgEl.addEventListener('pointermove', (e) => {
  if (!gesture || !gesture.pan) return;
  const k = Math.max(view.w / svgEl.clientWidth, view.h / svgEl.clientHeight);
  const dx = e.clientX - gesture.x;
  const dy = e.clientY - gesture.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true;
  setView({ ...view, x: gesture.vx - dx * k, y: gesture.vy - dy * k });
});

svgEl.addEventListener('pointerup', (e) => {
  if (gesture && gesture.pan && !gesture.moved && e.button === 0) deselect();
  gesture = null;
  if (svgEl.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
});

svgEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.deltaY < 0 ? 0.85 : 1.18, toWorld(e));
}, { passive: false });

$('#btn-zoom-in').addEventListener('click', () => zoomAt(0.8));
$('#btn-zoom-out').addEventListener('click', () => zoomAt(1.25));
$('#btn-zoom-reset').addEventListener('click', fitView);

/* --------------------------------------------------- clavier : suppr / échap */

function isTyping(t) { return /INPUT|TEXTAREA|SELECT/.test(t.tagName); }

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;

  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); $('#btn-save').click(); return; }
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); $('#btn-new').click(); return; }

  if (activeTab !== 'schema' || isTyping(e.target)) return;
  if (e.key === 'Escape' && !anchorMenu.hidden) { closeAnchorMenu(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const ids = [...selectedIds].filter((id) => !isSupplyId(id));
    if (ids.length) {
      e.preventDefault();
      for (const id of ids) deleteElement(id);
      deselect();
      status(ids.length + ' element(s) supprime(s).');
    }
  } else if (e.key === 'Escape') {
    deselect();
  }
});

/* ------------------------------------ sélection + panneau propriétés */

function selectElement(id) {
  selectedIds = new Set(id == null ? [] : [id]);
  selectedId = id;
  pendingAnchor = null;
  refreshAll();
}

/** Maj + clic : ajoute ou retire l'élément de la sélection courante. */
function toggleElement(id) {
  if (id == null) return;
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  selectedId = selectedIds.size ? id : null;
  pendingAnchor = null;
  refreshAll();
}

function deselect() {
  selectedIds = new Set();
  selectedId = null;
  pendingAnchor = null;
  refreshAll();
}

function renderProps() {
  // sélection multiple : pas d'édition unitaire, on affiche juste le compte
  if (selectedIds.size > 1) {
    $('#props-element').hidden = true;
    $('#props-empty').hidden = false;
    $('#props-empty').textContent = selectedIds.size + ' éléments sélectionnés — Maj + clic pour en ajouter ou en retirer, Suppr pour supprimer.';
    return;
  }
  const node = selectedNode();
  $('#props-empty').hidden = !!node;
  $('#props-empty').textContent = 'Sélectionnez un élément.';
  $('#props-element').hidden = !node;
  if (!node) return;

  const supply = node.symbolType === 'compteur';
  const isNode = node.symbolType === 'node';
  $('#e-type').value = supply ? 'Compteur (arrivée)' : (isNode ? 'Node' : symbolName(node.symbolType));
  $('#e-label-lbl').hidden = isNode;
  $('#e-locked-lbl').hidden = isNode;
  $('#e-label').value = node.label || '';
  $('#e-locked').checked = !!node.labelLocked;
  $('#e-detail-lbl').hidden = !supply;
  $('#e-detail').value = node.detail || '';
  $('#e-orient-lbl').hidden = isNode;
  $('#e-orient').value = String(node.orient || 0);
  $('#e-labelpos-lbl').hidden = supply || isNode;
  $('#e-labelpos').value = node.labelPos || 'bottom';
  $('#e-labeloffset-lbl').hidden = isNode;
  const off = node.labelOffset == null ? -5 : Number(node.labelOffset);
  $('#e-labeloffset').value = String(off);
  $('#e-labeloffset-val').value = off + ' px';
  // orientation du texte : masquee pour un node et pour le compteur (texte fixe)
  $('#e-labelrot-lbl').hidden = supply || isNode;
  $('#e-labelrot').value = node.labelRot || 'auto';
  // option « Afficher le repère » : disponible sur chaque élément, false par défaut
  $('#e-showlabel-lbl').hidden = isNode;
  $('#e-showlabel').checked = node.showLabel === true;

  const prot = isProtection(node.symbolType);
  const isRcd = node.symbolType === 'rcd';
  const isFuse = node.symbolType === 'fuse';
  $('#e-prot-box').hidden = !prot;
  if (prot) {
    const p = node.params || (node.params = {});
    $('#e-rating-lbl').firstChild.textContent = isRcd ? 'Intensité nominale (A)' : 'Calibre (A)';
    $('#e-rating').innerHTML = '<option value="">—</option>' +
      (isRcd ? RCD_RATINGS : RATINGS).map((v) => `<option value="${v}">${v}</option>`).join('');
    $('#e-rating').value = p.rating == null ? '' : String(p.rating);
    $('#e-rcdtype-lbl').hidden = !isRcd;
    $('#e-rcdtype').value = p.type || 'AC';
    $('#e-diff-lbl').hidden = !isRcd;
    $('#e-diff').innerHTML = RCD_VALUES.map((v) => `<option value="${v}">${v} mA</option>`).join('');
    $('#e-diff').value = p.diff == null ? '30' : String(p.diff);
    $('#e-curve-lbl').hidden = isRcd || isFuse;
    $('#e-curve').value = p.curve || 'C';
    $('#e-icb-lbl').hidden = isRcd;
    $('#e-icb').value = p.icb ?? DEFAULT_ICB;
  }
  const isMcbRcd = node.symbolType === 'breaker' || node.symbolType === 'rcd';
  $('#e-poles-lbl').hidden = !isMcbRcd;
  if (isMcbRcd) {
    $('#e-poles').value = node.poles || (node.symbolType === 'rcd' ? '2P' : '1P');
  }
  const isSocket = node.symbolType === 'socket';
  $('#e-sockettype-lbl').hidden = !isSocket;
  if (isSocket) {
    $('#e-sockettype').innerHTML = SOCKET_TYPES.map((t) => `<option value="${t.key}">${t.name}</option>`).join('');
    $('#e-sockettype').value = node.socketType || DEFAULT_SOCKET_TYPE;
  }
  $('#e-count-lbl').hidden = !isSocket;
  if (isSocket) $('#e-count').value = node.count || 1;

  const isSwitch = node.symbolType === 'switch';
  $('#e-switchtype-lbl').hidden = !isSwitch;
  if (isSwitch) {
    $('#e-switchtype').innerHTML = SWITCH_TYPES.map((t) => `<option value="${t.key}">${t.name}</option>`).join('');
    $('#e-switchtype').value = node.switchType || DEFAULT_SWITCH_TYPE;
  }

  const isFil = node.symbolType === 'fil';
  $('#e-fil-box').hidden = !isFil;
  if (isFil) {
    const c = node.cable || (node.cable = { ...DEFAULT_CABLE });
    $('#e-fil-n').value = c.n ?? 3;
    $('#e-fil-terre').checked = !!c.terre;
    fillSel('#e-fil-section', SECTIONS.map((s) => [String(s), String(s).replace('.', ',') + ' mm²']), c.section ?? 2.5);
    fillSel('#e-fil-cable', CABLE_TYPES.map((t) => [t, t]), c.type || 'XVB');
    fillSel('#e-fil-montage', MOUNT_TYPES.map((m) => [m.key, m.name]), c.montage || 'encastre_conduit');
  }
}

/** Remplit un <select> une seule fois puis sélectionne la valeur. */
function fillSel(id, pairs, value) {
  const sel = $(id);
  if (!sel.options.length) sel.innerHTML = pairs.map(([v, text]) => `<option value="${escHtml(v)}">${escHtml(text)}</option>`).join('');
  sel.value = value;
}

$('#e-label').addEventListener('input', (e) => {
  const n = selectedNode(); if (!n) return;
  n.label = e.target.value; markDirty(); refreshAll();
});
$('#e-locked').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n) return;
  n.labelLocked = e.target.checked; markDirty(); refreshAll();
});
$('#e-detail').addEventListener('input', (e) => {
  const n = selectedNode(); if (!n) return;
  n.detail = e.target.value; markDirty(); refreshAll();
});
$('#e-orient').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n) return;
  n.orient = Number(e.target.value); markDirty(); refreshAll();
});
$('#e-labelpos').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n) return;
  n.labelPos = e.target.value; markDirty(); refreshAll();
});
$('#e-labeloffset').addEventListener('input', (e) => {
  const n = selectedNode(); if (!n) return;
  n.labelOffset = Number(e.target.value);
  $('#e-labeloffset-val').value = n.labelOffset + ' px';
  markDirty(); refreshAll();
});
$('#e-poles').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n) return;
  n.poles = e.target.value; markDirty(); refreshAll();
});
$('#e-labelrot').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n) return;
  n.labelRot = e.target.value; markDirty(); refreshAll();
});
$('#e-showlabel').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n) return;
  n.showLabel = e.target.checked;
  // si aucun repere n'existe encore, on en genere un pour que la case ait un effet visible
  if (n.showLabel && !(n.label || '').trim()) n.label = nextGlobalLabel(n.symbolType);
  markDirty(); refreshAll();
});
$('#e-rating').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || !n.params) return;
  n.params.rating = e.target.value === '' ? null : Number(e.target.value); markDirty(); refreshAll();
});
$('#e-rcdtype').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || !n.params) return;
  n.params.type = e.target.value; markDirty(); refreshAll();
});
$('#e-diff').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || !n.params) return;
  n.params.diff = e.target.value === '' ? null : Number(e.target.value); markDirty(); refreshAll();
});
$('#e-curve').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || !n.params) return;
  n.params.curve = e.target.value; markDirty(); refreshAll();
});
$('#e-icb').addEventListener('input', (e) => {
  const n = selectedNode(); if (!n || !n.params) return;
  n.params.icb = Number(e.target.value) || DEFAULT_ICB; markDirty(); refreshAll();
});
$('#e-count').addEventListener('input', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'socket') return;
  n.count = Math.max(1, Number(e.target.value) || 1); markDirty(); refreshAll();
});
$('#e-sockettype').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'socket') return;
  n.socketType = e.target.value; markDirty(); refreshAll();
});
$('#e-switchtype').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'switch') return;
  n.switchType = e.target.value; markDirty(); refreshAll();
});
$('#e-fil-n').addEventListener('input', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'fil') return;
  (n.cable || (n.cable = {})).n = Math.max(1, Number(e.target.value) || 1); markDirty(); refreshAll();
});
$('#e-fil-terre').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'fil') return;
  (n.cable || (n.cable = {})).terre = e.target.checked; markDirty(); refreshAll();
});
$('#e-fil-section').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'fil') return;
  (n.cable || (n.cable = {})).section = e.target.value === '' ? null : Number(e.target.value); markDirty(); refreshAll();
});
$('#e-fil-cable').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'fil') return;
  (n.cable || (n.cable = {})).type = e.target.value; markDirty(); refreshAll();
});
$('#e-fil-montage').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'fil') return;
  (n.cable || (n.cable = {})).montage = e.target.value; markDirty(); refreshAll();
});
$('#e-del').addEventListener('click', () => { if (selectedId != null && !isSupplyId(selectedId)) deleteElement(selectedId); });

$('#btn-add-node').addEventListener('click', () => {
  const t = resolveTarget();
  pendingAnchor = null;
  if (!t) { status('Aucun point d’ancrage libre.'); return; }
  insertNode(t.parentId, t.dir);
});

/* -------------------------------------------------------------------- init */

let savedTab = null;
try { savedTab = localStorage.getItem(TAB_KEY); } catch (err) { /* ignore */ }
restoreAutosave();
fitView();
renderPalette();
loadInfoForm();
loadRecents();
refreshAll();
updateHistoryButtons();
switchTab(['info', 'schema', 'bom'].includes(savedTab) ? savedTab : 'info');
status('Prêt. Onglet « Informations sur l’installation » pour commencer.');
