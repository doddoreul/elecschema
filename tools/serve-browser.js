// Serveur de test navigateur : version de travail + commits/tags git.
// Usage : node tools/serve-browser.js [port]   (defaut 8080)
//   /w/<fichier>            copie de travail (src/)
//   /r/<ref>/<fichier>      src/ tel qu'il etait a un commit ou un tag git
// Le shim web de window.elexio vit desormais dans src/platform.js (embarque dans
// la page). __shim.js (serveur) n'est plus injecte que pour les anciennes versions
// de l'historique, qui n'avaient pas encore platform.js.
// Limite : les .exe ne tournent pas dans un navigateur.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 8080;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const SHIM = `(() => {
  const save = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
  window.elexio = {
    open() { return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = async () => { const f = i.files[0]; if (!f) return res(null); res({ filePath: f.name, data: JSON.parse(await f.text()) }); }; i.click(); }); },
    recents: async () => [],
    openPath: async () => { throw new Error('hors Electron'); },
    exportPdf: async (html) => { const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print(); return 'impression'; },
    exportCsv: async (content, name) => { save((name || 'composants') + '.csv', '\\uFEFF' + content, 'text/csv'); return (name || 'composants') + '.csv'; },
  };
})();`;

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e7 });

function readFile(ref, rel) {
  if (ref === 'work') return fs.readFileSync(path.join(ROOT, 'src', rel));
  return execFileSync('git', ['show', `${ref}:src/${rel}`], { cwd: ROOT, maxBuffer: 1e7 });
}

function indexPage() {
  const commits = git(['log', '--format=%h%x09%s', '-n', '20']).trim().split('\n');
  const tags = git(['tag']).trim().split('\n').filter(Boolean);
  const li = (href, label) => `<li><a href="${href}">${label}</a></li>`;
  return `<!DOCTYPE html><meta charset="utf-8"><title>Elexio - tests</title>
<h2>Copie de travail</h2><ul>${li('/w/index.html', 'src/ (working tree)')}</ul>
<h2>Tags</h2><ul>${tags.map((t) => li(`/r/${t}/index.html`, t)).join('') || '<li>(aucun)</li>'}</ul>
<h2>Commits</h2><ul>${commits.map((l) => { const [sha, msg] = l.split('\t'); return li(`/r/${sha}/index.html`, `${sha} ${msg}`); }).join('')}</ul>`;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const fail = (code, msg) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(msg); };

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(indexPage());
  }

  const m = url.pathname.match(/^\/(w|r)\/(.+)$/);
  if (!m) return fail(404, '404');
  let ref = 'work';
  let rel = m[2];
  if (m[1] === 'r') {
    const cut = rel.indexOf('/');
    ref = rel.slice(0, cut);
    rel = rel.slice(cut + 1);
    if (!/^[A-Za-z0-9._\/-]+$/.test(ref) || ref.includes('..')) return fail(403, 'ref refusee');
  }
  rel = rel || 'index.html';
  if (rel.includes('..') || path.isAbsolute(rel)) return fail(403, 'chemin refuse');

  if (rel === '__shim.js') {
    res.writeHead(200, { 'Content-Type': MIME['.js'] });
    return res.end(SHIM);
  }

  try {
    let body = readFile(ref, rel);
    const type = MIME[path.extname(rel)] || 'application/octet-stream';
    if (rel === 'index.html') {
      const html = body.toString('utf8');
      // La version courante embarque platform.js : rien a injecter.
      // Anciennes versions (sans platform.js) : on injecte le shim serveur.
      if (!html.includes('platform.js')) {
        body = html.replace('<script src="ui.js"', '<script src="__shim.js"></script>\n  <script src="ui.js"');
      }
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch {
    fail(404, 'introuvable : ' + rel + ' @ ' + ref);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Elexio tests -> http://127.0.0.1:${PORT}/`);
});
