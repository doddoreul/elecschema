// Tests de propriétés du layout (render.js#computeLayout) : chaque élément est
// placé une seule fois ; tant que le layout aboutit (bump == null), aucun
// chevauchement hors couple parent/enfant. computeLayout est pur (aucun DOM).
//
// Limite connue et testée : au-delà de quelques branches chaînées, le layout
// atteint son plafond (bump != null, « tracé contraint ») et peut laisser des
// chevauchements — l'UI l'affiche alors comme un avertissement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, createElement } from '../src/model.js';
import { computeLayout, layoutForced } from '../src/render.js';
import { DEFAULT_SCHEMA } from '../src/default-schema.js';

/** Chevauchements entre rectangles, hors couples parent/enfant (tolérés par conception). */
function overlaps(project, rects) {
  const parent = Object.fromEntries([project.supply, ...(project.elements || [])].map((e) => [e.id, e.parent]));
  const hits = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].id, b = rects[j].id;
      if (parent[a] === b || parent[b] === a) continue;
      const ra = rects[i].r, rb = rects[j].r;
      if (ra.x0 < rb.x1 && rb.x0 < ra.x1 && ra.y0 < rb.y1 && rb.y0 < ra.y1) hits.push([a, b]);
    }
  }
  return hits;
}

function makeAdder(p) {
  return (type, parent, dir) => {
    const e = createElement(type, parent.id, dir);
    parent.children[dir] = e.id;
    p.elements.push(e);
    return e;
  };
}

/** Chaîne réaliste : compteur -> DDR -> nodes (3 branches) -> disjoncteurs -> prises. */
function denseChain(n) {
  const p = emptyProject();
  const add = makeAdder(p);
  const diff = add('rcd', p.supply, 'right');
  let hub = add('node', diff, 'right');
  let slots = ['top', 'bottom', 'left'];
  let si = 0;
  for (let i = 0; i < n; i++) {
    if (si >= slots.length) { hub = add('node', hub, 'right'); slots = ['top', 'bottom', 'left']; si = 0; }
    const b = add('breaker', hub, slots[si++]);
    add('socket', b, 'top');
  }
  return p;
}

test('layout : schéma vide -> un seul rectangle (le compteur)', () => {
  const p = emptyProject();
  const L = computeLayout(p);
  assert.deepEqual(L.rects.map((r) => r.id), [p.supply.id]);
});

test('layout : schéma par défaut livré -> propre (aucun chevauchement)', () => {
  const p = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
  const L = computeLayout(p);
  assert.equal(layoutForced(p), false, 'le schéma par défaut doit aboutir sans tracé contraint');
  assert.equal(new Set(L.rects.map((r) => r.id)).size, (p.elements || []).length + 1, 'chaque élément placé une fois');
  assert.deepEqual(overlaps(p, L.rects), []);
});

test('layout : petite chaîne -> aucun chevauchement', () => {
  const p = denseChain(2);
  const L = computeLayout(p);
  assert.equal(layoutForced(p), false);
  assert.deepEqual(overlaps(p, L.rects), []);
});

test('layout : cas dense (10 circuits) -> placements uniques, invariant si le tracé aboutit', () => {
  const p = denseChain(10);
  const L = computeLayout(p);
  assert.equal(new Set(L.rects.map((r) => r.id)).size, L.rects.length, 'chaque élément placé exactement une fois');
  assert.equal(L.rects.length, (p.elements || []).length + 1, 'aucun élément oublié');
  // Invariant : un layout qui aboutit (bump == null) ne doit jamais chevaucher.
  if (!layoutForced(p)) assert.deepEqual(overlaps(p, L.rects), []);
});

test('layout : tableau à 5 sorties -> aucun chevauchement', () => {
  const p = emptyProject();
  const add = makeAdder(p);
  const diff = add('rcd', p.supply, 'right');
  const tb = add('tableau', diff, 'right');
  tb.outputs = 5;
  for (let i = 1; i <= 5; i++) add('breaker', tb, 'top-' + i);
  const L = computeLayout(p);
  assert.equal(new Set(L.rects.map((r) => r.id)).size, L.rects.length);
  if (!layoutForced(p)) assert.deepEqual(overlaps(p, L.rects), []);
});
test('layout : chaîne prise -> fil -> protection : distance réduite sans chevauchement', () => {
  const p = emptyProject();
  const add = makeAdder(p);
  const prot = add('breaker', p.supply, 'right');
  const fil = add('fil', prot, 'top');
  const prise = add('socket', fil, 'top');
  const L = computeLayout(p);
  const dy = (L.pos.get(prot.id).y - L.pos.get(prise.id).y) * 28;
  assert.ok(dy < 180, 'distance verticale réduite');
  assert.equal(layoutForced(p), false, 'pas de tracé contraint');
  assert.deepEqual(overlaps(p, L.rects), [], 'aucun chevauchement');
});
