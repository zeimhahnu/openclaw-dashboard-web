// Adapter: the live gateway's /state payload -> the model the world renderer wants.
// Nothing here writes. The runner owns every task transition.

const API = () => (typeof location === 'undefined' ? '' : location.origin);  // same-origin; nginx proxies to :8443
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

const get = async (path, fallback) => {
  try {
    const r = await fetch(`${API()}${path}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch { return fallback; }   // a missing panel must not blank the page
};

/**
 * v3, not /state. /state is a v2 compatibility shim that never carried the
 * fields added since — `observed_at`, `observed_source`, `stale`, `system`,
 * `events`. Reading the shim is how a field lands server-side and stays
 * invisible for weeks.
 *
 * The three feeds are independent: a dead usage meter must not blank the floor.
 */
export async function fetchAll() {
  const [state, usage, tasks, active] = await Promise.all([
    get('/state/v3', null),
    get('/usage/tokens?days=7', null),
    get('/tasks/details', null),
    get('/tasks/active', null),      // claimed work; /tasks/details has no processing queue
  ]);
  if (!state) throw new Error('gateway unreachable');
  return { state, usage, tasks, active };
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

/* ---------------------------------------------------------------------------
   Token usage.

   Two traps this encodes, because both produce confident wrong numbers:

   1. v3 carries its OWN `usage` block from the old gateway-sessions meter. It
      reports `instrumented: false` and all zeros. Rendering it gives a cost
      panel full of zeros that reads as "we spent nothing". Ignore it entirely;
      the real meter is /usage/tokens, read from the per-agent transcript DBs.

   2. The fleet default is flat-rate OAuth (ChatGPT Plus, Claude). Those turns
      have NO dollar figure that exists anywhere, so the meter returns
      `cost_usd: null` with `cost_basis: "subscription"`. A $0 there is a lie in
      the cheapest possible direction. Only `provider-billed` rows get money.
--------------------------------------------------------------------------- */
export function toUsage(usage) {
  if (!usage) return { connected: false };
  const rows = Object.entries(usage.by_model ?? {})
    .map(([model, m]) => ({ model, ...m }))
    .filter(m => m.turns > 0)
    .sort((a, b) => b.turns - a.turns);

  const byAgent = Object.entries(usage.by_agent ?? {})
    .map(([id, m]) => ({ id, ...m }))
    .filter(m => m.turns > 0)
    .sort((a, b) => b.turns - a.turns);

  const billed = rows.filter(m => m.cost_basis === 'provider-billed');
  const metered = rows.filter(m => m.cost_basis === 'subscription');

  return {
    connected: true,
    turns: usage.turns ?? 0,
    tokensIn: usage.tokens_in ?? 0,
    tokensOut: usage.tokens_out ?? 0,
    cacheRead: usage.cache_read ?? 0,
    since: usage.meter_since ?? null,
    historySince: usage.history_since ?? null,
    byModel: rows,
    byAgent,
    // Only money that actually exists. Never a total across subscription rows.
    billedUsd: billed.reduce((n, m) => n + (m.cost_usd ?? 0), 0),
    billedTurns: billed.reduce((n, m) => n + m.turns, 0),
    subscriptionTurns: metered.reduce((n, m) => n + m.turns, 0),
    byDay: usage.by_day ?? {},
    quotaPressure: usage.quota_pressure ?? null,
  };
}

/* ---------------------------------------------------------------------------
   Task triage.

   Ordered by what actually needs a human, not by recency:
   deadletter first (these fail silently and nobody audits red), then work in
   flight, then what is queued. A shipped item is history, not triage.
--------------------------------------------------------------------------- */
const QUEUES = [
  { key: 'deadletter', label: 'Dead-lettered', tone: 'bad', note: 'Failed and parked. Nothing retries these on its own.' },
  { key: 'processing', label: 'In flight', tone: 'busy', note: 'Claimed by a runner.' },
  { key: 'inbox', label: 'Queued', tone: 'calm', note: 'Waiting for a runner to claim.' },
  { key: 'outbox', label: 'Shipped', tone: 'done', note: 'Completed. History, not triage.' },
];

export function toTriage(tasks, active, manifest, now = Date.now()) {
  if (!tasks) return { connected: false, queues: [] };
  const nameOf = id => manifest.agents.find(a => (a.feedKey ?? a.id) === id || a.id === id)?.name ?? id;

  const item = (t, agentKey) => {
    const created = parseTs(t.createdAt) ?? parseTs(t.completedAt);
    return {
      id: typeof t === 'string' ? t.replace(/\.json$/, '') : t.id,
      type: t.type || '—', status: t.status || '—', priority: t.priority || null,
      agent: nameOf(agentKey),
      ageH: t.age_h ?? (created ? (now - created) / 3.6e6 : null),
    };
  };

  const build = (key, pick) => {
    const items = [];
    let total = 0;
    for (const [agentKey, q] of Object.entries(tasks)) {
      // TOTAL comes from the gateway's own count, never from the list length:
      // the list is capped at `list_limit` and counting it under-reports, which
      // is the one direction a triage board must never be wrong in.
      total += q?.total?.[key] ?? 0;
      for (const t of (pick(q, agentKey) ?? [])) items.push(item(t, agentKey));
    }
    return { items, total };
  };

  const dead = build('deadletter', q => q?.deadletter);
  const queued = build('inbox', q => q?.inbox);
  const shipped = build('outbox', q => q?.outbox);

  // In flight is a separate endpoint: /tasks/details serves no processing queue,
  // so reading one from it silently reported zero claimed work forever.
  const flight = { items: [], total: 0 };
  for (const [agentKey, files] of Object.entries(active ?? {})) {
    for (const f of files ?? []) { flight.items.push(item(f, agentKey)); flight.total++; }
  }

  const cap = tasks[Object.keys(tasks)[0]]?.list_limit ?? null;
  const QS = [
    { key: 'deadletter', label: 'Dead-lettered', tone: 'bad', ...dead,
      note: 'Failed and parked. Nothing retries these on its own.' },
    { key: 'processing', label: 'In flight', tone: 'busy', ...flight,
      note: 'Claimed by a runner.' },
    { key: 'inbox', label: 'Queued', tone: 'calm', ...queued,
      note: 'Waiting for a runner to claim.' },
    { key: 'outbox', label: 'Shipped', tone: 'done', ...shipped,
      note: 'Completed. History, not triage.' },
  ];

  for (const q of QS) {
    q.items.sort((a, b) => q.key === 'deadletter'
      ? (a.ageH ?? 0) - (b.ageH ?? 0)
      : (b.ageH ?? 0) - (a.ageH ?? 0));
    q.count = q.total;
    q.shown = q.items.length;
    // The gateway hands back the most recent N. Say so rather than implying the
    // list is the whole queue.
    q.capped = q.shown < q.total;
    q.aged = q.items.filter(i => (i.ageH ?? 0) > 720).length;
    q.fresh = q.shown - q.aged;
  }
  return { connected: true, queues: QS, listLimit: cap };
}

/** Recent lifecycle events, newest first. */
export function toActivity(state) {
  return (state?.events ?? []).map(e => ({
    ts: e.ts, source: e.source, agent: e.agent, text: e.text,
  }));
}

/** Box health. `system` is only on v3. */
export function toSystem(state) {
  const s = state?.system;
  if (!s) return { connected: false };
  return {
    connected: true,
    memPct: s.mem?.pct, memUsed: s.mem?.used_mb, memTotal: s.mem?.total_mb,
    diskPct: s.disk?.pct, diskUsed: s.disk?.used_gb, diskTotal: s.disk?.total_gb,
    load1: s.load_1, load5: s.load_5, load15: s.load_15,
    uptimeH: s.uptime_h,
    gateway: s.gateway?.active, nginx: s.nginx?.active,
  };
}
