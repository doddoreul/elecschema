// Tests du plan d'implantation (modèle pur, sans DOM) et du format .elx avec images.
// Exécution : node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, migrateProject, SCHEMA_VERSION } from '../src/model.js';
import {
  emptyPlan, normalizePlan, ensurePlan, addLevel, removeLevel, renameLevel, moveLevel,
  addWall, removeWall, placeElement, unplaceElement, placedIds, unplacedElements, levelBounds,
  nearestWall, orthoTarget, snap, pxPerCm, paperMm, chooseScale, effectiveScale, addRoom, symbolSideCm,
  addOpening, removeOpening, removeRoom, pointOnWall, DEFAULT_DOOR,
} from '../src/plan-model.js';
import { encodeElx, decodeElx, referencedAssets } from '../src/format.js';
import { planFillCount } from '../src/plan-print.js';

const addEl = (p, id, symbolType, extra = {}) => {
  p.elements.push({ id, symbolType, parent: 1, dir: 'right', label: '', children: {}, ...extra });
};

test('migration v3 -> v4 : plan par défaut, idempotente', () => {
  const v3 = { schemaVersion: 3, supply: { id: 1, symbolType: 'compteur', label: 'W1', children: {} }, elements: [] };
  migrateProject(v3);
  assert.equal(v3.schemaVersion, SCHEMA_VERSION);
  assert.equal(v3.plan.levels.length, 1);
  assert.equal(v3.plan.levels[0].name, 'Rez-de-chaussée');
  const once = JSON.stringify(v3);
  migrateProject(v3);
  assert.equal(JSON.stringify(v3), once);
});

test('normalizePlan : plan absent ou invalide -> un niveau', () => {
  const p = emptyProject();
  p.plan = 'n’importe quoi';
  assert.equal(normalizePlan(p).levels.length, 1);
  p.plan = { levels: [] };
  assert.equal(normalizePlan(p).levels.length, 1);
});

test('normalizePlan : placements orphelins, non posables et doublons supprimés', () => {
  const p = emptyProject();
  addEl(p, 2, 'socket');
  addEl(p, 3, 'breaker');
  p.plan = emptyPlan();
  const lv = p.plan.levels[0];
  lv.placements = [
    { elementId: 2, x: 0, y: 0, rot: 0 },
    { elementId: 2, x: 9, y: 9, rot: 0 },   // doublon
    { elementId: 3, x: 0, y: 0, rot: 0 },   // breaker : exclu
    { elementId: 99, x: 0, y: 0, rot: 0 },  // orphelin
  ];
  ensurePlan(p);
  assert.deepEqual(p.plan.levels[0].placements.map((x) => x.elementId), [2]);
});

test('normalizePlan : ouvertures sans mur supprimées, position bornée', () => {
  const p = emptyProject();
  p.plan = emptyPlan();
  const lv = p.plan.levels[0];
  lv.walls = [{ id: 'w5', x1: 0, y1: 0, x2: 400, y2: 0, t: 20 }];
  lv.openings = [
    { id: 'o6', kind: 'door', wall: 'w5', pos: 3, w: 90 },
    { id: 'o7', kind: 'window', wall: 'absent', pos: 0.5, w: 120 },
  ];
  ensurePlan(p);
  assert.equal(p.plan.levels[0].openings.length, 1);
  assert.equal(p.plan.levels[0].openings[0].pos, 1);
  assert.equal(p.plan.levels[0].openings[0].hinge, DEFAULT_DOOR.hinge, 'charnière migrée par défaut');
  assert.equal(p.plan.levels[0].openings[0].open, DEFAULT_DOOR.open, 'côté migré par défaut');
});

test('niveaux : au moins un, ajout, renommage, déplacement', () => {
  const plan = emptyPlan();
  assert.equal(removeLevel(plan, plan.levels[0].id), false, 'dernier niveau non supprimable');
  const e1 = addLevel(plan);
  assert.equal(e1.name, 'Étage 1');
  assert.equal(renameLevel(plan, e1.id, '   '), false);
  assert.equal(renameLevel(plan, e1.id, 'Sous-sol'), true);
  assert.equal(moveLevel(plan, e1.id, -1), true);
  assert.equal(plan.levels[0].name, 'Sous-sol');
  assert.equal(moveLevel(plan, e1.id, -1), false, 'déjà en tête');
  assert.equal(removeLevel(plan, e1.id), true);
  assert.equal(plan.levels.length, 1);
});

