// Tests des règles de validation belges (RGIE/AREI) — module pur rules-be.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, createElement } from '../src/model.js';
import { validate, RULES_BE } from '../src/rules-be.js';

const ids = (issues) => issues.map((i) => i.rule.id);

test('les 6 règles sont définies et ordonnées', () => {
  assert.equal(RULES_BE.length, 6);
  assert.deepEqual(RULES_BE.map((r) => r.id), ['BE-01', 'BE-03', 'BE-04', 'BE-05', 'BE-06', 'BE-08']);
});

test('BE-01 : schéma sans élément', () => {
  const p = emptyProject();
  assert.ok(ids(validate(p)).includes('BE-01'));
});

test('BE-03 : prise sans différentiel 30 mA en amont', () => {
  const p = emptyProject();
  const b = createElement('breaker', p.supply.id, 'right');
  p.supply.children.right = b.id; p.elements.push(b);
  const s = createElement('socket', b.id, 'top');
  b.children = { top: s.id }; p.elements.push(s);
  assert.ok(ids(validate(p)).includes('BE-03'));
});

test('BE-03 : aucune alerte si un DDR 30 mA est en amont', () => {
  const p = emptyProject();
  const d = createElement('rcd', p.supply.id, 'right');
  d.params = { rating: 40, diff: 30, type: 'AC' };
  p.supply.children.right = d.id; p.elements.push(d);
  const s = createElement('socket', d.id, 'top');
  d.children = { top: s.id }; p.elements.push(s);
  assert.ok(!ids(validate(p)).includes('BE-03'));
});

test('BE-04 : protection sans calibre', () => {
  const p = emptyProject();
  const b = createElement('breaker', p.supply.id, 'right');
  b.params = { rating: null, curve: 'C', icb: 3000 };
  p.supply.children.right = b.id; p.elements.push(b);
  assert.ok(ids(validate(p)).includes('BE-04'));
});

test('BE-05 : repères en double', () => {
  const p = emptyProject();
  const a = createElement('socket', p.supply.id, 'right'); a.label = 'X1';
  const b = createElement('socket', p.supply.id, 'left'); b.label = 'X1';
  p.supply.children = { right: a.id, left: b.id };
  p.elements.push(a, b);
  assert.ok(ids(validate(p)).includes('BE-05'));
});

test('BE-06 : symbole sans repère (hors node/fil)', () => {
  const p = emptyProject();
  const s = createElement('socket', p.supply.id, 'right');
  p.supply.children.right = s.id; p.elements.push(s);
  assert.ok(ids(validate(p)).includes('BE-06'));
});

test('BE-08 : dossier incomplet (adresse/société/dessinateur)', () => {
  const p = emptyProject();
  const s = createElement('socket', p.supply.id, 'right');
  p.supply.children.right = s.id; p.elements.push(s);
  assert.ok(ids(validate(p)).includes('BE-08'));
});
