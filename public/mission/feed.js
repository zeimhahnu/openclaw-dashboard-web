// Adapter: the live gateway's /state payload -> the model the world renderer wants.
// Nothing here writes. The runner owns every task transition.

const API = location.origin;          // same-origin; nginx proxies /state to :8443
const STALE_MS = 45_000;

/**
 * The roster is DATA, never markup — it comes from the manifest. Each entry
 * carries its station, sprite and room palette, which is what the renderer
 * needs; adding a seventh agent is a manifest edit and no code change.
 */
export async function loadManifest() {
  const r = await fetch('assets/MANIFEST.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`manifest ${r.status}`);
  return r.json();
}

export async function fetchState() {
  const r = await fetch(`${API}/state`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`state ${r.status}`);
  return r.json();
}

const parseTs = v => { const ms = Date.parse(v ?? ''); return Number.isNaN(ms) ? null : ms; };

/** "40s", "4m", "2h", "3d" — how long since this agent was last observed. */
export function elapsed(sinceMs, now) {
  if (sinceMs == null) return '—';
  const s = Math.max(0, (now - sinceMs) / 1000);
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  if (s < 172800) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/**
 * Derive a display state from what the gateway reports.
 *
 * Freshness is the SERVER's call since 2026-09-11: it emits `stale` and
 * `observed_at` with a per-agent threshold it knows and we do not. We only
 * compute it ourselves when the field is absent — an older gateway — because
 * two independent freshness rules that can disagree is worse than either.
 *
 * `health` is never trusted alone: it is derived from process liveness, so a
 * daemon that is up but had observed nothing for a week still reported green.
 */
export function deriveAgent(entry, row, now = Date.now()) {
  const base = {
    id: entry.id, name: entry.name, room: entry.room, lane: entry.lane,
    station: entry.station, sprite: entry.sprite,
    color: entry.color, floor: entry.floor, wall: entry.wall, trim: entry.trim,
    resident: entry.resident !== false,
  };

  if (!row) {
    return { ...base, state: 'offline', connected: false, elapsed: '—',
             publicTitle: 'Not reported by the gateway', observedAt: null,
             queue: 0, completedToday: 0 };
  }

  const observedAt = parseTs(row.observed_at ?? row.last_seen);
  const stale = row.stale ?? (observedAt == null || now - observedAt > STALE_MS);

  let state;
  if (stale) state = 'offline';
  else if (row.health === 'red') state = 'blocked';
  else if (row.session_active && row.current_task) state = 'working';
  else state = 'idle';

  return {
    ...base,
    state,
    connected: true,
    // Ops plane only. The public projection replaces this with an authored
    // title built server-side — never this string hidden with CSS.
    publicTitle: row.current_task ?? null,
    stage: row.current_stage ?? null,
    blockReason: state === 'blocked' ? (row.current_task ?? 'No reason reported') : null,
    elapsed: elapsed(observedAt, now),
    observedAt, stale,
    queue: row.queue_depth ?? row.inbox_count ?? 0,
    completedToday: row.completed_today ?? 0,
    cost: row.cost ?? null,
  };
}

/** Build the whole view model from one /state response plus the manifest. */
export function toModel(state, manifest, now = Date.now()) {
  const rows = state?.agents ?? {};
  const pick = e => deriveAgent(e, rows[e.feedKey ?? e.id], now);
  const visitorEntry = manifest.agents.find(a => a.resident === false);
  const visitor = visitorEntry ? pick(visitorEntry) : null;

  return {
    mode: 'live',
    ts: state?.ts ?? null,
    agents: manifest.agents.filter(a => a.resident !== false).map(pick),
    // Handoff events are not on the feed yet, so the bays are empty — which is
    // true. They must never be filled with zeros that read as measurements.
    packages: [],
    packagesConnected: false,
    lastSeq: 0,
    seen: [],
    presence: visitor
      ? { name: visitor.name,
          state: visitor.state === 'working' ? 'active' : visitor.state === 'offline' ? 'offline' : 'listening' }
      : { name: 'Mason', state: 'offline' },
    health: { ingress: null, deadletters: null },
    cost: null,
  };
}