test('placement : un élément n’est posé qu’une fois, tous niveaux confondus', () => {
  const p = emptyProject();
  addEl(p, 2, 'socket');
  p.plan = emptyPlan();
  const l2 = addLevel(p.plan);
  assert.equal(placeElement(p.plan, p.plan.levels[0].id, 2, 100, 100), true);
  assert.equal(placeElement(p.plan, l2.id, 2, 300, 100), false);
  assert.deepEqual([...placedIds(p.plan)], [2]);
  assert.equal(unplacedElements(p).some((e) => e.elementId === 2), false);
  unplaceElement(p.plan, 2);
  assert.equal(unplacedElements(p).some((e) => e.elementId === 2), true, 'élément revient dans la liste');
  assert.equal(p.elements.length, 1, 'élément du schéma conservé');
});

test('unplacedElements : compteur et posables seulement', () => {
  const p = emptyProject();
  addEl(p, 2, 'socket');
  addEl(p, 3, 'node');
  addEl(p, 4, 'tableau');
  addEl(p, 5, 'fil');
  const ids = unplacedElements(p).map((e) => e.elementId);
  assert.deepEqual(ids, [1, 2, 4]);
});

test('taille des symboles : constante sur papier (4 mm), proportionnelle à l’échelle en cm', () => {
  // 4 mm sur papier : 1:100 -> 40 cm réels ; 1:50 -> 20 cm ; 1:250 -> 100 cm
  assert.equal(symbolSideCm(100), 40);
  assert.equal(symbolSideCm(50), 20);
  assert.equal(symbolSideCm(250), 100);
});

test('échelle : 1:100 -> 0,2 px/cm ; distance exacte sur le papier', () => {
  assert.equal(pxPerCm(100), 0.2);
  // mur de 500 cm à 1:100 = 5 m réels = 50 mm sur papier = 100 px à 2 px/mm
  assert.equal(paperMm(500, 100), 50);
  assert.equal(500 * pxPerCm(100), 100);
});

test('échelle automatique : plus grande échelle normalisée qui tient', () => {
  assert.equal(chooseScale({ x0: 0, y0: 0, x1: 300, y1: 200 }).n, 20, '300x200 cm tient en 1:20');
  const mid = { x0: 0, y0: 0, x1: 1000, y1: 700 };   // 1:20 : 1000 px trop large ; 1:50 : 400x280 px
  assert.equal(chooseScale(mid).n, 50, 'plus grande échelle normalisée tenant dans 554x298 px');
  const huge = { x0: 0, y0: 0, x1: 100000, y1: 100000 };
  const r = chooseScale(huge);
  assert.equal(r.n, 500);
  assert.equal(r.fits, false);
  assert.equal(chooseScale(null).n, 100);
  const lv = emptyPlan().levels[0];
  assert.equal(effectiveScale(lv), 100, 'vide -> 100 par défaut');
  lv.printScale = 75;
  assert.equal(effectiveScale(lv), 75);
});

test('géométrie : accrochage, orthogonal, mur le plus proche, emprise', () => {
  assert.equal(snap(12), 10);
  assert.equal(snap(13), 15);
  assert.deepEqual(orthoTarget(0, 0, 100, 30), { x: 100, y: 0 });
  assert.deepEqual(orthoTarget(0, 0, 30, 100), { x: 0, y: 100 });
  const plan = emptyPlan();
  const lv = plan.levels[0];
  addWall(plan, lv, { x1: 0, y1: 0, x2: 400, y2: 0 });
  const near = nearestWall(lv, 200, 5, 20);
  assert.ok(near && near.wall && Math.abs(near.pos - 0.5) < 1e-9);
  assert.equal(nearestWall(lv, 200, 100, 20), null);
  const b = levelBounds(lv);
  assert.equal(b.x0, -10);
  assert.equal(b.x1, 410);
  addRoom(plan, lv, { x: 50, y: 50, name: 'Salon' });
  assert.equal(levelBounds(lv).y1, 50);
});

test('ouvertures : largeur par défaut, bornage, suppression, suppression avec le mur', () => {
  const plan = emptyPlan();
  const lv = plan.levels[0];
  const w = addWall(plan, lv, { x1: 0, y1: 0, x2: 400, y2: 0 });
  const door = addOpening(plan, lv, { kind: 'door', wall: w.id, pos: 0.5 });
  assert.equal(door.w, 90, 'largeur de porte par défaut');
  assert.equal(door.hinge, DEFAULT_DOOR.hinge, 'charnière par défaut (bord gauche)');
  assert.equal(door.open, DEFAULT_DOOR.open, 'côté d’ouverture par défaut');
  const door2 = addOpening(plan, lv, { kind: 'door', wall: w.id, pos: 0.2, hinge: 1, open: -1 });
  assert.equal(door2.hinge, 1, 'charnière à droite demandée');
  assert.equal(door2.open, -1, 'côté d’ouverture demandé');
  const win = addOpening(plan, lv, { kind: 'window', wall: w.id, pos: 1.4, w: 0 });
  assert.equal(win.kind, 'window');
  assert.equal(win.w, 120, 'largeur de fenêtre par défaut');
  assert.equal(win.pos, 1, 'position bornée à 1');
  assert.deepEqual(pointOnWall(w, 0.5), { x: 200, y: 0 });
  removeOpening(lv, door.id);
  assert.equal(lv.openings.some((o) => o.id === door.id), false);
  removeWall(lv, w.id);
  assert.equal(lv.openings.length, 0, 'le mur emporte ses ouvertures');
});

