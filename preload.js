// Pont isolé entre le rendu et le processus principal.
// Aucun module Node n'est exposé directement : seules des actions nommées le sont.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elexio', {
  open: () => ipcRenderer.invoke('project:open'),
  exportPdf: (html, name) => ipcRenderer.invoke('pdf:export', html, name),
  exportCsv: (content, name) => ipcRenderer.invoke('csv:export', content, name),
  recents: () => ipcRenderer.invoke('recents:list'),
  openPath: (p) => ipcRenderer.invoke('project:openPath', p),
});
