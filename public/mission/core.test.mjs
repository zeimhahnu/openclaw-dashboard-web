// node --test public/mission/core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutRooms, stageSize, routeBetween, alongRoute,
  counts, effectiveState, applyEvent, frameFor,
} from './core.mjs';

const agents = ['a', 'b', 'c', 'd'].map(id => ({ id, state: 'idle' }));

test('layout wraps at the requested column count', () => {
  const rooms = layoutRooms(agents, { tileW: 100, tileH: 60, cols: 2 });
  assert.deepEqual(rooms.map(r => r.bank), [0, 0, 1, 1]);
  assert.deepEqual(rooms.map(r => r.col), [0, 1, 0, 1]);
  assert.ok(rooms[2].y > rooms[0].y, 'second bank sits below the first');
  const size = stageSize(rooms);
  assert.ok(size.w > 0 && size.h > rooms[3].y);
});

test('a route starts at the source dock and ends at the target dock', () => {
  const [from, , to] = layoutRooms(agents, { tileW: 100, tileH: 60, cols: 2 });
  const route = routeBetween(from, to);
  assert.deepEqual(alongRoute(route, 0), from.dock);
  assert.deepEqual(alongRoute(route, 1), to.dock);
  const mid = alongRoute(route, 0.5);
  assert.ok(mid.y > from.dock.y, 'the parcel travels through the aisle, not across the rooms');
});

test('alongRoute survives a degenerate route', () => {
  const p = { x: 5, y: 5 };
  assert.deepEqual(alongRoute([p], 0.5), p);
  assert.deepEqual(alongRoute([p, p], 0.5), p);   // zero-length segment, no NaN
});

test('counts conserve: completed = ready + transit + sent', () => {
  const pkgs = [
    { id: '1', from: 'a', status: 'ready' },
    { id: '2', from: 'a', status: 'transit' },
    { id: '3', from: 'a', status: 'received' },
    { id: '4', from: 'b', status: 'ready' },
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
const completed = (seq, id) => ({ id: `e${seq}`, seq, type: 'task.completed', package: { id, from: 'a', to: 'b' } });

test('the reducer refuses replays, duplicates and gaps', () => {
  let m = applyEvent(blank, completed(1, 'p1'));
  assert.equal(m.packages.length, 1);

  // Same event again — no second package.
  assert.equal(applyEvent(m, completed(1, 'p1')).packages.length, 1);
  // A new id at an already-applied seq is still refused.
  assert.equal(applyEvent(m, completed(1, 'p2')).packages.length, 1);
  // A gap flags a resync instead of applying out of order.
  const gapped = applyEvent(m, completed(3, 'p3'));
  assert.equal(gapped.resyncRequired, true);
  assert.equal(gapped.packages.length, 1);
});

test('a duplicate completion id cannot mint a second package', () => {
  let m = applyEvent(blank, completed(1, 'p1'));
  m = applyEvent(m, completed(2, 'p1'));            // same package, fresh event id
  assert.equal(m.packages.length, 1);
});

test('a failed transfer restores the SAME package to ready', () => {
  let m = applyEvent(blank, completed(1, 'p1'));
  m = applyEvent(m, { id: 'd', seq: 2, type: 'handoff.departed', packageId: 'p1' });
  assert.equal(m.packages[0].status, 'transit');
  m = applyEvent(m, { id: 'f', seq: 3, type: 'handoff.failed', packageId: 'p1' });
  assert.equal(m.packages.length, 1, 'no retry package is minted');
  assert.equal(m.packages[0].status, 'ready');
  assert.equal(m.packages[0].id, 'p1', 'the id is unchanged — one retry path, no -retry suffix');
});

test('receipt moves a package, it does not create a completed output', () => {
  let m = applyEvent(blank, completed(1, 'p1'));
  m = applyEvent(m, { id: 'd', seq: 2, type: 'handoff.departed', packageId: 'p1' });
  m = applyEvent(m, { id: 'r', seq: 3, type: 'handoff.received', packageId: 'p1' });
  const c = counts(m.packages, 'a');
  assert.equal(c.completed, 1);
  assert.equal(c.sent, 1);
});

test('frames rest unless working, and cycle in manifest order', () => {
  const sheet = { workLoop: [0, 2, 4], frameMs: 100, restFrame: 1 };
  assert.equal(frameFor('idle', sheet, 999), 1);
  assert.equal(frameFor('blocked', sheet, 999), 1);
  assert.equal(frameFor('working', sheet, 0), 0);
  assert.equal(frameFor('working', sheet, 150), 2);
  assert.equal(frameFor('working', sheet, 250), 4);
  assert.equal(frameFor('working', sheet, 350), 0, 'wraps');
  // A sheet with one frame never animates, and never divides by zero.
  assert.equal(frameFor('working', { workLoop: [3] }, 999), 3);
});