test('textes : contenu, position, mise en forme et suppression', () => {
  const plan = emptyPlan();
  const lv = plan.levels[0];
  const r = addRoom(plan, lv, { x: 100, y: 200, name: 'Salon' });
  assert.equal(r.name, 'Salon');
  assert.deepEqual([r.x, r.y], [100, 200]);
  assert.equal(r.size, 1, 'taille par défaut');
  assert.equal(r.bold, false);
  assert.equal(r.italic, false);
  assert.equal(r.underline, false);
  r.x = 150; r.size = 2; r.bold = true;
  assert.equal(lv.rooms[0].x, 150, 'position modifiable en place');
  assert.equal(lv.rooms[0].size, 2, 'mise en forme modifiable en place');
  removeRoom(lv, r.id);
  assert.equal(lv.rooms.length, 0);
});

test('normalizePlan : textes — mise en forme par défaut, conservée et idempotente', () => {
  const p = emptyProject();
  p.plan = { seq: 0, levels: [{ id: 'p1', name: 'RDC', walls: [], openings: [], placements: [], rooms: [
    { id: 'r1', name: 'A', x: 1, y: 2 },
    { id: 'r2', name: 'B', x: 3, y: 4, size: 1.5, bold: true, italic: true, underline: true },
  ] }] };
  const rooms = normalizePlan(p).levels[0].rooms;
  assert.equal(rooms.length, 2);
  assert.equal(rooms[0].size, 1, 'taille par défaut');
  assert.equal(rooms[0].bold, false);
  assert.equal(rooms[0].italic, false);
  assert.equal(rooms[0].underline, false);
  assert.equal(rooms[1].size, 1.5);
  assert.equal(rooms[1].bold, true);
  assert.equal(rooms[1].italic, true);
  assert.equal(rooms[1].underline, true);
  p.plan = normalizePlan(p);                       // renormer ne change rien
  assert.deepEqual(normalizePlan(p).levels[0].rooms, rooms);
});

test('pages de plan : une seule par étage non vide', () => {
  const p = emptyProject();
  p.plan = emptyPlan();
  assert.equal(planFillCount(p), 0, 'plan vide -> aucune page');
  const lv = p.plan.levels[0];
  addWall(p.plan, lv, { x1: 0, y1: 0, x2: 400, y2: 0 });
  assert.equal(planFillCount(p), 1);
  const l2 = addLevel(p.plan);
  assert.equal(planFillCount(p), 1, 'étage vide compté pour rien');
  addRoom(p.plan, l2, { x: 10, y: 10, name: 'Étage' });
  assert.equal(planFillCount(p), 2);
});

test('format .elx : images référencées uniquement, aller-retour, absence tolérée', () => {
  const p = emptyProject();
  p.plan = emptyPlan();
  const lv = p.plan.levels[0];
  lv.bg = { asset: 'p9', x: 0, y: 0, w: 1000, h: 800, opacity: 0.5, visible: true, locked: true };
  const assets = { p9: 'data:image/jpeg;base64,AAAA', p42: 'data:image/png;base64,BBBB' };
  assert.deepEqual(Object.keys(referencedAssets(p, assets)), ['p9']);

  const { project, assets: back } = decodeElx(encodeElx(p, '0.3.0', assets));
  assert.equal(project.plan.levels[0].bg.asset, 'p9');
  assert.deepEqual(back, { p9: assets.p9 });

  lv.bg = null;
  const env = JSON.parse(atob(encodeElx(p, '0.3.0', assets)));
  assert.equal(env.assets, undefined, 'pas d’image sans référence');
  assert.deepEqual(decodeElx(encodeElx(p)).assets, {});
});

test('format .elx : assets invalides ignorés à la lecture', () => {
  const env = { format: 'elexio', formatVersion: 1, schemaVersion: 4, project: emptyProject(),
    assets: { ok: 'data:image/png;base64,AAAA', bad: 'javascript:alert(1)' } };
  const text = Buffer.from(JSON.stringify(env), 'utf8').toString('base64');
  assert.deepEqual(Object.keys(decodeElx(text).assets), ['ok']);
});
