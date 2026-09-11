// node --test public/mission/core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutRooms, stageSize, routeBetween, alongRoute,
  counts, effectiveState, applyEvent, frameFor, animates,
} from './core.js';

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

const sheet = {
  states: {
    working: { frames: [0, 2, 4], ms: 100 },
    idle: { frames: [5, 5, 5, 1], ms: 500 },
    blocked: { frames: [3] },
    asleep: { frames: [1] },
    offline: { frames: [1] },
  },
};

test('frames cycle in manifest order, at the state\'s own tempo', () => {
  assert.equal(frameFor('working', sheet, 0), 0);
  assert.equal(frameFor('working', sheet, 150), 2);
  assert.equal(frameFor('working', sheet, 250), 4);
  assert.equal(frameFor('working', sheet, 350), 0, 'wraps');
  // Idle runs on its own slower clock, and a repeated frame weights it.
  assert.equal(frameFor('idle', sheet, 0), 5);
  assert.equal(frameFor('idle', sheet, 1200), 5);
  assert.equal(frameFor('idle', sheet, 1600), 1, 'the blink lands on the 4th beat');
});

test('a stopped state never animates — this is the rule that keeps the floor honest', () => {
  // A stuck agent that keeps working tells the viewer it is working, and the
  // floor outvotes the table.
  for (const t of [0, 500, 5_000, 60_000]) {
    assert.equal(frameFor('blocked', sheet, t), 3);
    assert.equal(frameFor('asleep', sheet, t), 1);
  }
  assert.equal(animates('blocked', sheet), false);
  assert.equal(animates('asleep', sheet), false);
  assert.equal(animates('offline', sheet), false);
  assert.equal(animates('working', sheet), true);
  assert.equal(animates('idle', sheet), true, 'idle breathes');
});

test('idle is unmistakably slower than working', () => {
  const w = sheet.states.working, i = sheet.states.idle;
  assert.ok(i.ms >= w.ms * 3, `idle ${i.ms}ms must read as a different tempo to working ${w.ms}ms`);
});

test('an unknown state falls back to idle, and a missing sheet to frame 0', () => {
  assert.equal(frameFor('wedged', sheet, 0), 5);
  assert.equal(frameFor('working', undefined, 999), 0);
  assert.equal(frameFor('working', { states: { working: { frames: [] } } }, 999), 0);
});

test('every shipped sheet defines all five states, and never animates a stopped one', async () => {
  const { readFile } = await import('node:fs/promises');
  const m = JSON.parse(await readFile(new URL('./assets/MANIFEST.json', import.meta.url), 'utf8'));
  const total = m.sheetDefaults.cols * m.sheetDefaults.rows;
  for (const a of m.agents.filter(a => a.sheet)) {
    for (const s of ['working', 'idle', 'blocked', 'asleep', 'offline']) {
      const set = a.states?.[s];
      assert.ok(set?.frames?.length, `${a.id} is missing the ${s} state`);
      assert.ok(set.frames.every(f => Number.isInteger(f) && f >= 0 && f < total),
        `${a.id}.${s} references a frame outside the ${total}-frame sheet`);
      if (s !== 'working' && s !== 'idle') {
        assert.equal(set.frames.length, 1, `${a.id}.${s} must be a single held frame`);
      }
    }
    assert.ok(a.states.idle.ms >= a.states.working.ms * 2,
      `${a.id}: idle must read slower than working`);
    // Row alignment: without these the floor jumps when the loop crosses rows.
    assert.ok(a.frameH > 0 && Array.isArray(a.rowTop) && a.rowTop.length === 2,
      `${a.id} is missing measured row alignment`);
  }
});
