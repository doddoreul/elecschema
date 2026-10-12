// Tests du helper d'inlining des SVG du PDF (print-assets.js, CommonJS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { collectFileSvgs, inlineSymbolSvg } = require('../print-assets.js');

test('collectFileSvgs : ne retient que les SVG en file:', () => {
  const html = '<image href="file:///a/symbols/x.svg"/><use href="file:///a/symbols/y.svg"/><img src="data:image/png;base64,AA"/>';
  assert.deepEqual(collectFileSvgs(html).sort(), ['file:///a/symbols/x.svg', 'file:///a/symbols/y.svg']);
});

test('inlineSymbolSvg : convertit les SVG file: en data: URI base64', async () => {
  const html = '<image href="file:///C:/app/src/symbols/breaker.svg"/>';
  const out = await inlineSymbolSvg(html, async () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.match(out, /data:image\/svg\+xml;base64,/);
  assert.ok(!out.includes('file:///'), 'plus aucune référence fichier');
});

test('inlineSymbolSvg : lecture en échec -> URL conservée', async () => {
  const html = '<image href="file:///x/missing.svg"/>';
  const out = await inlineSymbolSvg(html, async () => { throw new Error('nope'); });
  assert.equal(out, html);
});

test('inlineSymbolSvg : aucun SVG file: -> inchangé', async () => {
  const html = '<div>rien</div>';
  assert.equal(await inlineSymbolSvg(html, async () => 'x'), html);
});
