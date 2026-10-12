// Vérificateur de syntaxe : passe `node --check` sur tout le JS du dépôt
// (hors node_modules, dist, symbols). Cross-plateforme (Windows inclus).
// Usage : node tools/check-syntax.mjs
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SKIP = new Set(['node_modules', 'dist', 'symbols', '.git', '.github']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(mjs|cjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('ok   ' + relative(ROOT, f));
  } catch (err) {
    failed++;
    console.error('FAIL ' + relative(ROOT, f) + '\n' + (err.stderr || err.message).toString());
  }
}
console.log(`\n${files.length - failed}/${files.length} fichier(s) OK.`);
process.exit(failed ? 1 : 0);
