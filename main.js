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
      { name: 'Projet Elexio', extensions: ['elx', 'json'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
  });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  try {
    // Lecture brute : le décodage du format (.elx base64 / JSON legacy) et le
    // contrôle de version sont faits dans le rendu (src/format.js), seul endroit
    // où le décodeur est disponible (ESM partagé navigateur/bureau).
    const text = await fs.readFile(filePath, 'utf8');
    return { filePath, text };
  } catch (err) {
    dialog.showErrorBox('Ouverture impossible', `Le fichier n’a pas pu être lu.\n\n${filePath}\n\n${err.message}`);
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
  await pushRecent(filePath);
  return { filePath, text };
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
  // Les SVG sont inlinés en data: : le PDF ne dépend plus de l'accès file:.
  const inlined = await inlineSymbolSvg(html, (u) => fs.readFile(fileURLToPath(u)));
  // Écriture dans un fichier temporaire plutôt que loadURL('data:…') : Chromium
  // plafonne les URL `data:` à ~2 Mo, ce qui échouait sur les dossiers volumineux.
  const tmp = path.join(os.tmpdir(), `elexio-print-${process.pid}-${Date.now()}.html`);
  try {
    await fs.writeFile(tmp, inlined, 'utf8');
    await win.loadFile(tmp);
    const pdf = await win.webContents.printToPDF({
      landscape: true,
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
    });
    await writeFileAtomic(filePath, pdf);
    return filePath;
  } finally {
    win.destroy();
    await fs.rm(tmp, { force: true });
  }
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
  if (typeof text !== 'string' || text.length > 100_000_000) throw new Error('Autosave refusé.');
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
