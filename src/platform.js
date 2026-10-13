// Shim navigateur : hors Electron, window.elexio est fourni par ce script
// (chargé par src/index.html). Le bureau utilise preload.js (pont IPC).
// Même interface que preload.js, implémentation web : téléchargements Blob,
// ouverture par <input type=file>, impression par window.print().
// Aucune dépendance. Limite : les .exe ne tournent pas dans un navigateur.
(() => {
  'use strict';
  if (typeof window.elexio === 'object') return; // déjà fourni (Electron : preload.js)

  window.elexio = {
    open() {
      return new Promise((res) => {
        const i = document.createElement('input');
        i.type = 'file';
        i.accept = '.elx,.json,application/octet-stream,application/json';
        i.onchange = async () => {
          const f = i.files && i.files[0];
          if (!f) return res(null);
          // Lecture brute : le décodage (.elx / JSON) est fait par src/format.js côté ui.js.
          try {
            res({ filePath: f.name, text: await f.text() });
          } catch (err) {
            alert('Fichier illisible : ' + err.message);
            res(null);
          }
        };
        i.click();
      });
    },
    recents: async () => [],
    openPath: async () => { throw new Error('hors Electron'); },
    exportPdf: async (html) => {
      const w = window.open('', '_blank');
      if (!w) {
        alert('Le navigateur a bloqué la fenêtre d\'impression. Autorisez les fenêtres pop-up pour exporter le PDF.');
        return null;
      }
      w.document.write(html);
      w.document.close();
      w.print();
      return 'impression';
    },
    // pas de miroir disque en navigateur : le localStorage suffit
    autosaveWrite: async () => true,
    autosaveRead: async () => null,
  };
})();