// Contrôleur d'interface : onglets, informations, palette, arbre d'éléments, BOM.
// Toute mutation du projet passe par markDirty() + refreshAll() pour rester synchronisé.

import { emptyProject, createElement, syncIdCounter, nodeById, treeOrder, nextId, PREFIXES, migrateProject, normalizeTypes, isCircuitStart, renumberCircuits, ensurePlan } from './model.js';
import { encodeElx, decodeElx, checkCompatibility, FILE_EXT, APP_VERSION, referencedAssets } from './format.js';
import { initPlan, refreshPlan, resetPlanView } from './plan-ui.js';
import { assetsObject, assetsReplace, saveAssetsIdb, loadAssetsIdb } from './plan-assets.js';
import { renderSchema, sheetSize, deviceDetail, PAGE, layoutForced, drawCartouche } from './render.js';
import { buildPlanPages } from './plan-print.js';
import { SYMBOLS, SYMBOL_CATEGORIES, symbolName, symbolUrl, SOCKET_TYPES, SWITCH_TYPES, DEFAULT_SOCKET_TYPE, DEFAULT_SWITCH_TYPE } from './symbols.js';
import { validate, RULES_BE, RULE_SEVERITY } from './rules-be.js';
import { DEFAULT_SCHEMA } from './default-schema.js';
import { RATINGS, CURVES, RCD_TYPES, RCD_VALUES, RCD_RATINGS, DEFAULT_ICB, isProtection, anchorKeysOf, baseDir, outputIndex, SECTIONS, CABLE_TYPES, MOUNT_TYPES, mountName, DEFAULT_CABLE, TABLEAU_OUTPUTS, TABLEAU_OUTPUT_TYPES } from './standards.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let project = emptyProject();
let currentFile = null;
let activeTab = 'info';
let dirty = false;
let selectedIds = new Set();  // sélection multiple (Maj + clic)
let selectedId = null;       // id d'élément (ou du compteur)
let pendingAnchor = null;    // { parentId, dir } en attente de symbole
let armedSymbol = null;      // symbole choisi dans la bibliothèque, posé sur chaque « + » cliqué
let dragActive = false;      // glisser-déposer depuis la palette en cours
let printPreview = false;    // mode mise en page (cadres A4 + panneau de mise en page)
let currentPage = 0;         // index de la page courante (sélectionnée dans la liste)
try { printPreview = localStorage.getItem('elecschema.printPreview') === '1'; } catch (err) { /* ignore */ }
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
let autosaveFileTimer = null;

function persistSnapshot() {
  const rec = JSON.stringify({ project, file: currentFile });
  try {
    localStorage.setItem(AUTOSAVE_KEY, rec);
  } catch (err) {
    console.warn('Autosave local impossible :', err);
  }
  // Miroir disque (bureau) : debounce 400 ms, jamais bloquant. Les images de fond
  // (seulement celles référencées) vont dans ce miroir ; en navigateur, dans IndexedDB.
  clearTimeout(autosaveFileTimer);
  if (typeof window.elexio?.autosaveWrite === 'function') {
    autosaveFileTimer = setTimeout(() => {
      const disk = JSON.stringify({ project, file: currentFile, assets: referencedAssets(project, assetsObject()) });
      window.elexio.autosaveWrite(disk).catch((err) => console.warn('Autosave disque impossible :', err));
    }, 400);
  } else {
    autosaveFileTimer = setTimeout(() => {
      saveAssetsIdb(referencedAssets(project, assetsObject())).then((ok) => {
        if (!ok) status('Fonds de plan non sauvegardés (stockage navigateur indisponible).');
      });
    }, 400);
  }
}

function getLocalAutosave() {
  let raw;
  try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch (err) { raw = null; }
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw);
    if (rec && rec.project && rec.project.supply && Array.isArray(rec.project.elements)) {
      return { project: rec.project, file: rec.file || null };
    }
  } catch (err) {
    console.warn('Autosave local illisible, ignoré :', err);
  }
  return null;
}

async function getDiskAutosave() {
  if (typeof window.elexio?.autosaveRead !== 'function') return null;
  try {
    const rawFile = await window.elexio.autosaveRead();
    if (!rawFile) return null;
    const rec = JSON.parse(rawFile);
    if (rec && rec.project && rec.project.supply && Array.isArray(rec.project.elements)) {
      return { project: rec.project, file: rec.file || null, assets: rec.assets || {} };
    }
  } catch (err) {
    console.warn('Autosave disque illisible, ignoré :', err);
  }
  return null;
}

async function renderWelcomeRecents() {
  const wrap = $('#welcome-recents-wrap');
  const listEl = $('#welcome-recents');
  if (!wrap || !listEl) return;
  if (typeof window.elexio !== 'object') {
    wrap.hidden = false;
    listEl.innerHTML = '<div style="color:var(--muted);font-size:12px;">Version navigateur : récents non disponibles.</div>';
    return;
  }
  const list = await window.elexio.recents();
  if (!list || list.length === 0) {
    wrap.hidden = true;
    listEl.innerHTML = '';
    return;
  }
  wrap.hidden = false;
  listEl.innerHTML = list.slice(0, 6).map((r) => {
    const name = escHtml(r.name);
    const path = escHtml(r.path);
    return `<button class="welcome-recent" data-path="${path}"><span class="welcome-recent-name">${name}</span><span class="welcome-recent-path">${path}</span></button>`;
  }).join('');
  listEl.querySelectorAll('.welcome-recent').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = btn.getAttribute('data-path');
      if (!p) return;
      if (typeof window.elexio !== 'object') return;
      if (dirty && !confirm('Des modifications ne sont pas enregistrées. Ouvrir un autre projet ?')) return;
      try {
        const res = await window.elexio.openPath(p);
        if (importProjectText(res.text, res.filePath)) {
          await loadRecents();
        }
      } catch (err) {
        alert(`Ouverture impossible.\n\n${p}\n\n${err.message}`);
      }
    });
  });
}

