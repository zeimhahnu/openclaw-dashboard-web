// The floor. Draws pre-rendered isometric room sheets onto one canvas.
//
// ponytail: there is no procedural art layer and no depth solver here. Each room
// is a baked image that already contains its own perspective, furniture and
// occlusion, so the renderer's whole job is: pick a frame, draw it in its box.
// The travelling parcel stays in the aisle BETWEEN tiles, so nothing ever needs
// to be sorted against anything.

import { layoutRooms, stageSize, routeBetween, alongRoute, frameFor, STATE_STYLE } from './core.mjs';

const MAX_FPS = 30;

/** Load a sheet; a missing file resolves to null so the room degrades, not breaks. */
function loadSheet(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function createWorld(canvas, manifest, onSelect) {
  const ctx = canvas.getContext('2d');
  const defaults = manifest.sheetDefaults ?? {};
  const sheets = new Map();          // agent id -> {img, cols, rows, top, cellW, cellH, ...}
  let rooms = [];
  let stage = { w: 0, h: 0 };
  let model = { agents: [], packages: [] };
  let selected = null;
  let handoff = null;                // {from, to, progress} — event-driven only
  let running = false, paused = false, reduced = false;
  let last = 0, raf = 0;

  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  reduced = reduceQuery.matches;
  reduceQuery.addEventListener('change', e => { reduced = e.matches; draw(); });

  async function loadAssets() {
    await Promise.all(manifest.agents.map(async a => {
      if (!a.sheet) return;
      const img = await loadSheet(`assets/${a.sheet}`);
      if (!img) return;                                   // placeholder path
      const cfg = { ...defaults, ...a };
      const cols = cfg.cols, rows = cfg.rows, top = cfg.top ?? 0;
      sheets.set(a.id, {
        img, cols, rows, top,
        cellW: img.naturalWidth / cols,
        cellH: (img.naturalHeight - top) / rows,
        frameMs: cfg.frameMs, restFrame: cfg.restFrame, workLoop: cfg.workLoop,
      });
    }));
  }

  function resize() {
    const cssW = canvas.parentElement.clientWidth;
    // Tile width follows the container so the floor never needs a horizontal scroll.
    const cols = cssW < 640 ? 1 : cssW < 980 ? 2 : 3;
    const tileW = Math.floor((cssW - 48 - (cols - 1) * 18) / cols);
    const first = sheets.values().next().value;
    const aspect = first ? first.cellH / first.cellW : 2 / 3;
    rooms = layoutRooms(model.agents, { tileW, tileH: Math.round(tileW * aspect), cols });
    stage = stageSize(rooms);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(stage.w * dpr);
    canvas.height = Math.round(stage.h * dpr);
    canvas.style.width = `${stage.w}px`;
    canvas.style.height = `${stage.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;                    // keep pixel art crisp
    return stage;
  }

  function drawPlaceholder(r) {
    ctx.fillStyle = '#22383d';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#3d5a60';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
    ctx.setLineDash([]);
    ctx.fillStyle = '#8fa9ad';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('no character art', r.x + r.w / 2, r.y + r.h / 2);
    ctx.textAlign = 'left';
  }

  function drawRoom(r, t) {
    const sheet = sheets.get(r.id);
    if (!sheet) return drawPlaceholder(r);

    const state = r.state ?? 'offline';
    const style = STATE_STYLE[state] ?? STATE_STYLE.offline;
    const animate = state === 'working' && !paused && !reduced;
    const idx = frameFor(animate ? 'working' : 'rest', sheet, t);
    const sx = (idx % sheet.cols) * sheet.cellW;
    const sy = sheet.top + Math.floor(idx / sheet.cols) * sheet.cellH;

    ctx.save();
    if (style.filter !== 'none') ctx.filter = style.filter;
    ctx.drawImage(sheet.img, sx, sy, sheet.cellW, sheet.cellH, r.x, r.y, r.w, r.h);
    ctx.restore();

    if (r.id === selected) {
      ctx.strokeStyle = '#7fd4c0';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
    if (style.badge) drawBadge(r, style.badge, state);
  }

  function drawBadge(r, glyph, state) {
    const cx = r.x + r.w - 22, cy = r.y + 22;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fillStyle = state === 'blocked' ? '#d98038' : '#4a5f64';
    ctx.fill();
    ctx.fillStyle = '#16292e';
    ctx.font = 'bold 15px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, cx, cy + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawParcel(p, received) {
    ctx.fillStyle = '#0d1b1f66';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = received ? '#8fac98' : '#d2b37b';
    ctx.fillRect(p.x - 9, p.y - 9, 18, 16);
    ctx.strokeStyle = received ? '#b5d4b7' : '#f0d7a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 9); ctx.lineTo(p.x, p.y + 7);
    ctx.stroke();
  }

  function draw(t = 0) {
    ctx.fillStyle = manifest.background ?? '#16292e';
    ctx.fillRect(0, 0, stage.w, stage.h);
    for (const r of rooms) drawRoom(r, t);
    if (handoff) {
      const from = rooms.find(r => r.id === handoff.from);
      const to = rooms.find(r => r.id === handoff.to);
      if (from && to) drawParcel(alongRoute(routeBetween(from, to), handoff.progress), false);
    }
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 1000 / MAX_FPS) return;
    last = t;
    draw(t);
  }

  function start() {
    if (running || document.hidden) return;
    running = true; raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false; cancelAnimationFrame(raf);
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  addEventListener('resize', () => { resize(); draw(); });

  canvas.addEventListener('click', e => {
    const b = canvas.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    const hit = rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (hit) { selected = hit.id; onSelect?.(hit.id); draw(); }
  });

  return {
    async init() { await loadAssets(); },
    setModel(next) {
      model = next;
      if (!selected && next.agents[0]) selected = next.agents[0].id;
      resize(); draw();
      // A paused or reduced-motion world still redraws on data — pausing motion
      // is a presentation preference, it does not pause the agents.
      if (!paused && !reduced) start(); else stop();
    },
    select(id) { selected = id; draw(); },
    get selected() { return selected; },
    get rooms() { return rooms; },
    setPaused(v) { paused = v; v || reduced ? stop() : start(); draw(); },
    get reduced() { return reduced; },
    playHandoff(from, to) {
      if (paused || reduced) { handoff = null; draw(); return; }
      handoff = { from, to, progress: 0 };
      const t0 = performance.now(), dur = 2600;
      const step = now => {
        handoff.progress = Math.min(1, (now - t0) / dur);
        if (handoff.progress < 1) requestAnimationFrame(step);
        else setTimeout(() => { handoff = null; draw(); }, 400);
      };
      requestAnimationFrame(step);
    },
    destroy() { stop(); },
  };
}
