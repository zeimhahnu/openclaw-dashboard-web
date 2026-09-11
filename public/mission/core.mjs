// Mission Control — pure core. No DOM, no fetch, no canvas.
// Everything here is a function of its arguments so core.test.mjs can drive it.

// ponytail: rooms are baked isometric PNGs, so tiles are placed in SCREEN space.
// The prototype's project()/unproject()/sortDrawables() existed to compose a world
// out of primitives; a pre-rendered room carries its own perspective and its own
// depth. Nothing in this file projects anything.

export const LAYOUT = Object.freeze({
  tileW: 300,     // drawn room width, px (height follows the sheet's aspect)
  gapX: 18,       // gap between rooms in a bank
  aisle: 76,      // vertical gap between the two banks — the parcel travels here
  cols: 3,
  pad: 24,
});

/** Place N agents on a grid of banks. Returns screen-space boxes + dock points. */
export function layoutRooms(agents, { tileW, tileH, cols } = {}) {
  const L = LAYOUT;
  const w = tileW ?? L.tileW;
  const h = tileH ?? Math.round(w * 2 / 3);
  const perBank = cols ?? L.cols;
  return agents.map((a, i) => {
    const bank = Math.floor(i / perBank);
    const col = i % perBank;
    const x = L.pad + col * (w + L.gapX);
    const y = L.pad + bank * (h + L.aisle);
    return {
      ...a, x, y, w, h, bank, col,
      // The aisle line this room hands off along: below its own bank.
      aisleY: y + h + L.aisle / 2,
      // Where a parcel enters/leaves the room — bottom-centre of the tile.
      dock: { x: x + w / 2, y: y + h - 6 },
    };
  });
}

/** Total canvas size needed for a laid-out set of rooms. */
export function stageSize(rooms) {
  if (!rooms.length) return { w: 0, h: 0 };
  const w = Math.max(...rooms.map(r => r.x + r.w)) + LAYOUT.pad;
  const h = Math.max(...rooms.map(r => r.y + r.h)) + LAYOUT.pad;
  return { w, h };
}

/** Screen-space waypoints: out of the source, along the aisle, into the target. */
export function routeBetween(from, to) {
  const lane = from.bank <= to.bank ? from.aisleY : to.aisleY;
  const pts = [
    from.dock,
    { x: from.dock.x, y: lane },
    { x: to.dock.x, y: lane },
    to.dock,
  ];
  // Drop zero-length segments so alongRoute() never divides by a 0 length.
  return pts.filter((p, i) => !i || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
}

/** Point at `progress` (0..1) along a polyline. */
export function alongRoute(route, progress) {
  if (route.length < 2) return route[0];
  const seg = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
  const total = seg.reduce((a, b) => a + b, 0);
  let left = total * Math.max(0, Math.min(1, progress));
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i] || i === seg.length - 1) {
      const u = seg[i] === 0 ? 0 : Math.min(1, left / seg[i]);
      return {
        x: route[i].x + (route[i + 1].x - route[i].x) * u,
        y: route[i].y + (route[i + 1].y - route[i].y) * u,
      };
    }
    left -= seg[i];
  }
  return route[route.length - 1];
}

/** Package tallies for one agent. completed = ready + transit + sent. */
export function counts(packages, agentId) {
  const own = packages.filter(p => p.from === agentId);
  return {
    completed: own.length,
    ready: own.filter(p => p.status === 'ready').length,
    transit: own.filter(p => p.status === 'transit').length,
    sent: own.filter(p => p.status === 'received').length,
  };
}

/**
 * Freshness gate. `offline` is a FEED condition layered over the reported state —
 * it is not evidence the agent is asleep.
 *
 * We compute this client-side on purpose: the gateway's own `health` field is
 * derived from process liveness, so a daemon that is up but has not observed
 * anything for a week still reports green. Do not trust the server's green.
 */
export function effectiveState(agent, now, staleAfterMs = 45_000) {
  if (agent.observedAt == null) return 'offline';
  if (now - agent.observedAt > staleAfterMs) return 'offline';
  return agent.state;
}

/**
 * Event reducer. Ordered, de-duplicated, gap-detecting.
 * A gap sets resyncRequired rather than applying out of order — a board that
 * silently drops an event is how a green ledger ends up disagreeing with reality.
 */
export function applyEvent(model, event) {
  if (!event?.id || !Number.isInteger(event.seq)) return model;
  if (event.seq <= model.lastSeq || model.seen.includes(event.id)) return model;
  if (event.seq !== model.lastSeq + 1) return { ...model, resyncRequired: true };

  const next = structuredClone(model);
  next.lastSeq = event.seq;
  next.seen = [...next.seen, event.id].slice(-1000);
  const pkg = id => next.packages.find(p => p.id === id);

  switch (event.type) {
    case 'task.completed':
      // One package per completed stage, stable across replay.
      if (!next.packages.some(p => p.id === event.package.id)) {
        next.packages.push({ ...event.package, status: 'ready' });
      }
      break;
    case 'handoff.departed': {
      const p = pkg(event.packageId); if (p?.status === 'ready') p.status = 'transit';
      break;
    }
    case 'handoff.received': {
      const p = pkg(event.packageId); if (p?.status === 'transit') p.status = 'received';
      break;
    }
    case 'handoff.failed': {
      // Restores the SAME package id to ready. A failed transfer never mints one.
      const p = pkg(event.packageId); if (p?.status === 'transit') p.status = 'ready';
      break;
    }
    case 'agent.state': {
      const a = next.agents.find(a => a.id === event.agentId);
      if (a) {
        a.state = event.state;
        a.observedAt = event.observedAt;
        if (event.publicTitle !== undefined) a.publicTitle = event.publicTitle;
      }
      break;
    }
  }
  return next;
}

/**
 * The frame set for a state, from the manifest. Frame ORDER and tempo are data,
 * so a loop can be retimed or re-ordered without touching code.
 *
 * A one-entry `frames` array is the frozen case and needs no special handling:
 * `x % 1 === 0` always, so `ms` is simply irrelevant for it.
 */
export function framesFor(state, sheet) {
  const s = sheet?.states;
  if (!s) return { frames: [0] };
  return s[state] ?? s.idle ?? { frames: [0] };
}

/** Which frame to show now. */
export function frameFor(state, sheet, tMs) {
  const { frames, ms = 1000 } = framesFor(state, sheet);
  if (!frames?.length) return 0;
  return frames[Math.floor(Math.max(0, tMs) / ms) % frames.length];
}

/** True when this state actually moves — lets the renderer stop a still floor. */
export function animates(state, sheet) {
  return framesFor(state, sheet).frames.length > 1;
}

/**
 * Visual treatment per state. The world dims and badges; it never invents a pose
 * the artwork does not contain.
 *
 * `asleep` and `offline` must not look alike: asleep is a warm dim, meaning
 * deliberately off; offline is desaturated, meaning we cannot see. Conflating
 * them would let a dead feed read as a resting agent.
 */
export const STATE_STYLE = Object.freeze({
  working: { filter: 'none', badge: null },
  idle: { filter: 'none', badge: null },
  blocked: { filter: 'saturate(.6) brightness(.86)', badge: '!' },
  asleep: { filter: 'brightness(.5) saturate(.75) sepia(.25)', badge: 'z' },
  offline: { filter: 'grayscale(.92) brightness(.6)', badge: '?' },
});
