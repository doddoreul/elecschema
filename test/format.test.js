// Tests du format de fichier Elexio (.elx) — module pur src/format.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, SCHEMA_VERSION } from '../src/model.js';
import { encodeElx, decodeElx, checkCompatibility, FORMAT, FORMAT_VERSION, APP_VERSION } from '../src/format.js';

test('encodeElx : base64 (pas de JSON apparent) et versions notées', () => {
  const text = encodeElx(emptyProject());
  assert.ok(!/[{}]/.test(text), 'le JSON ne doit pas apparaître en clair');
  assert.match(text, /^[A-Za-z0-9+/=]+$/);
  const env = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
  assert.equal(env.format, FORMAT);
  assert.equal(env.formatVersion, FORMAT_VERSION);
  assert.equal(env.schemaVersion, SCHEMA_VERSION);
  assert.equal(env.app, APP_VERSION);
  assert.ok(env.exportedAt && !Number.isNaN(Date.parse(env.exportedAt)));
  assert.equal(env.project.supply.symbolType, 'compteur');
});

test('decodeElx : aller-retour encode -> decode', () => {
  const p = emptyProject();
  p.info.chantier.localite = 'Liège';
  const { project, meta } = decodeElx(encodeElx(p));
  assert.deepEqual(project, p);
  assert.equal(meta.enveloped, true);
  assert.equal(meta.schemaVersion, SCHEMA_VERSION);
  assert.equal(meta.format, FORMAT);
});

test('decodeElx : accepte un JSON clair (legacy) et lit sa version', () => {
  const p = emptyProject();
  const { project, meta } = decodeElx(JSON.stringify(p, null, 2));
  assert.deepEqual(project, p);
  assert.equal(meta.enveloped, false);
  assert.equal(meta.schemaVersion, SCHEMA_VERSION);
});

test('decodeElx : JSON legacy sans version -> schemaVersion null -> compat inconnue', () => {
  const legacy = { circuits: [] };
  const { project, meta } = decodeElx(JSON.stringify(legacy));
  assert.deepEqual(project, legacy);
  assert.equal(meta.schemaVersion, null);
  assert.equal(checkCompatibility(meta).level, 'unknown');
});

test('decodeElx : UTF-8 préservé (accents, tirets)', () => {
  const p = emptyProject();
  p.info.installateur.societe = 'Électricité Générale — Liège';
  const { project } = decodeElx(encodeElx(p));
  assert.equal(project.info.installateur.societe, 'Électricité Générale — Liège');
});

test('decodeElx : fichiers illisibles -> Error explicite', () => {
  assert.throws(() => decodeElx(''), /vide/);
  assert.throws(() => decodeElx('   '), /vide/);
  assert.throws(() => decodeElx('pas du json {'), /illisible/);
  const badB64 = Buffer.from('{oops', 'utf8').toString('base64'); // base64 valide, JSON invalide
  assert.throws(() => decodeElx(badB64), /illisible/);
});

test('checkCompatibility : ok / migre / trop récent', () => {
  assert.equal(checkCompatibility({ schemaVersion: SCHEMA_VERSION, formatVersion: FORMAT_VERSION }).level, 'ok');
  assert.equal(checkCompatibility({ schemaVersion: SCHEMA_VERSION - 1, formatVersion: FORMAT_VERSION }).level, 'migrate');
  assert.equal(checkCompatibility({ schemaVersion: SCHEMA_VERSION + 1, formatVersion: FORMAT_VERSION }).level, 'future');
  assert.equal(checkCompatibility({ schemaVersion: SCHEMA_VERSION, formatVersion: FORMAT_VERSION + 1 }).level, 'future');
});
