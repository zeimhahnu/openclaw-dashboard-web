// Adapter: the live gateway's /state payload -> the model core.mjs understands.
// Nothing here writes. The runner owns every task transition.

const API = location.origin;          // same-origin; nginx proxies /state to :8443
const STALE_MS = 45_000;

/**
 * The roster is DATA, never markup — it comes from the manifest, not from this
 * file and not from the page. Adding a seventh agent is a manifest edit.
 *
 * The gateway currently reports only lil-claw / goop / mason (AGENTS_CFG is a
 * hardcoded 3-entry dict). Agents in the manifest but absent from the feed
 * render as "feed not connected" — visibly missing, never silently dropped.
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

function parseTs(v) {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Derive a display state from what the gateway actually reports.
 *
 * Deliberately does NOT use the feed's `health` field: that is computed from
 * process liveness, so a daemon that is up but has observed nothing for seven
 * days still says "green". We read `last_seen` and let staleness win.
 */
export function deriveAgent(id, row, manifestEntry, now = Date.now()) {
  const base = {
    id,
    name: manifestEntry?.name ?? id,
    room: manifestEntry?.room ?? 'Station',
    lane: manifestEntry?.lane ?? '',
    resident: manifestEntry?.resident !== false,
    sheet: manifestEntry?.sheet ?? null,
  };

  if (!row) {
    return { ...base, state: 'offline', connected: false, task: null, stage: null, observedAt: null, queue: 0, completedToday: 0 };
  }

  const observedAt = parseTs(row.last_seen);
  const stale = observedAt == null || now - observedAt > STALE_MS;

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
    // publicTitle built server-side — never this string with fields hidden in CSS.
    task: row.current_task ?? null,
    stage: row.current_stage ?? null,
    observedAt,
    stale,
    queue: row.queue_depth ?? row.inbox_count ?? 0,
    completedToday: row.completed_today ?? 0,
    cost: row.cost ?? null,
  };
}

/** Build the whole view model from one /state response plus the manifest. */
export function toModel(state, manifest, now = Date.now()) {
  const rows = state?.agents ?? {};
  const agents = manifest.agents
    .filter(a => a.resident !== false)
    .map(a => deriveAgent(a.id, rows[a.feedKey ?? a.id], a, now));

  const visitors = manifest.agents
    .filter(a => a.resident === false)
    .map(a => deriveAgent(a.id, rows[a.feedKey ?? a.id], a, now));

  return {
    ts: state?.ts ?? null,
    agents,
    visitors,
    // Packages are not in /state yet — the handoff event stream is step 3 work.
    // An empty list draws empty bays, which is true. It must never draw zeros
    // that look like measurements.
    packages: [],
    packagesConnected: false,
    lastSeq: 0,
    seen: [],
  };
}