async function showWelcome() {
  const resumeBtn = $('#welcome-resume');
  const welcomeEl = $('#welcome');
  if (!welcomeEl) return;

  // Détermine s'il y a un autosave à proposer
  let pending = getLocalAutosave();
  if (!pending) {
    pending = await getDiskAutosave();
  }
  if (resumeBtn) {
    if (pending) {
      const name = pending.file ? pending.file.split(/[\\/]/).pop() : 'sans titre';
      resumeBtn.textContent = `Reprendre « ${name} »`;
      resumeBtn.hidden = false;
      resumeBtn.onclick = async () => {
        const assets = pending.assets ?? (await loadAssetsIdb()) ?? {};
        loadProject(pending.project, pending.file, assets);
        status('Restauration du dernier état (sauvegarde locale/stockage).');
      };
    } else {
      resumeBtn.hidden = true;
      resumeBtn.onclick = null;
    }
  }

  const newBtn = $('#welcome-new');
  if (newBtn) {
    newBtn.onclick = () => {
      const seed = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
      const today = new Date().toISOString().slice(0, 10);
      seed.info.projet.dateCreation = today;
      seed.info.projet.dateModification = today;
      loadProject(seed, null);
      status('Nouveau projet pré-rempli. Remplissez les informations d’installation.');
    };
  }

  const openBtn = $('#welcome-open');
  if (openBtn) {
    openBtn.onclick = () => {
      $('#btn-open').click();
    };
  }

  await renderWelcomeRecents();
  welcomeEl.hidden = false;
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
  refreshPlan();
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
  return anchorKeysOf(node).filter((d) => (node.children || {})[d] == null);
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

/** Orientation initiale d'un nouvel élément selon la direction de l'ancrage.
 *  Les symboles sont dessinés « conducteurs verticaux » : ils pivotent d'un quart
 *  de tour quand la liaison est horizontale. */
const ANCHOR_ORIENT = { right: 90, top: 0, left: -90, bottom: 180 };
function orientForDir(dir) {
  return ANCHOR_ORIENT[baseDir(dir)] ?? 0;
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

/** Retire le point d'ancrage `key` d'un tableau : les points suivants sont décalés d'un cran. */
function removeOutput(node, key) {
  const idx = outputIndex(key);
  const kept = {};
  for (const k of Object.keys(node.children || {})) {
    const cid = node.children[k];
    const i = outputIndex(k);
    if (cid == null || i === idx) continue;
    const nk = i > idx ? 'top-' + i : k;
    kept[nk] = cid;
    const c = nodeOf(cid);
    if (c) c.dir = nk;
  }
  node.children = kept;
}

/** Toujours une sortie vierge après la dernière occupée : le tableau s'élargit ou se réduit. */
function syncOutputs() {
  for (const e of project.elements) {
    if (e.symbolType !== 'tableau') continue;
    const used = Object.keys(e.children || {}).filter((k) => e.children[k] != null).map(outputIndex);
    e.outputs = Math.max(TABLEAU_OUTPUTS, ...used.map((i) => i + 2));
  }
}

function canAccept(parentType, childType, dir) {
  // tableau : seulement différentiels, disjoncteurs et sectionneurs en sortie
  if (parentType === 'tableau') {
    if (dir === 'bottom') return childType === 'earth';
    return TABLEAU_OUTPUT_TYPES.includes(childType);
  }
  // point de derivation, cable, sectionneur et barre de tableau : hors regles
  if (childType === 'node' || childType === 'fil' || childType === 'sectionneur' || childType === 'tableau') return true;
  const allowed = ACCEPT_RULES[parentType];
  return allowed == null ? true : allowed.includes(childType);
}

/* ------------------------------------------- propriétés demandées à l'ajout */

/** Champ « repère » commun aux invites : vide = repère automatique. */
const REPERE_FIELD = { key: 'label', label: 'Repère', text: true, value: '', placeholder: 'automatique' };

/** Questions posées à l'ajout (défauts Trikker). `build` traduit les réponses en propriétés. */
const PROMPTS = {
  breaker: {
    title: 'Disjoncteur',
    fields: [
      REPERE_FIELD,
      { key: 'rating', label: 'Calibre', num: true, value: 16, options: RATINGS.map((v) => ({ value: v, label: v + ' A' })) },
      { key: 'curve', label: 'Courbe', value: 'C', options: CURVES.map((v) => ({ value: v, label: v })) },
      { key: 'poles', label: 'Pôles', value: '2P', options: ['1P', '2P', '3P', '4P'].map((v) => ({ value: v, label: v })) },
    ],
    build: (d) => ({ label: d.label, poles: d.poles, params: { rating: d.rating, curve: d.curve } }),
  },
  rcd: {
    title: 'Différentiel',
    fields: [
      REPERE_FIELD,
      { key: 'diff', label: 'Sensibilité', num: true, value: 30, options: RCD_VALUES.map((v) => ({ value: v, label: v + ' mA' })) },
      { key: 'rating', label: 'Intensité nominale', num: true, value: 63, options: RCD_RATINGS.map((v) => ({ value: v, label: v + ' A' })) },
      { key: 'type', label: 'Type', value: 'AC', options: RCD_TYPES.map((v) => ({ value: v, label: v })) },
      { key: 'poles', label: 'Pôles', value: '2P', options: ['2P', '4P'].map((v) => ({ value: v, label: v })) },
    ],
    build: (d) => ({ label: d.label, poles: d.poles, params: { diff: d.diff, rating: d.rating, type: d.type } }),
  },
  socket: {
    title: 'Type de prise',
    fields: [
      REPERE_FIELD,
      { key: 'socketType', label: 'Type de prise', value: DEFAULT_SOCKET_TYPE, options: SOCKET_TYPES.map((t) => ({ value: t.key, label: t.name })) },
    ],
    build: (d) => ({ label: d.label, socketType: d.socketType }),
  },
  switch: {
    title: 'Type d’interrupteur',
    fields: [
      REPERE_FIELD,
      { key: 'switchType', label: 'Type d’interrupteur', value: DEFAULT_SWITCH_TYPE, options: SWITCH_TYPES.map((t) => ({ value: t.key, label: t.name })) },
    ],
    build: (d) => ({ label: d.label, switchType: d.switchType }),
  },
};

/** Ouvre la boîte de dialogue. Résout { propriétés } ou null si annulé. */
function askProps(symbolType) {
  const cfg = PROMPTS[symbolType];
  const dlg = $('#prop-dialog');
  const form = $('#prop-form');
  $('#prop-title').textContent = cfg.title;
  $('#prop-fields').innerHTML = cfg.fields.map((f) => (f.text
    ? `<label class="prop-field"><span>${escHtml(f.label)}</span>
      <input type="text" name="${f.key}" value="${escHtml(f.value)}" placeholder="${escHtml(f.placeholder || '')}" autocomplete="off">
    </label>`
    : `<label class="prop-field"><span>${escHtml(f.label)}</span>
      <select name="${f.key}">${f.options.map((o) => `<option value="${escHtml(o.value)}"${String(o.value) === String(f.value) ? ' selected' : ''}>${escHtml(o.label)}</option>`).join('')}</select>
    </label>`)).join('');
  return new Promise((resolve) => {
    const onClose = () => {
      dlg.removeEventListener('close', onClose);
      if (dlg.returnValue !== 'ok') { resolve(null); return; }
      const data = {};
      for (const f of cfg.fields) {
        const raw = form.elements[f.key].value;
        data[f.key] = f.num ? Number(raw) : raw;
      }
      resolve(cfg.build(data));
    };
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

/** Propriétés à demander avant de poser `type` sous `parentId`. `{}` si rien à demander
 *  (ou si la pose est impossible : addElement signalera l'erreur), `null` si annulé. */
async function promptFor(type, parentId) {
  const parent = nodeOf(parentId);
  if (!PROMPTS[type] || !parent || !canAccept(parent.symbolType, type, null)) return {};
  return askProps(type);
}

/** Applique les propriétés demandées à un élément nouvellement créé. */
function applyProps(e, p) {
  if (!p) return;
  // repère saisi : verrouillé (la numérotation automatique ne le modifie pas)
  if (p.label && p.label.trim()) { e.label = p.label.trim(); e.labelLocked = true; e.showLabel = true; }
  if (p.poles) e.poles = p.poles;
  if (p.params) e.params = { ...(e.params || {}), ...p.params };
  if (p.socketType) e.socketType = p.socketType;
  if (p.switchType) e.switchType = p.switchType;
}

async function addWithProps(type, parentId, dir) {
  const props = await promptFor(type, parentId);
  if (props === null) { status('Ajout annulé.'); return null; }
  return addElement(type, parentId, dir, props);
}

function addElement(symbolType, parentId, dir, props = null) {
  const parent = nodeOf(parentId);
  if (!parent) return null;
  if ((parent.children || {})[dir] != null) { status('Ce point d’ancrage est déjà occupé.'); return null; }
  if (!canAccept(parent.symbolType, symbolType, dir)) {
    status(`Un ${symbolName(parent.symbolType)} ne peut pas recevoir un ${symbolName(symbolType)}.`);
    return null;
  }
  const e = createElement(symbolType, parentId, dir);
  e.label = NO_AUTO_LABEL.includes(symbolType) ? '' : nextGlobalLabel(symbolType);
  if (isCircuitStart(project, e)) e.showLabel = true;
  applyProps(e, props);
  // une barre de tableau reste horizontale par defaut (hors sens de pose)
  e.orient = symbolType === 'tableau' ? 0 : orientForDir(dir);
  parent.children = parent.children || {};
  parent.children[dir] = e.id;
  project.elements.push(e);
  selectedId = e.id;
  selectedIds = new Set([e.id]);
  markDirty();
  refreshAll();
  return e;
}

/** Bibliothèque : choisit (ou désarme, si déjà choisi) le symbole posé sur les « + ». */
function setArmed(type) {
  armedSymbol = type;
  pendingAnchor = null;
  switchTab('schema');
  if (type) status(`${symbolName(type)} sélectionné : cliquez un « + » orange. Échap pour arrêter.`);
  else status('Sélection annulée.');
  refreshAll();
}

function addViaPalette(symbolType) {
  setArmed(armedSymbol === symbolType ? null : symbolType);
}

/** Insère un élément entre un parent et son enfant (node par défaut, ou symbole armé). */
function insertNode(parentId, dir, type = 'node', props = null) {
  const parent = nodeOf(parentId);
  if (!parent) return;
  const oldChildId = (parent.children || {})[dir] ?? null;
  const old = oldChildId != null ? nodeOf(oldChildId) : null;
  if (!canAccept(parent.symbolType, type, dir)) { status(`Un ${symbolName(parent.symbolType)} ne peut pas recevoir un ${symbolName(type)}.`); return; }
  if (old && !canAccept(type, old.symbolType, baseDir(dir))) { status(`Un ${symbolName(type)} ne peut pas recevoir un ${symbolName(old.symbolType)}.`); return; }
  const c = createElement(type, parentId, dir);
  c.orient = type === 'tableau' ? 0 : orientForDir(dir);
  c.label = NO_AUTO_LABEL.includes(type) ? '' : nextGlobalLabel(type);
  if (isCircuitStart(project, c)) c.showLabel = true;
  applyProps(c, props);
  parent.children = parent.children || {};
  parent.children[dir] = c.id;
  project.elements.push(c);
  if (old) {
    const keep = type === 'tableau' ? 'top-1' : baseDir(dir);
    c.children[keep] = old.id; old.parent = c.id; old.dir = keep;
  }
  selectedId = c.id;
  selectedIds = new Set([c.id]);
  markDirty();
  refreshAll();
  if (type !== 'node') { status(`${symbolName(type)} inséré dans la ligne.`); return; }
  status('Node inséré. Ajoutez-y des éléments.');
}

/** Supprime un élément ; ses enfants remontent au parent. */
function deleteElement(id) {
  const e = nodeOf(id);
  if (!e || isSupplyId(id)) return;
  const parent = nodeOf(e.parent);
  if (!parent) return;
  const myDir = e.dir;
  const parentAnchors = anchorKeysOf(parent);
  parent.children = parent.children || {};

  const kids = [];
  for (const dir of Object.keys(e.children || {})) {
    const cid = e.children[dir];
    if (cid != null) { const k = nodeOf(cid); if (k) kids.push({ child: k, dir }); }
  }
  // tableau : le point d'ancrage disparaît avec son élément ; les sorties suivantes remontent
  if (parent.symbolType === 'tableau') {
    removeOutput(parent, myDir);
    for (const k of kids) {
      if (!canAccept('tableau', k.child.symbolType, k.dir)) { removeSubtree(k.child.id); continue; }
      const used = Object.keys(parent.children).map(outputIndex);
      const key = 'top-' + ((used.length ? Math.max(...used) : -1) + 2);
      parent.children[key] = k.child.id; k.child.parent = parent.id; k.child.dir = key;
    }
    project.elements = project.elements.filter((x) => x.id !== id);
    selectOnly(parent.id);
    markDirty();
    refreshAll();
    status('Point d’ancrage supprimé avec son élément.');
    return parent.id;
  }

  delete parent.children[myDir];

  let promoted = null;
  const same = kids.find((k) => k.dir === myDir);
  if (same && parentAnchors.includes(myDir) && (parent.symbolType !== 'tableau' || canAccept('tableau', same.child.symbolType, myDir))) {
    parent.children[myDir] = same.child.id;
    same.child.parent = parent.id; same.child.dir = myDir;
    promoted = same.child;
    kids.splice(kids.indexOf(same), 1);
  }

  for (const k of kids) {
    let target = null, tdir = null;
    const pf = parent.symbolType === 'tableau' && !canAccept('tableau', k.child.symbolType, k.dir) ? [] : freeAnchorDirs(parent);
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
  selectOnly(parent.id);
  markDirty();
  refreshAll();
  status('Élément supprimé.');
  return parent.id;
}

/** Sélectionne uniquement `id` (null = aucune sélection). */
function selectOnly(id) {
  selectedId = id;
  selectedIds = new Set(id == null ? [] : [id]);
  pendingAnchor = null;
}

function removeSubtree(rootId) {
  const remove = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (remove.has(id)) continue;
    remove.add(id);
    const n = nodeOf(id);
    if (n) for (const dir of Object.keys(n.children || {})) {
      const cid = n.children[dir];
      if (cid != null) stack.push(cid);
    }
  }
  project.elements = project.elements.filter((x) => !remove.has(x.id));
}

function renderElementList() {
  const ta = $('#schema-json');
  if (!ta) return;
  ta.value = JSON.stringify(project, null, 2);
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

/* -------------------------------------------------------------- rendu global */

function renderIssues() {
  const host = $('#issues');
  const issues = validate(project);
  if ((project.elements || []).length === 0) { host.hidden = true; host.innerHTML = ''; return; }
  const errs = issues.filter((i) => i.rule.severity === RULE_SEVERITY.ERROR);
  const forced = layoutForced(project);   // plafond de mise en page atteint (tracé contraint)
  if (issues.length === 0 && !forced) {
    host.hidden = false;
    host.innerHTML = `<span class="ok">✔ Aucune anomalie détectée (${RULES_BE.length} règles).</span>`;
    return;
  }
  host.hidden = false;
  const warnings = issues.length - errs.length + (forced ? 1 : 0);
  const forcedLi = forced
    ? '<li class="warn"><span class="sev">avertissement</span>'
      + '<span>Tracé contraint : la mise en page a atteint son plafond, certains symboles peuvent se chevaucher.'
      + '<span class="src">Mise en page</span></span></li>'
    : '';
  host.innerHTML =
    `<div class="head">${errs.length} erreur(s) · ${warnings} avertissement(s)</div><ul>${forcedLi}` +
    issues.map((i, n) =>
      `<li class="${i.rule.severity === 'erreur' ? 'err' : 'warn'}" data-issue="${n}">` +
      `<span class="sev">${i.rule.severity}</span>` +
      `<span>${escHtml(i.message)}<span class="src">${escHtml(i.rule.id)} · ${escHtml(i.rule.source)}</span></span></li>`
    ).join('') + '</ul>';

  host.querySelectorAll('[data-issue]').forEach((li) => {
    li.addEventListener('click', () => {
      const issue = issues[Number(li.dataset.issue)];
      if (issue.rule.id === 'BE-09') { switchTab('plan'); }
      else if (issue.elementId != null) { selectElement(issue.elementId); switchTab('schema'); }
      else status(`${issue.rule.severity.toUpperCase()} ${issue.rule.id} — ${issue.message}`);
    });
  });
}

function refreshAll() {
  ensurePlan(project);   // nettoie les placements orphelins (élément supprimé du schéma)
  syncOutputs();
  renumberCircuits(project);
  renderElementList();
  renderBom();
  renderIssues();
  renderProps();
  refreshPaletteAccept();
  refreshPlan();
  renderSchema($('#canvas'), project, {
    viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`,
    selectedIds,
    selectedId,
    showAnchors: dragActive || !!armedSymbol,
    accepts: armedSymbol ? (n) => canAccept(n.symbolType, armedSymbol) : null,
    printPreview,
    currentPage,
  });
  $('#canvas').classList.toggle('preview-mode', printPreview);
  $('#layout-panel').hidden = !printPreview;
  $('#props').classList.toggle('layout-mode', printPreview);
  renderPageList();
  const lay = project.layout || { x: 0, y: 0, scale: 0.6 };
  $('#layout-scale').value = String(Math.round(lay.scale * 100));
  $('#layout-scale-val').textContent = Math.round(lay.scale * 100) + ' %';
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
  const seed = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
  const today = new Date().toISOString().slice(0, 10);
  seed.info.projet.dateCreation = today;
  seed.info.projet.dateModification = today;
  loadProject(seed, null);
  status('Nouveau projet pré-rempli. Remplissez les informations d’installation.');
});

/** Enregistre le projet dans le stockage local (même effet que Ctrl+S). */
function saveLocal() {
  project.info.projet.dateModification = new Date().toISOString().slice(0, 10);
  persistSnapshot();
  dirty = false;
  $('#project-file').textContent = (currentFile ? currentFile.split(/[\\/]/).pop() : 'sans titre');
  status('Enregistré (stockage local).');
}

$('#btn-save').addEventListener('click', saveLocal);

$('#btn-export').addEventListener('click', () => {
  project.info.projet.dateModification = new Date().toISOString().slice(0, 10);
  const text = encodeElx(project, APP_VERSION, assetsObject());
  const blob = new Blob([text], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName() + '.' + FILE_EXT;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  status(`Fichier .${FILE_EXT} exporté.`);
});

async function loadRecents() {
  const sel = $('#recent-select');
  if (typeof window.elexio !== 'object') {
    sel.innerHTML = '<option value="">(version navigateur — pas de fichiers récents)</option>';
    return;
  }
  const list = await window.elexio.recents();
  sel.innerHTML = list.length
    ? '<option value="">— Projets récents —</option>' +
      list.map((r) => `<option value="${escHtml(r.path)}">${escHtml(r.name)}</option>`).join('')
    : '<option value="">(aucun projet récent)</option>';
}

async function openRecentPath(p) {
  if (typeof window.elexio !== 'object') return;
  if (dirty && !confirm('Des modifications ne sont pas enregistrées. Ouvrir un autre projet ?')) { $('#recent-select').value = ''; return; }
  try {
    const res = await window.elexio.openPath(p);
    if (importProjectText(res.text, res.filePath)) {
      status(`Projet ouvert : ${res.filePath}`);
      await loadRecents();
    } else {
      $('#recent-select').value = '';
    }
  } catch (err) {
    alert(`Ouverture impossible.\n\n${p}\n\n${err.message}`);
    $('#recent-select').value = '';
  }
}

$('#recent-select').addEventListener('change', async (e) => {
  const p = e.target.value;
  if (!p) return;
  await openRecentPath(p);
});

function loadProject(data, filePath, assets = {}) {
  assetsReplace(assets);
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
  if (!Array.isArray(project.pages) || project.pages.length === 0) project.pages = [{ id: 1 }];
  currentPage = 0;
  syncIdCounter(project);
  loadInfoForm();
  selectedIds = new Set();
  selectedId = null;
  pendingAnchor = null;
  armedSymbol = null;
  history.past.length = 0;
  history.future.length = 0;
  updateHistoryButtons();
  clearDirty(filePath || null);
  resetPlanView();
  refreshAll();
  switchTab('info');
  fitView();
  // Ferme l'écran d'accueil au cas où un projet est chargé
  const welcomeEl = $('#welcome');
  if (welcomeEl) welcomeEl.hidden = true;
}

/** Décode un fichier (.elx base64 ou JSON legacy) et charge le projet.
 *  Vérifie la version du modèle : migration automatique, alerte si fichier trop
 *  récent. Retourne true si le projet a été chargé. */
function importProjectText(text, filePath) {
  let decoded;
  try {
    decoded = decodeElx(text);
  } catch (err) {
    alert('Ouverture impossible.\n\n' + err.message);
    return false;
  }
  const data = decoded.project;
  if (!data || typeof data !== 'object' || (!data.supply && !Array.isArray(data.elements) && !Array.isArray(data.circuits))) {
    alert('Ouverture impossible.\n\nStructure de projet invalide.');
    return false;
  }
  const compat = checkCompatibility(decoded.meta);
  if (compat.level === 'future' && !confirm(`${compat.message}\n\nOuvrir quand même ? (comportement non garanti)`)) return false;
  loadProject(data, filePath, decoded.assets);
  if (compat.level === 'migrate' || compat.level === 'unknown') status(compat.message);
  return true;
}

$('#btn-undo').addEventListener('click', undo);
$('#btn-redo').addEventListener('click', redo);

$('#btn-open').addEventListener('click', async () => {
  if (typeof window.elexio !== 'object') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.elx,.json,application/octet-stream,application/json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (importProjectText(await file.text(), file.name)) {
        status(`Projet ouvert : ${file.name}`);
      }
    };
    input.click();
    return;
  }
  if (dirty && !confirm('Des modifications ne sont pas enregistrées. Ouvrir un autre projet ?')) return;
  const res = await window.elexio.open();
  if (!res) return;
  if (importProjectText(res.text, res.filePath)) {
    await loadRecents();
    status('Projet ouvert.');
  }
});

/** Vrai si le schéma (position et taille de la mise en page) déborde des pages. */
function drawingOverflowsPages() {
  const d = svgEl.querySelector('#drawing');
  if (!d) return false;
  const bb = d.getBBox();
  const lay = project.layout || { x: 0, y: 0, scale: 0.6 };
  const m = 10;   // marge de la zone de déplacement (poignée)
  const x0 = lay.x + lay.scale * (bb.x + m), x1 = lay.x + lay.scale * (bb.x + bb.width - m);
  const y0 = lay.y + lay.scale * (bb.y + m), y1 = lay.y + lay.scale * (bb.y + bb.height - m);
  const n = Math.max(1, (project.pages || []).length);
  return x0 < 0 || y0 < 0 || x1 > n * PAGE.w || y1 > PAGE.h;
}

$('#btn-pdf').addEventListener('click', async () => {
  if ((project.elements || []).length === 0) {
    alert('Ajoutez au moins un élément avant d’exporter un PDF.');
    return;
  }
  if (drawingOverflowsPages() && !confirm('Le schéma déborde des pages de la mise en page : la partie hors pages ne sera pas imprimée. Continuer ?')) return;
  const html = buildPrintHtml();
  if (typeof window.elexio !== 'object') {
    const w = window.open('', '_blank');
    if (!w) { alert('Fenêtre bloquée : autorisez les pop-ups pour imprimer.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
    return;
  }
  const file = await window.elexio.exportPdf(html, suggestedName());
  if (file) status(`PDF exporté : ${file}`);
});

function suggestedName() {
  const i = project.info;
  return [i.chantier.denomination || 'schema', i.chantier.localite, 'v' + i.projet.version]
    .filter(Boolean).join('-').replace(/[^\w\-\.À-ÿ]+/g, '_');
}

/** Dossier PDF : cartouche général, schéma (une page, mis à l'échelle), liste des circuits,
 *  liste des matériaux. (Schéma d'implantation : à venir.) */
function buildPrintHtml() {
  const i = project.info;
  const ch = i.chantier, oc = i.occupant, ins = i.installateur, dd = i.dessinateur, ct = i.controle, pr = i.projet;
  const v = (x) => escHtml(x && String(x).trim() ? x : '—');
  const row = (label, val) => `<tr><th>${escHtml(label)}</th><td>${v(val)}</td></tr>`;
  const box = (title, rows) => `<div class="box"><h3>${escHtml(title)}</h3><table>${rows.join('')}</table></div>`;

  // 1. cartouche général
  const cover = `<section class="page">
<h1>Dossier d’installation électrique</h1>
<div class="sub">${v(ch.denomination)} · ${v(ch.adresse)}, ${v(ch.codePostal)} ${v(ch.localite)}</div>
<div class="grid">
${box('Chantier', [row('Dénomination', ch.denomination), row('Adresse', ch.adresse), row('Code postal', ch.codePostal), row('Localité', ch.localite), row('Date des travaux', ch.dateTravaux)])}
${box('Occupant', [row('Nom', [oc.prenom, oc.nom].filter(Boolean).join(' ')), row('Téléphone', oc.telephone), row('Email', oc.email)])}
${box('Installateur', [row('Société', ins.societe), row('N° TVA', ins.numeroTVA), row('Adresse', ins.adresse), row('Contact', ins.contact), row('Téléphone', ins.telephone), row('Email', ins.email)])}
${box('Dessinateur', [row('Nom', dd.nom), row('Société', dd.societe), row('Téléphone', dd.telephone), row('Email', dd.email)])}
${box('Organisme de contrôle', [row('Organisme', ct.organisme), row('Contact', ct.contact), row('Date prévue', ct.datePrevue)])}
${box('Projet', [row('Version', pr.version), row('Date de création', pr.dateCreation), row('Dernière modification', pr.dateModification), row('Domaine', pr.domaine), row('Pays', pr.pays), row('Alimentation', pr.typeAlim === 'TRI' ? 'Triphasé' : 'Monophasé')])}
${box('Remarques', [row('Remarques', i.remarques)])}
</div></section>`;

  // 2. schéma unifilaire : une page PDF par page de la mise en page ; chacune montre
  //    la portion du dessin qui la recouvre (le schéma passe d'une page à l'autre)
  const nPages = Math.max(1, (project.pages || []).length);
  const schema = Array.from({ length: nPages }, (_, p) => {
    const clone = $('#canvas').cloneNode(true);
    clone.querySelectorAll('.ui-only').forEach((n) => n.remove());
    drawCartouche(clone, project, p * PAGE.w);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.setAttribute('viewBox', `${p * PAGE.w} 0 ${PAGE.w} ${PAGE.h}`);
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    clone.setAttribute('style', 'width:100%;height:100%');
    return `<section class="page schema">${clone.outerHTML}</section>`;
  }).join('');

  // 3. plan d'implantation : une page A4 paysage par étage non vide
  const plans = buildPlanPages(project);

  // 4. liste des circuits : une ligne par protection (disjoncteur, fusible) avec son repère
  const protections = treeOrder(project).filter((n) => ['breaker', 'fuse'].includes(n.symbolType));
  const circuits = `<section class="page"><h2>Liste des circuits</h2>
<table><thead><tr><th>Repère</th><th>Protection</th><th>Caractéristique</th><th>Alimenté depuis</th></tr></thead><tbody>
${protections.map((n) => {
    const p = nodeById(project, n.parent);
    const from = p ? (p.label || (p.symbolType === 'compteur' ? 'W1' : '')) : '';
    return `<tr><td>${v(n.label)}</td><td>${escHtml(symbolName(n.symbolType))}</td><td>${v(deviceDetail(n))}</td><td>${v(from)}</td></tr>`;
  }).join('') || '<tr><td colspan="4">Aucun circuit.</td></tr>'}
</tbody></table></section>`;

  // 5. liste des matériaux, regroupés par désignation et caractéristique
  const groups = new Map();
  for (const n of treeOrder(project)) {
    if (n.symbolType === 'node') continue;
    const name = symbolLabel(n);
    const det = n.symbolType === 'compteur' ? (n.detail || 'Compteur') : (deviceDetail(n) || '—');
    const key = name + '||' + det;
    const g = groups.get(key) || { name, det, qty: 0 };
    g.qty += 1;
    groups.set(key, g);
  }
  const mats = [...groups.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'fr'));
  const materials = `<section class="page"><h2>Liste des matériaux</h2>
<table><thead><tr><th>Désignation</th><th>Caractéristique</th><th>Quantité</th></tr></thead><tbody>
${mats.map((g) => `<tr><td>${escHtml(g.name)}</td><td>${escHtml(g.det)}</td><td>${g.qty}</td></tr>`).join('')}
</tbody></table></section>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${escHtml(ch.denomination || 'Dossier électrique')}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: sans-serif; color:#111827; margin:0; font-size:11px; }
.page { width: 277mm; height: 186mm; page-break-after: always; break-after: page; overflow: hidden; }
.page:last-child { page-break-after: auto; break-after: auto; }
.schema { height: 186mm; }
.schema svg { display: block; }
.plan svg { display: block; width: 100%; height: 100%; }
  h1 { font-size:20px; margin:0 0 4px; }
  h2 { font-size:16px; margin:0 0 8px; }
  h3 { font-size:12px; margin:0 0 4px; }
  .sub { color:#6b7280; margin-bottom:10px; }
  .grid { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; }
  .box { border:1px solid #d1d5db; border-radius:4px; padding:6px; }
  table { border-collapse: collapse; width:100%; font-size:10px; }
  th, td { border:1px solid #d1d5db; padding:3px 6px; text-align:left; vertical-align:top; }
  thead th { background:#f3f4f6; }
  .box th { width:38%; color:#4b5563; font-weight:normal; border:none; border-bottom:1px solid #e5e7eb; }
  .box td { border:none; border-bottom:1px solid #e5e7eb; }
  .wire { stroke:#111827; stroke-width:1.6; fill:none; }
  .bus { stroke:#111827; stroke-width:2; fill:none; }
  text { font-family: sans-serif; }
  .lbl { font-size:9px; fill:#374151; }
  .lbl-sm { font-size:8px; fill:#4b5563; white-space: pre-line; }
  .cart-title { font-size:8px; font-weight:600; fill:#111827; }
  .cart-line { font-size:6.5px; fill:#4b5563; }
  .plan-title { font-size:13px; font-weight:600; fill:#111827; }
  .plan-scale-txt { font-size:7px; fill:#4b5563; }
  .plan-legend-title { font-size:8px; font-weight:600; fill:#111827; }
  .plan-legend-txt { font-size:7px; fill:#374151; }
  .plan-wall { stroke:#111827; fill:none; }
  .plan-wall.selected { stroke:#111827; }
  .plan-opening { stroke:#111827; fill:none; pointer-events:none; }
  .plan-room { fill:#111827; font-family:sans-serif; text-anchor:middle; }
  .plan-label { fill:#111827; font-family:sans-serif; }
  .plan-sym-hit { fill:none; stroke:none; }
</style></head><body>
${cover}
${schema}
${plans}
${circuits}
${materials}
</body></html>`;
}

/* ------------------------------------------------ palette RGIE & glisser-déposer */

function renderPalette() {
  const host = $('#palette-groups');
  host.innerHTML = '<h4>Favoris</h4><div id="palette-favs" class="palette-favs"></div>' +
    SYMBOL_CATEGORIES.map((cat) => {
    const items = Object.entries(SYMBOLS)
      .filter(([, s]) => s.category === cat.id)
      .map(([key]) => symBtnHtml(key, true))
      .join('');
    return `<h4>${escHtml(cat.name)}</h4>${items}`;
  }).join('');

  host.querySelectorAll('.sym-btn').forEach(bindSymBtn);
  host.querySelectorAll('.fav-star').forEach(bindStar);
  renderFavorites();
  refreshPaletteAccept();
}

/** HTML d'un bouton de symbole (palette, favoris, menu contextuel).
 *  `star` : ajoute l'étoile « favori » à côté (palette uniquement). */
function symBtnHtml(key, star = false) {
  const s = SYMBOLS[key];
  if (!s) return '';
  const thumb = `<img class="sym-thumb" src="${symbolUrl(key)}" alt="">`;
  const btn = `<button class="sym-btn" draggable="true" data-symbol="${key}" title="${escHtml(s.name)} (tableau 2.23 – ${s.ref})">
          ${thumb}<span class="sym-name">${escHtml(s.name)}</span></button>`;
  if (!star) return btn;
  const on = isFavorite(key);
  return `<div class="sym-row">${btn}<button class="fav-star${on ? ' on' : ''}" data-fav="${key}" title="${on ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${on ? '★' : '☆'}</button></div>`;
}

/** Étoile : bascule le favori, puis reconstruit la palette. */
function bindStar(btn) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(btn.dataset.fav);
    renderPalette();
  });
}

/** Câble un bouton : glisser-déposer, clic, et ouverture du menu si ancrage en attente. */
function bindSymBtn(btn) {
  btn.addEventListener('dragstart', (e) => {
    dragActive = true;
    refreshAll();
    e.dataTransfer.setData('text/x-elexio-symbol', btn.dataset.symbol);
    e.dataTransfer.effectAllowed = 'copy';
  });
  btn.addEventListener('click', () => addViaPalette(btn.dataset.symbol));
}

/** Remplit la section « Favoris » de la palette. */
function renderFavorites() {
  const host = $('#palette-favs');
  if (!host) return;
  const list = favoriteKeys();
  if (!list.length) {
    host.innerHTML = '<p class="hint">Cliquez l’étoile ☆ d’un symbole pour le mettre en favori.</p>';
    return;
  }
  host.innerHTML = list.map((k) => symBtnHtml(k, true)).join('');
  host.querySelectorAll('.sym-btn').forEach(bindSymBtn);
  host.querySelectorAll('.fav-star').forEach(bindStar);
}

/** Anti-erreur : grise dans la palette les symboles que la cible courante
 *  (ancrage cliqué ou élément sélectionné) n'a pas le droit de recevoir. */
function refreshPaletteAccept() {
  const target = pendingAnchor ? nodeOf(pendingAnchor.parentId) : selectedNode();
  document.querySelectorAll('#palette-groups .sym-btn').forEach((btn) => {
    btn.classList.toggle('nope', !!target && !canAccept(target.symbolType, btn.dataset.symbol));
    btn.classList.toggle('armed', btn.dataset.symbol === armedSymbol);
  });
}

/* ------------------------------------------------------------- symboles favoris */

const FAV_KEY = 'elecschema.favorites';   // liste ordonnée de clés de symbole

/** Favoris valides (symboles connus), dans l'ordre d'ajout. */
function favoriteKeys() {
  try {
    const list = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(list) ? list.filter((k) => SYMBOLS[k]) : [];
  } catch (err) { return []; }
}

function isFavorite(key) {
  return favoriteKeys().includes(key);
}

function toggleFavorite(key) {
  const list = favoriteKeys();
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch (err) { /* ignore */ }
}

/* ------------------------------------------- menu contextuel sur un point d'ancrage */

const anchorMenu = $('#anchor-menu');
let menuGuard = false;   // évite la fermeture immédiate par le clic d'ouverture

let anchorCtx = null;   // { parentId, dir } du menu ouvert

/** Liste du menu : favoris (ou résultats de recherche parmi tous les symboles).
 *  Un symbole impossible à cet endroit reste affiché, grisé. */
function renderAnchorMenuList(parentId, dir, query) {
  const parent = nodeOf(parentId);
  if (!parent) return;
  const list = anchorMenu.querySelector('.anchor-menu-list');
  const q = query.trim().toLowerCase();
  const keys = q
    ? Object.keys(SYMBOLS).filter((k) => SYMBOLS[k].name.toLowerCase().includes(q) || k.includes(q))
    : favoriteKeys();
  if (!keys.length) {
    list.innerHTML = `<p class="hint">${q ? 'Aucun élément trouvé.' : 'Aucun favori : marquez-en avec l’étoile.'}</p>`;
    return;
  }
  list.innerHTML = keys.map((k) => symBtnHtml(k)).join('');
  const insert = anchorCtx && anchorCtx.mode === 'insert';
  list.querySelectorAll('.sym-btn').forEach((btn) => {
    const type = btn.dataset.symbol;
    const ok = placeable(parent, dir, type, insert);
    btn.classList.toggle('nope', !ok);
    btn.addEventListener('click', () => {
      if (!ok) {
        status(insert ? `${symbolName(type)} ne peut pas être intercalé ici.` : `Un ${symbolName(parent.symbolType)} ne peut pas recevoir un ${symbolName(type)}.`);
        return;
      }
      closeAnchorMenu();
      pendingAnchor = null;
      if (insert) {
        insertWithProps(type, parentId, dir);
      } else {
        addWithProps(type, parentId, dir).then((el) => {
          if (el) status(`${symbolName(type)} ajouté sur le point d’ancrage.`);
        });
      }
    });
  });
}

/** Peut-on poser `type` sur ce point (ajout), ou l'intercaler entre le parent et son enfant ? */
function placeable(parent, dir, type, insert) {
  if (!canAccept(parent.symbolType, type, dir)) return false;
  if (!insert) return true;
  const old = nodeOf((parent.children || {})[dir]);
  return !old || canAccept(type, old.symbolType);
}

/** Intercale un élément (propriétés demandées d'abord). */
async function insertWithProps(type, parentId, dir) {
  const props = await promptFor(type, parentId);
  if (props === null) { status('Ajout annulé.'); return; }
  insertNode(parentId, dir, type, props);
}

function openAnchorMenu(clientX, clientY, parentId, dir, mode = 'add') {
  const parent = nodeOf(parentId);
  if (!parent) return;
  anchorCtx = { parentId, dir, mode };
  anchorMenu.querySelector('.anchor-menu-head').textContent = mode === 'insert' ? 'Intercaler un élément' : 'Ajouter sur ce point d’ancrage';
  const search = anchorMenu.querySelector('.anchor-search');
  search.value = '';
  renderAnchorMenuList(parentId, dir, '');
  anchorMenu.dataset.anchor = `${parentId}:${dir}`;
  anchorMenu.hidden = false;
  search.focus();
  // positionne le menu au point cliqué, sans sortir de l'écran
  const r = anchorMenu.getBoundingClientRect();
  const x = Math.max(8, Math.min(clientX, window.innerWidth - r.width - 8));
  const y = Math.max(8, Math.min(clientY, window.innerHeight - r.height - 8));
  anchorMenu.style.left = x + 'px';
  anchorMenu.style.top = y + 'px';
  menuGuard = true;
  setTimeout(() => { menuGuard = false; }, 0);
}

const anchorSearch = anchorMenu.querySelector('.anchor-search');
anchorSearch.addEventListener('input', () => {
  if (anchorCtx) renderAnchorMenuList(anchorCtx.parentId, anchorCtx.dir, anchorSearch.value);
});
anchorSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeAnchorMenu(); return; }
  if (e.key === 'Enter') {
    const first = anchorMenu.querySelector('.anchor-menu-list .sym-btn:not(.nope)');
    if (first) first.click();
  }
});

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
  if (!e.dataTransfer.types.includes('text/x-elexio-symbol')) return;
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

canvasHost.addEventListener('drop', async (e) => {
  e.preventDefault();
  canvasHost.classList.remove('drag-over');
  highlightAnchor(null);
  if (dragActive) { dragActive = false; refreshAll(); }
  const type = e.dataTransfer.getData('text/x-elexio-symbol');
  if (!type) return;
  const anchorEl = e.target.closest ? e.target.closest('[data-anchor]') : null;
  if (!anchorEl) { status('Déposez le symbole sur un point d’ancrage (« + »).'); return; }
  const [pid, dir] = anchorEl.dataset.anchor.split(':');
  pendingAnchor = null;
  const el = await addWithProps(type, Number(pid), dir);
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
let spaceDown = false;   // barre d'espace maintenue : glisser = panoramique (curseur main)

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !isTyping(e.target)) { e.preventDefault(); spaceDown = true; canvasHost.classList.add('hand'); }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') { spaceDown = false; canvasHost.classList.remove('hand'); }
});
window.addEventListener('blur', () => { spaceDown = false; canvasHost.classList.remove('hand'); });

svgEl.addEventListener('pointerdown', (e) => {
  // mise en page : glisser le dessin entier (tout point du dessin), sauf espace/alt (panoramique)
  const dr = svgEl.querySelector('#drawing');
  const dbox = dr ? dr.getBoundingClientRect() : null;
  const onDrawing = !!dbox && e.clientX >= dbox.left && e.clientX <= dbox.right && e.clientY >= dbox.top && e.clientY <= dbox.bottom;
  if (printPreview && e.button === 0 && !spaceDown && !e.altKey && onDrawing) {
    const lay = project.layout || { x: 0, y: 0, scale: 0.6 };
    gesture = { move: true, x: e.clientX, y: e.clientY, lx: lay.x, ly: lay.y, moved: false };
    svgEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const anchorEl = e.target.closest('[data-anchor]');
  const linkEl = e.target.closest('[data-link]');
  const hit = e.target.closest('[data-el]');

  // panoramique : bouton du milieu, ou clic gauche avec espace (main) / alt
  if (e.button === 1 || (e.button === 0 && (e.altKey || spaceDown))) {
    gesture = { pan: true, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    canvasHost.classList.add('panning');
  } else if (e.button === 0 && anchorEl) {
    const [pid, dir] = anchorEl.dataset.anchor.split(':');
    e.preventDefault();
    if (armedSymbol) { addWithProps(armedSymbol, Number(pid), dir); return; }
    selectedId = Number(pid);
    pendingAnchor = { parentId: Number(pid), dir };
    refreshAll();
    status('Point d’ancrage choisi — choisissez un symbole dans la palette.');
    openAnchorMenu(e.clientX, e.clientY, Number(pid), dir);
    return;
  } else if (e.button === 0 && linkEl) {
    const [pid, dir] = linkEl.dataset.link.split(':');
    e.preventDefault();
    openAnchorMenu(e.clientX, e.clientY, Number(pid), dir, 'insert');
    return;
  } else if (e.button === 0 && hit) {
    gesture = { pan: false };
    const elId = Number(hit.dataset.el);
    if (e.shiftKey) toggleElement(elId);      // Maj + clic : sélection multiple
    else selectElement(elId);
  } else { if (e.button === 0 && !hit) deselect(); return; }

  svgEl.setPointerCapture(e.pointerId);
  e.preventDefault();
});

svgEl.addEventListener('pointermove', (e) => {
  if (gesture && gesture.move) {
    const k = Math.max(view.w / svgEl.clientWidth, view.h / svgEl.clientHeight);
    const dx = (e.clientX - gesture.x) * k, dy = (e.clientY - gesture.y) * k;
    if (Math.abs(dx) + Math.abs(dy) > 1) gesture.moved = true;
    const cur = project.layout || { x: 0, y: 0, scale: 0.6 };
    project.layout = { ...cur, x: Math.round((gesture.lx + dx) * 10) / 10, y: Math.round((gesture.ly + dy) * 10) / 10 };
    const drawing = svgEl.querySelector('#drawing');
    if (drawing) drawing.setAttribute('transform', `translate(${project.layout.x},${project.layout.y}) scale(${cur.scale})`);
    return;
  }
  if (!gesture || !gesture.pan) return;
  const k = Math.max(view.w / svgEl.clientWidth, view.h / svgEl.clientHeight);
  const dx = e.clientX - gesture.x;
  const dy = e.clientY - gesture.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true;
  setView({ ...view, x: gesture.vx - dx * k, y: gesture.vy - dy * k });
});

svgEl.addEventListener('pointerup', (e) => {
  canvasHost.classList.remove('panning');
  if (gesture && gesture.move) {
    if (gesture.moved) markDirty();
    gesture = null;
    if (svgEl.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
    return;
  }
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

/* --------------------------------------------- aperçu avant impression */

$('#preview-print').checked = printPreview;
$('#preview-print').addEventListener('change', (e) => {
  printPreview = e.target.checked;
  try { localStorage.setItem('elecschema.printPreview', printPreview ? '1' : '0'); } catch (err) { /* ignore */ }
  refreshAll();
});
$('#layout-scale').addEventListener('input', (e) => {
  project.layout = { ...(project.layout || { x: 0, y: 0 }), scale: Number(e.target.value) / 100 };
  refreshAll();
});
$('#layout-scale').addEventListener('change', () => markDirty());
$('#btn-layout-reset').addEventListener('click', () => {
  // recentrer : le dessin est centré dans la page courante, la taille est conservée
  const cur = project.layout || { x: 0, y: 0, scale: 0.6 };
  const drawing = svgEl.querySelector('#drawing');
  if (!drawing) return;
  const bb = drawing.getBBox();
  const pageX = currentPage * (PAGE.w + PAGE.gap);
  project.layout = {
    ...cur,
    x: Math.round((pageX + PAGE.w / 2 - cur.scale * (bb.x + bb.width / 2)) * 10) / 10,
    y: Math.round((PAGE.h / 2 - cur.scale * (bb.y + bb.height / 2)) * 10) / 10,
  };
  markDirty();
  refreshAll();
});

/* --------------------------------------------------------- pages (mise en page) */

function renderPageList() {
  const host = $('#page-list');
  if (!host) return;
  const pages = project.pages || [];
  host.innerHTML = '';
  pages.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'page-row' + (i === currentPage ? ' active' : '');
    const name = document.createElement('button');
    name.className = 'page-name';
    name.textContent = 'Page ' + (i + 1);
    name.addEventListener('click', () => { currentPage = i; refreshAll(); });
    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'Supprimer cette page';
    del.disabled = pages.length <= 1;
    del.addEventListener('click', () => deletePage(i));
    row.append(name, del);
    host.appendChild(row);
  });
}

function addPage() {
  const pages = project.pages || (project.pages = [{ id: 1 }]);
  const id = Math.max(0, ...pages.map((p) => p.id || 0)) + 1;
  pages.splice(currentPage + 1, 0, { id });
  currentPage += 1;
  markDirty();
  refreshAll();
  status(`Page ${currentPage + 1} ajoutée.`);
}

function deletePage(i) {
  const pages = project.pages || [];
  if (pages.length <= 1) return;
  pages.splice(i, 1);
  if (i < currentPage || currentPage >= pages.length) currentPage = Math.max(0, currentPage - 1);
  markDirty();
  refreshAll();
  status(`Page ${i + 1} supprimée.`);
}

$('#btn-page-add').addEventListener('click', addPage);

/* --------------------------------------------------- clavier : suppr / échap */

function isTyping(t) { return /INPUT|TEXTAREA|SELECT/.test(t.tagName); }

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;

  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveLocal(); return; }
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); $('#btn-new').click(); return; }

  if (activeTab !== 'schema' || printPreview || isTyping(e.target) || $('#prop-dialog').open) return;
  if (e.key === 'Escape' && !anchorMenu.hidden) { closeAnchorMenu(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const ids = [...selectedIds].filter((id) => !isSupplyId(id));
    if (ids.length) {
      e.preventDefault();
      let parentId = null;
      for (const id of ids) parentId = deleteElement(id) ?? parentId;
      if (parentId != null && nodeOf(parentId)) { selectOnly(parentId); refreshAll(); } else deselect();
      status(ids.length + ' element(s) supprime(s).');
    }
  } else if (e.key === 'Escape') {
    if (armedSymbol) setArmed(null);
    else deselect();
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
  const tableau = node.symbolType === 'tableau';
  const isSocket = node.symbolType === 'socket';
  const typeSel = $('#e-type');
  // Type : modifiable pour une prise (type de prise), sinon readonly (nom du symbole)
  if (isSocket) {
    typeSel.disabled = false;
    typeSel.innerHTML = SOCKET_TYPES.map((t) => `<option value="${t.key}">${t.name}</option>`).join('');
    typeSel.value = node.socketType || DEFAULT_SOCKET_TYPE;
  } else {
    typeSel.disabled = true;
    typeSel.innerHTML = `<option>${escHtml(supply ? 'Compteur (arrivée)' : (isNode ? 'Node' : symbolName(node.symbolType)))}</option>`;
  }
  $('#e-label-lbl').hidden = isNode;
  $('#e-locked-lbl').hidden = isNode;
  $('#e-label').value = node.label || '';
  $('#e-locked').checked = !!node.labelLocked;
  $('#e-showlabel-lbl').hidden = isNode;
  $('#e-showlabel').checked = node.showLabel === true;
  $('#e-count-lbl').hidden = !isSocket;
  if (isSocket) {
    $('#e-count').value = node.count || 1;
    $('#e-count-val').textContent = (node.count || 1) > 1 ? (node.count || 1) + 'x' : '';
  }
  // un tableau est toujours horizontal : pas d'orientation modifiable
  $('#e-orient-lbl').hidden = isNode || tableau;
  $('#e-orient').value = String(node.orient || 0);
  // le texte d'un tableau est toujours en bas, horizontal : pas de position ni d'orientation
  $('#e-labelpos-lbl').hidden = supply || isNode || tableau;
  $('#e-labelpos').value = node.labelPos || 'bottom';
  $('#e-labeloffset-lbl').hidden = isNode;
  const off = node.labelOffset == null ? -5 : Number(node.labelOffset);
  $('#e-labeloffset').value = String(off);
  $('#e-labeloffset-val').value = off + ' px';
  // orientation du texte : masquee pour un node et pour le compteur (texte fixe)
  $('#e-labelrot-lbl').hidden = supply || isNode || tableau;
  $('#e-labelrot').value = node.labelRot || 'auto';
  $('#e-detail-lbl').hidden = !supply;
  $('#e-detail').value = node.detail || '';

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
    // ancien format numérique : 3 → '3X', ou '3G' si conducteur de terre
    if (typeof c.n === 'number') c.n = String(c.n) + (c.terre ? 'G' : 'X');
    fillSel('#e-fil-n', FIL_N_VALUES.map((v) => [v, v]), c.n || '3G');
    fillSel('#e-fil-section', SECTIONS.map((s) => [String(s), String(s).replace('.', ',') + ' mm²']), c.section ?? 2.5);
    fillSel('#e-fil-cable', CABLE_TYPES.map((t) => [t, t]), c.type || 'XVB');
    fillSel('#e-fil-montage', MOUNT_TYPES.map((m) => [m.key, m.name]), c.montage || 'encastre_conduit');
  }
}

/** Nombre de conducteurs (listes X = sans terre, G = avec terre). */
const FIL_N_VALUES = ['1X', '2X', '3X', '4X', '5X', '6X', '7X', '2G', '3G', '4G', '5G', '6G', '7G'];

/** Remplit un <select> une seule fois puis sélectionne la valeur. */
function fillSel(id, pairs, value) {
  const sel = $(id);
  if (!sel.options.length) sel.innerHTML = pairs.map(([v, text]) => `<option value="${escHtml(v)}">${escHtml(text)}</option>`).join('');
  sel.value = value;
}

$('#e-label').addEventListener('input', (e) => {
  const n = selectedNode(); if (!n) return;
  n.label = e.target.value; n.labelLocked = true; markDirty(); refreshAll();
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
  n.orient = n.symbolType === 'tableau' ? 0 : Number(e.target.value); markDirty(); refreshAll();
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
  n.count = Math.max(1, Number(e.target.value) || 1);
  $('#e-count-val').textContent = n.count > 1 ? n.count + 'x' : '';
  markDirty(); refreshAll();
});
$('#e-type').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n) return;
  if (n.symbolType === 'socket') { n.socketType = e.target.value; markDirty(); refreshAll(); }
});
$('#e-switchtype').addEventListener('change', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'switch') return;
  n.switchType = e.target.value; markDirty(); refreshAll();
});
$('#e-fil-n').addEventListener('input', (e) => {
  const n = selectedNode(); if (!n || n.symbolType !== 'fil') return;
  (n.cable || (n.cable = {})).n = e.target.value; markDirty(); refreshAll();
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

$('#btn-apply-json').addEventListener('click', () => {
  const ta = $('#schema-json');
  // Le champ accepte un projet JSON (lisible) ou un fichier .elx collé (base64).
  if (importProjectText(ta.value, null)) status('Schéma appliqué.');
});

/* -------------------------------------------------------------------- init */

document.addEventListener('DOMContentLoaded', () => {
  $('#app-version').textContent = 'v' + APP_VERSION;

  let savedTab = null;
  try { savedTab = localStorage.getItem(TAB_KEY); } catch (err) { /* ignore */ }

  // Initialise avec un projet vide ; l'écran d'accueil invitera à en choisir un
  project = emptyProject();
  selectedIds = new Set();
  selectedId = null;
  pendingAnchor = null;
  armedSymbol = null;
  history.past.length = 0;
  history.future.length = 0;
  currentFile = null;
  dirty = false;
  try { lastSnap = JSON.stringify(project); } catch (err) { lastSnap = '{}'; }

  fitView();
  renderPalette();
  loadInfoForm();
  loadRecents();
  refreshAll();
  updateHistoryButtons();
  switchTab(['info', 'schema', 'bom'].includes(savedTab) ? savedTab : 'info');
  status('Prêt. Sélectionnez un projet pour commencer.');

  initPlan({ getProject: () => project, markDirty, status, activeTab: () => activeTab, selectElement, refreshAll });

  // Affiche l'écran d'accueil (reprendre, nouveau, ouvrir, récents)
  showWelcome();
});
