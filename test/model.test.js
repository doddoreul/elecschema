// Tests du modèle pur (sans DOM) : migrations legacy -> v3, normalisation, arbre.
// Exécution : node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, createElement, nodeById, treeOrder, migrateProject, normalizeTypes, letterOf, renumberCircuits } from '../src/model.js';

test('migrateProject : ancien format (circuits/difs) -> arbre v3', () => {
  const legacy = {
    supply: { id: 1, symbolType: 'compteur', label: 'W1' },
    difs: [{ label: 'D1', params: { rating: 40, diff: 30, type: 'AC' } }],
    circuits: [{ components: [
      { symbolType: 'breaker', label: 'Q1', params: { rating: 16, curve: 'C', icb: 3000 } },
      { symbolType: 'socket', label: 'X1', count: 2 },
    ] }],
  };
  migrateProject(legacy);
  assert.equal(legacy.schemaVersion, 3);
  assert.ok(Array.isArray(legacy.elements) && legacy.elements.length >= 3);
  assert.equal(legacy.circuits, undefined);
  assert.equal(legacy.difs, undefined);
  const types = legacy.elements.map((e) => e.symbolType);
  for (const t of ['rcd', 'node', 'breaker', 'socket']) assert.ok(types.includes(t), `type ${t} attendu`);
});

test('migrateProject : projet v3 déjà en place -> inchangé', () => {
  const p = emptyProject();
  const before = JSON.stringify(p);
  migrateProject(p);
  assert.equal(JSON.stringify(p), before);
  assert.equal(p.schemaVersion, 3);
});

test('normalizeTypes : types éclatés legacy -> type unique', () => {
  const p = { elements: [
    { id: 2, symbolType: 'socket_earth', parent: 1, dir: 'top' },
    { id: 3, symbolType: 'socket_waterproof', parent: 1, dir: 'bottom' },
    { id: 4, symbolType: 'switch_2way', parent: 1, dir: 'left' },
    { id: 5, symbolType: 'carrefour', parent: 1, dir: 'right', label: 'X9', detail: 'vieux' },
  ] };
  normalizeTypes(p);
  const [a, b, c, d] = p.elements;
  assert.equal(a.symbolType, 'socket');
  assert.equal(a.socketType, 'earth');
  assert.equal(a.count, 1);
  assert.equal(b.symbolType, 'socket');
  assert.equal(b.socketType, 'waterproof');
  assert.equal(c.symbolType, 'switch');
  assert.equal(c.switchType, 'two_way');
  assert.equal(d.symbolType, 'node');
  assert.equal(d.label, '');
  assert.equal(d.detail, '');
});

test('normalizeTypes : tableau -> sorties top-N et ancrage des enfants', () => {
  const p = { elements: [
    { id: 2, symbolType: 'tableau', parent: 1, dir: 'right', children: { top: 3, right: 4 } },
    { id: 3, symbolType: 'breaker', parent: 2, dir: 'top' },
    { id: 4, symbolType: 'breaker', parent: 2, dir: 'right' },
  ] };
  normalizeTypes(p);
  const tb = p.elements[0];
  const keys = Object.keys(tb.children);
  assert.ok(keys.every((k) => k === 'bottom' || /^top-\d+$/.test(k)), `clés ${keys.join(',')}`);
  assert.equal(p.elements.find((e) => e.id === 3).dir, 'top-1');
  assert.equal(p.elements.find((e) => e.id === 4).dir, 'top-2');
});

test('treeOrder : parcours sans cycle ; nodeById', () => {
  const p = emptyProject();
  const d = createElement('rcd', p.supply.id, 'right');
  p.supply.children.right = d.id; p.elements.push(d);
  const s1 = createElement('socket', d.id, 'top');
  const s2 = createElement('socket', d.id, 'bottom');
  d.children = { top: s1.id, bottom: s2.id };
  p.elements.push(s1, s2);
  assert.deepEqual(treeOrder(p).map((n) => n.id), [p.supply.id, d.id, s1.id, s2.id]);
  assert.equal(nodeById(p, s1.id), s1);
  assert.equal(nodeById(p, 999999), null);
});

test('letterOf : 1 -> A, 26 -> Z, 27 -> AA', () => {
  assert.equal(letterOf(1), 'A');
  assert.equal(letterOf(26), 'Z');
  assert.equal(letterOf(27), 'AA');
  assert.equal(letterOf(28), 'AB');
});

test('renumberCircuits : une lettre par circuit, puis 1, 2… par symbole', () => {
  const p = emptyProject();
  const add = (type, parent, dir) => { const e = createElement(type, parent.id, dir); parent.children[dir] = e.id; p.elements.push(e); return e; };
  const diff = add('rcd', p.supply, 'right');
  const b1 = add('breaker', diff, 'top');
  const s1 = add('socket', b1, 'top');
  const b2 = add('breaker', diff, 'bottom');
  const s2 = add('socket', b2, 'top');
  renumberCircuits(p);
  assert.equal(b1.label, 'A');
  assert.equal(b2.label, 'B');
  assert.equal(s1.label, 'A1');
  assert.equal(s2.label, 'B1');

  // un repère de circuit verrouillé est conservé et réservé
  b1.labelLocked = true;
  b1.label = 'B';
  renumberCircuits(p);
  assert.equal(b1.label, 'B');
  assert.notEqual(b2.label, 'B');
});
