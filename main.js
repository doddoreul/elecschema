// Processus principal Electron.
// Application 100 % locale : aucun accès réseau, aucune télémétrie, aucune licence.

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { fileURLToPath } = require('node:url');
const { inlineSymbolSvg } = require('./print-assets.js');

let mainWindow = null;
const MAX_RECENTS = 8;

/** Directions d'ancrage valides (standards.js#ANCHOR_DIRECTIONS). */
const DIRS = ['top', 'bottom', 'left', 'right'];

/** Contrôle d'intégrité de l'arbre v3 : ids uniques, parents/enfants résolus, directions valides. */
function hasValidTree(p) {
  if (!p.supply || typeof p.supply.id !== 'number' || !Number.isInteger(p.supply.id)) return false;
  const ids = new Set([p.supply.id]);
  for (const e of p.elements || []) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'number' || !Number.isInteger(e.id)) return false;
    if (ids.has(e.id)) return false;
    ids.add(e.id);
  }
  for (const e of p.elements || []) {
    if (typeof e.symbolType !== 'string' || !e.symbolType) return false;
    if (e.parent != null && !ids.has(e.parent)) return false;
    if (e.dir != null && !DIRS.includes(e.dir)) return false;
    if (e.children && typeof e.children === 'object') {
      for (const v of Object.values(e.children)) if (v != null && !ids.has(v)) return false;
    }
  }
  return true;
}

/** Structure d'un projet Elexio : arbre d'éléments v3 vérifié, ou ancien format circuits. */
function isProject(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj.elements)) return hasValidTree(obj);
  return Array.isArray(obj.circuits);
}

/** Fichier des projets récents, dans les données utilisateur de l'app. */
function recentsPath() {
  return path.join(app.getPath('userData'), 'recents.json');
}

async function readRecents() {
  try {
    const list = JSON.parse(await fs.readFile(recentsPath(), 'utf8'));
    return Array.isArray(list) ? list.filter((r) => typeof r?.path === 'string') : [];
  } catch {
    return [];
  }
}

/** Écriture atomique (fichier temporaire puis renommage) : jamais de fichier corrompu. */
async function writeFileAtomic(filePath, content) {
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  await fs.writeFile(tmp, content);
  try {
    await fs.rename(tmp, filePath);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

async function writeRecents(list) {
  await ensureDir(path.dirname(recentsPath()));
  await writeFileAtomic(recentsPath(), JSON.stringify(list.slice(0, MAX_RECENTS), null, 2));
}

async function pushRecent(filePath) {
  const list = await readRecents();
  const next = [{ path: filePath, name: path.basename(filePath), at: Date.now() },
  ...list.filter((r) => r.path !== filePath)];
  await writeRecents(next);
  return next;
}

/** Dossier de stockage des projets.
 *  - version portable (PORTABLE_EXECUTABLE_DIR défini) : à côté de l'exécutable
 *  - version installée                                                 : Documents\Elexio
 */
function projectsDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'Projets');
  }
  const docs = app.getPath('documents') || os.homedir();
  return path.join(docs, 'Elexio');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    title: 'Elexio',
    backgroundColor: '#f3f4f6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  // Aucun lien externe n'est ouvert depuis l'application : tout est local.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

/* --------------------------------------------------------------- IPC : fichier */

ipcMain.handle('project:open', async (event) => {
  const dir = await ensureProjectsDir();
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un projet',
    defaultPath: dir,
    properties: ['openFile'],
    filters: [
      { name: 'Projet Elexio', extensions: ['unifilaire.json', 'json'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
  });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(text);
    if (!isProject(parsed)) {
      throw new Error('Structure de projet invalide : arbre d’éléments absent.');
    }
    return { filePath, data: parsed };
  } catch (err) {
    dialog.showErrorBox('Ouverture impossible', `Le fichier n’est pas un projet Elexio valide.\n\n${filePath}\n\n${err.message}`);
    return null;
  }
});

ipcMain.handle('recents:list', () => readRecents());

ipcMain.handle('project:openPath', async (event, filePath) => {
  // Le renderer ne peut rouvrir qu'un fichier deja present dans les recents
  // (limite l'exposition : pas de lecture de chemin arbitraire).
  const known = new Set((await readRecents()).map((r) => r.path));
  if (typeof filePath !== 'string' || !known.has(filePath)) {
    throw new Error('Chemin refuse : le fichier n’est pas dans les projets récents.');
  }
  const text = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(text);
  if (!isProject(parsed)) {
    throw new Error('Structure de projet invalide : arbre d’éléments absent.');
  }
  await pushRecent(filePath);
  return { filePath, data: parsed };
});

/* ------------------------------------------------------------------ IPC : PDF */

ipcMain.handle('pdf:export', async (event, html, defaultName) => {
  const dir = await ensureProjectsDir();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter en PDF',
    defaultPath: path.join(dir, `${defaultName || 'schema'}.pdf`),
    filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return null;

  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, javascript: false },
  });
  // Les SVG sont inlinés en data: : le PDF ne dépend plus de l'accès file: depuis
  // une page data: (robuste quelle que soit la version d'Electron).
  const inlined = await inlineSymbolSvg(html, (u) => fs.readFile(fileURLToPath(u)));
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(inlined));
  const pdf = await win.webContents.printToPDF({
    landscape: true,
    pageSize: 'A4',
    printBackground: true,
    margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
  });
  win.close();
  await writeFileAtomic(filePath, pdf);
  return filePath;
});

/* ------------------------------------------------------------------ IPC : CSV */

ipcMain.handle('csv:export', async (event, content, defaultName) => {
  const dir = await ensureProjectsDir();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter la liste des composants',
    defaultPath: path.join(dir, `${defaultName || 'composants'}.csv`),
    filters: [{ name: 'CSV (séparateur ;)', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return null;
  await writeFileAtomic(filePath, '\uFEFF' + content);
  return filePath;
});

/* -------------------------------------------------------------- IPC : autosave */
// Miroir disque de la sauvegarde locale (localStorage) : protège les données si
// le profil est effacé. Écriture atomique, lecture tolérante.
function autosavePath() {
  return path.join(app.getPath('userData'), 'autosave.json');
}

ipcMain.handle('autosave:read', async () => {
  try {
    return await fs.readFile(autosavePath(), 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('autosave:write', async (event, text) => {
  if (typeof text !== 'string' || text.length > 10_000_000) throw new Error('Autosave refusé.');
  await ensureDir(path.dirname(autosavePath()));
  await writeFileAtomic(autosavePath(), text);
  return true;
});

async function ensureProjectsDir() {
  const dir = projectsDir();
  await ensureDir(dir);
  return dir;
}

/* ---------------------------------------------------------------------- app */

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
