// node --test public/mission/core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GEOMETRY, layoutAgents, project, unproject, routeBetween, alongRoute,
  sortDrawables, counts, effectiveState, applyEvent, packageSlots, avoidLabelCollisions,
} from './core.js';

const six = ['goop', 'iris', 'rook', 'vera', 'lil-claw', 'pip'].map(id => ({ id, state: 'idle' }));

test('six agents form two facing banks around one aisle', () => {
  const rooms = layoutAgents(six);
  assert.deepEqual(rooms.map(r => r.bank), [0, 0, 0, 1, 1, 1]);
  // One shared aisle: every room in the pair hands off along the same lane.
  assert.equal(new Set(rooms.map(r => r.aisleY)).size, 1);
  // Doors face the aisle: bank 0 at the far edge, bank 1 at the near edge.
  assert.equal(rooms[0].door.y, rooms[0].y + GEOMETRY.roomH);
  assert.equal(rooms[3].door.y, rooms[3].y);
});

test('a non-resident agent gets no room', () => {
  const rooms = layoutAgents([...six, { id: 'mason', resident: false }]);
  assert.equal(rooms.length, 6);
  assert.ok(!rooms.some(r => r.id === 'mason'), 'Mason is a visitor, not a resident');
});

test('projection round-trips, so a floor click maps back to a room', () => {
  for (const [x, y] of [[0, 0], [194, 184], [-30, 500], [472, 272]]) {
    const q = project(x, y, 0), back = unproject(q.x, q.y);
    assert.ok(Math.abs(back.x - x) < 1e-6 && Math.abs(back.y - y) < 1e-6, `${x},${y}`);
  }
});

test('the route leaves through a door and runs the aisle, never diagonally through rooms', () => {
  const rooms = layoutAgents(six);
  const [from, , , to] = rooms;
  const route = routeBetween(from, to);
  assert.deepEqual(alongRoute(route, 1), to.dock);
  assert.ok(route.some(p => p.x === from.door.x && p.y === from.door.y), 'passes the source door');
  assert.ok(route.some(p => p.y === from.aisleY), 'joins the shared aisle');
});

test('depth is keyed on ground support, never on a parcel lift', () => {
  const items = [
    { id: 'far', x: 10, y: 10, layer: 0 },
    { id: 'near', x: 200, y: 200, layer: 0 },
    { id: 'tie-b', x: 100, y: 100, layer: 3 },
    { id: 'tie-a', x: 100, y: 100, layer: 1 },
  ];
  assert.deepEqual(sortDrawables(items).map(i => i.id), ['far', 'tie-a', 'tie-b', 'near']);
  // Shuffling the input must not change the order — the sort is total and stable.
  assert.deepEqual(sortDrawables([...items].reverse()).map(i => i.id),
    ['far', 'tie-a', 'tie-b', 'near']);
});

test('counts conserve: completed = ready + transit + sent', () => {
  const pkgs = [
    { id: '1', from: 'a', status: 'ready' }, { id: '2', from: 'a', status: 'transit' },
    { id: '3', from: 'a', status: 'received' }, { id: '4', from: 'b', status: 'ready' },
  ];
  const c = counts(pkgs, 'a');
  assert.equal(c.completed, 3);
  assert.equal(c.ready + c.transit + c.sent, c.completed);
});

test('staleness wins over the reported state', () => {
  const now = 1_000_000;
  assert.equal(effectiveState({ state: 'working', observedAt: now - 1000 }, now), 'working');
  assert.equal(effectiveState({ state: 'working', observedAt: now - 60_000 }, now), 'offline');
  assert.equal(effectiveState({ state: 'working', observedAt: null }, now), 'offline');
});

const blank = { lastSeq: 0, seen: [], agents: [{ id: 'a', state: 'idle' }], packages: [] };
const done = (seq, id) => ({ id: `e${seq}`, seq, type: 'task.completed', package: { id, from: 'a', to: 'b' } });

test('the reducer refuses replays, duplicates and gaps', () => {
  const m = applyEvent(blank, done(1, 'p1'));
  assert.equal(m.packages.length, 1);
  assert.equal(applyEvent(m, done(1, 'p1')).packages.length, 1);
  assert.equal(applyEvent(m, done(1, 'p2')).packages.length, 1);
  const gapped = applyEvent(m, done(3, 'p3'));
  assert.equal(gapped.resyncRequired, true);
  assert.equal(gapped.packages.length, 1);
});

test('a failed transfer restores the SAME package id — one retry path, no -retry suffix', () => {
  let m = applyEvent(blank, done(1, 'p1'));
  m = applyEvent(m, { id: 'd', seq: 2, type: 'handoff.departed', packageId: 'p1' });
  assert.equal(m.packages[0].status, 'transit');
  m = applyEvent(m, { id: 'f', seq: 3, type: 'handoff.failed', packageId: 'p1' });
  assert.equal(m.packages.length, 1, 'no retry package is minted');
  assert.equal(m.packages[0].id, 'p1');
  assert.equal(m.packages[0].status, 'ready');
});

test('receipt moves a package, it does not create a completed output', () => {
  let m = applyEvent(blank, done(1, 'p1'));
  m = applyEvent(m, { id: 'd', seq: 2, type: 'handoff.departed', packageId: 'p1' });
  m = applyEvent(m, { id: 'r', seq: 3, type: 'handoff.received', packageId: 'p1' });
  assert.equal(counts(m.packages, 'a').completed, 1);
  assert.equal(counts(m.packages, 'a').sent, 1);
});

test('bays draw at most 12 parcels; the overflow is exact, not a guess', () => {
  const o = { x: 0, y: 0 };
  assert.equal(packageSlots(5, o).length, 5);
  assert.equal(packageSlots(40, o).length, 12);
});

test('nameplates never overlap and stay inside the stage', () => {
  const cand = Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, x: 50, y: 20, w: 96, h: 27 }));
  const placed = avoidLabelCollisions(cand, 800, 600);
  for (let i = 0; i < placed.length; i++) {
    assert.ok(placed[i].x >= 0 && placed[i].x + placed[i].w <= 800, 'clamped horizontally');
    assert.ok(placed[i].y >= 0 && placed[i].y + placed[i].h <= 600, 'clamped vertically');
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      assert.ok(!overlap, `plate ${i} overlaps ${j}`);
    }
  }
});

test('the manifest is the roster, and every resident has a station and sprite', async () => {
  const m = JSON.parse(await readFile(new URL('./assets/MANIFEST.json', import.meta.url), 'utf8'));
  const residents = m.agents.filter(a => a.resident !== false);
  assert.equal(residents.length, 6);
  for (const a of residents) {
    for (const k of ['station', 'sprite', 'color', 'floor', 'wall', 'trim', 'room', 'lane']) {
      assert.ok(a[k], `${a.id} is missing ${k}`);
    }
  }
  // No image assets: the sheets are reference, not runtime atlases.
  assert.ok(!JSON.stringify(m).match(/\.(png|webp|jpg)"/), 'manifest must not reference image files');
  // Layout must hold for the roster as configured, and for a 7th agent later.
  assert.equal(layoutAgents(residents).length, 6);
  assert.equal(layoutAgents([...residents, { id: 'new' }]).length, 7);
});
