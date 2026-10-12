// Pont isolé entre le rendu et le processus principal.
// Aucun module Node n'est exposé directement : seules des actions nommées le sont.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elexio', {
  save: (data) => ipcRenderer.invoke('project:save', data),
  open: () => ipcRenderer.invoke('project:open'),
  lastOpened: () => ipcRenderer.invoke('project:lastOpened'),
  exportPdf: (html, name) => ipcRenderer.invoke('pdf:export', html, name),
  exportCsv: (content, name) => ipcRenderer.invoke('csv:export', content, name),
  recents: () => ipcRenderer.invoke('recents:list'),
  openPath: (p) => ipcRenderer.invoke('project:openPath', p),
});
