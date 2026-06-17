"use client"
import { useEffect, useRef } from "react"
import type { AgentState as ApiAgentState, AgentTaskDetails } from "@/hooks/useDashboardApi"

const BASE_W = 900, BASE_H = 200
const GROUND_Y = 88
// Hi-fi chibi sprite: 24w x 40h per frame, 4 walk frames x 4 directions.
// Light source top-left; auto silhouette outline; hue-shifted color ramps.
const SW = 24, SH = 40, SDIRS = 4, SWALK = 4
const SPRITE_SCALE = 1.5
const STATION_SCALE = 1.0
const OUTLINE = 0x1b0f14

const AGENTS = [
  {
    id: "lil-claw" as const, name: "Lil Claw", color: 0x5ec27e, colorCss: "#5ec27e",
    role: "Farm Manager",
    home:     { x: 125, y: 158 },
    station:  { x: 70,  y: 118 },   // farmhouse base; depth-sorted by station.y
    zone:     { x1: 28, y1: 110, x2: 235, y2: 182 },
    pal: { skin: 0xf0c49a, hair: 0x5a3216, shirt: 0xcf5230, pants: 0x6b4322, shoe: 0x3a2410, accent: 0xb98a4a, hat: 0xe6c878 },
    feat: { hat: "straw" as const, apron: true, build: "normal" as const, beard: false },
    tool: "watering" as const,
  },
  {
    id: "goop" as const, name: "Goop", color: 0x52b8d0, colorCss: "#52b8d0",
    role: "Blacksmith & Carpenter",
    home:     { x: 452, y: 155 },
    station:  { x: 410, y: 116 },   // smithy base
    zone:     { x1: 322, y1: 110, x2: 562, y2: 182 },
    pal: { skin: 0xcf9e6e, hair: 0x2a2422, shirt: 0x47728e, pants: 0x39301f, shoe: 0x241510, accent: 0x6e4a28, hat: 0x8a99a6 },
    feat: { hat: "goggles" as const, apron: true, build: "stocky" as const, beard: true },
    tool: "hammer" as const,
  },
  {
    id: "mason" as const, name: "Mason", color: 0x9b87f0, colorCss: "#9b87f0",
    role: "Scholar of the Vale",
    home:     { x: 790, y: 158 },
    station:  { x: 760, y: 118 },   // scholar tower base
    zone:     { x1: 634, y1: 110, x2: 882, y2: 182 },
    pal: { skin: 0xf0c49a, hair: 0xc4c2cc, shirt: 0x6a4a8c, pants: 0x352a44, shoe: 0x2a1c30, accent: 0x584088, hat: 0x6a4f9c },
    feat: { hat: "hood" as const, apron: false, build: "slim" as const, beard: false },
    tool: "quill" as const,
  },
]

// ─── Hi-fi chibi sprite generation ─────────────────────────────────────────
// Pipeline: draw each 24x40 frame into its own cell with hue-shifted color
// ramps + cell shading (light top-left), then an automatic silhouette outline
// pass wraps the body in a dark warm line. Profiles are drawn left-facing and
// blitted mirrored for the right-facing row.

type Pal = { skin: number; hair: number; shirt: number; pants: number; shoe: number; accent: number; hat: number }
type Feat = { hat: "straw"|"goggles"|"hood"; apron: boolean; build: "normal"|"stocky"|"slim"; beard: boolean }
type C2D = CanvasRenderingContext2D

function rgb(h: number): string {
  return `rgb(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255})`
}
function rgba(h: number, a: number): string {
  return `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${a})`
}
function px(c: C2D, x: number, y: number, w: number, h: number, col: number, a?: number) {
  if (w <= 0 || h <= 0) return
  c.fillStyle = a != null ? rgba(col, a) : rgb(col)
  c.fillRect(x, y, w, h)
}

// ── HSL color math (numeric RGB) for hue-shifted ramps
function rgbToHsl(c: number): [number, number, number] {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  let h = 0, s = 0; const l = (mx + mn) / 2
  if (mx !== mn) {
    const d = mx - mn
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (mx === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return [h, s, l]
}
function hslToRgb(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
  }
  return (f(0) << 16) | (f(8) << 8) | f(4)
}
const cl01 = (v: number) => Math.max(0, Math.min(1, v))
function shade(c: number, dl: number, dh: number, ds = 0): number {
  const [h, s, l] = rgbToHsl(c)
  return hslToRgb(h + dh, cl01(s + ds), cl01(l + dl))
}
// 5-step ramp: highlights warm+light, shadows cool+dark (hue shifting)
type Ramp = { hi: number; base: number; mid: number; sh: number; out: number }
function makeRamp(c: number): Ramp {
  return {
    hi:   shade(c,  0.15,  10, -0.05),
    base: c,
    mid:  shade(c, -0.07,  -5,  0.04),
    sh:   shade(c, -0.16, -16,  0.07),
    out:  shade(c, -0.30, -20,  0.05),
  }
}
type Ramps = { skin: Ramp; hair: Ramp; shirt: Ramp; pants: Ramp; shoe: Ramp; accent: Ramp; hat: Ramp }

// Cell-shaded rect: base fill, top/left highlight, right/bottom shadow.
function srect(c: C2D, x: number, y: number, w: number, h: number, r: Ramp, hi = true) {
  px(c, x, y, w, h, r.base)
  if (h > 2) px(c, x, y + h - 1, w, 1, r.sh)        // bottom AO
  if (w > 2) px(c, x + w - 1, y, 1, h, r.sh)        // right shadow
  if (hi) {
    px(c, x, y, w, 1, r.hi)                          // top highlight
    px(c, x, y, 1, h, r.hi)                          // left highlight
  }
}
const clr = (c: C2D, x: number, y: number, w = 1, h = 1) => c.clearRect(x, y, w, h)

// Eyes: white sclera + colored iris + dark pupil + catchlight.
function eye(c: C2D, x: number, y: number, look = 0) {
  px(c, x, y, 3, 3, 0xf6f2ea)
  px(c, x + 1 + look, y + 1, 1, 2, 0x3a2c4a)
  px(c, x + 1 + look, y + 1, 1, 1, 0xffffff)
}

// ── DOWN-facing body (dir 0)
function bodyDown(c: C2D, R: Ramps, ft: Feat, f: number) {
  const lf = [0, -1, 0, 1][f], rf = [0, 1, 0, -1][f]   // leg swing
  const as = [0, 1, 0, -1][f]                           // arm swing
  const wide = ft.build === "stocky" ? 1 : 0
  const cx = 12
  px(c, cx - 7, 38, 14, 2, 0x000000, 0.16)             // ground shadow
  // legs + shoes
  srect(c, 9 - wide, 30, 3, 7 + lf, R.pants)
  srect(c, 12 + wide, 30, 3, 7 + rf, R.pants)
  px(c, 8 - wide, 36 + lf, 4, 3, R.shoe.base); px(c, 8 - wide, 38 + lf, 4, 1, R.shoe.sh)
  px(c, 12 + wide, 36 + rf, 4, 3, R.shoe.base); px(c, 12 + wide, 38 + rf, 4, 1, R.shoe.sh)
  // torso
  srect(c, 6 - wide, 20, 12 + wide * 2, 11, R.shirt)
  clr(c, 6 - wide, 20); clr(c, 17 + wide, 20)
  // apron / robe front
  if (ft.apron) { srect(c, 9, 22, 6, 9, R.accent); px(c, 11, 24, 2, 1, R.accent.hi) }
  if (ft.hat === "hood") { srect(c, 7, 22, 10, 12, R.accent); clr(c, 7, 22); clr(c, 16, 22) }  // long robe
  // arms + hands
  srect(c, 4 - wide, 21 + as, 3, 8, R.shirt)
  srect(c, 17 + wide, 21 - as, 3, 8, R.shirt)
  px(c, 4 - wide, 28 + as, 3, 2, R.skin.base); px(c, 17 + wide, 28 - as, 3, 2, R.skin.base)
  // neck + head
  px(c, 10, 18, 4, 2, R.skin.mid)
  srect(c, 7, 8, 10, 11, R.skin)
  clr(c, 7, 8); clr(c, 16, 8); clr(c, 7, 18); clr(c, 16, 18)
  px(c, 8, 16, 1, 1, R.skin.hi, 0.6)                   // cheek light
  // face
  if (ft.beard) { px(c, 7, 14, 10, 5, R.hair.mid); clr(c, 7, 14); clr(c, 16, 14); px(c, 10, 16, 4, 2, R.skin.base) }
  eye(c, 8, 12); eye(c, 13, 12)
  px(c, 8, 11, 3, 1, R.hair.sh); px(c, 13, 11, 3, 1, R.hair.sh)   // brows
  px(c, 11, 14, 2, 1, R.skin.sh)                        // nose
  px(c, 10, 16, 4, 1, ft.beard ? 0x7a3528 : 0x8a4332)   // mouth
  headgearDown(c, R, ft)
}

function headgearDown(c: C2D, R: Ramps, ft: Feat) {
  if (ft.hat === "straw") {
    srect(c, 7, 4, 10, 5, R.hat)                        // crown
    clr(c, 7, 4); clr(c, 16, 4)
    px(c, 4, 8, 16, 2, R.hat.base); px(c, 4, 9, 16, 1, R.hat.sh)  // brim
    px(c, 5, 8, 14, 1, R.hat.hi)
    px(c, 9, 6, 6, 1, R.hat.sh, 0.5)                    // band
  } else if (ft.hat === "goggles") {
    srect(c, 7, 5, 10, 5, R.hair); clr(c, 7, 5); clr(c, 16, 5)    // short hair
    px(c, 6, 8, 12, 2, 0x2c2622)                        // goggle strap
    px(c, 7, 8, 4, 2, 0x9fd4ff); px(c, 13, 8, 4, 2, 0x9fd4ff)    // lenses
    px(c, 7, 8, 4, 1, 0xd9f0ff); px(c, 13, 8, 4, 1, 0xd9f0ff)
    px(c, 11, 9, 2, 1, 0x4a4038)
  } else { // hood
    px(c, 11, 3, 2, 2, R.accent.mid)                    // hood peak
    srect(c, 6, 5, 12, 7, R.accent)                     // hood drape
    clr(c, 6, 5); clr(c, 17, 5); clr(c, 6, 6); clr(c, 17, 6)  // round crown
    px(c, 7, 10, 10, 2, R.accent.sh)                    // face-framing inner rim
    px(c, 9, 6, 6, 1, R.accent.hi)                      // top sheen
    px(c, 7, 11, 1, 6, R.accent.sh); px(c, 16, 11, 1, 6, R.accent.mid)  // hood sides past cheeks
  }
}

// ── UP-facing body (dir 1): back of head, no face
function bodyUp(c: C2D, R: Ramps, ft: Feat, f: number) {
  const lf = [0, -1, 0, 1][f], rf = [0, 1, 0, -1][f]
  const as = [0, 1, 0, -1][f]
  const wide = ft.build === "stocky" ? 1 : 0
  px(c, 5, 38, 14, 2, 0x000000, 0.16)
  srect(c, 9 - wide, 30, 3, 7 + lf, R.pants)
  srect(c, 12 + wide, 30, 3, 7 + rf, R.pants)
  px(c, 8 - wide, 36 + lf, 4, 3, R.shoe.base); px(c, 8 - wide, 38 + lf, 4, 1, R.shoe.sh)
  px(c, 12 + wide, 36 + rf, 4, 3, R.shoe.base); px(c, 12 + wide, 38 + rf, 4, 1, R.shoe.sh)
  srect(c, 6 - wide, 20, 12 + wide * 2, 11, R.shirt)
  clr(c, 6 - wide, 20); clr(c, 17 + wide, 20)
  if (ft.hat === "hood") { srect(c, 7, 22, 10, 12, R.accent); clr(c, 7, 22); clr(c, 16, 22) }
  srect(c, 4 - wide, 21 + as, 3, 8, R.shirt)
  srect(c, 17 + wide, 21 - as, 3, 8, R.shirt)
  px(c, 4 - wide, 28 + as, 3, 2, R.skin.base); px(c, 17 + wide, 28 - as, 3, 2, R.skin.base)
  px(c, 10, 18, 4, 2, R.skin.mid)
  // back of head: hair / hat
  srect(c, 7, 8, 10, 11, R.skin)
  clr(c, 7, 8); clr(c, 16, 8); clr(c, 7, 18); clr(c, 16, 18)
  if (ft.hat === "straw") {
    px(c, 4, 8, 16, 2, R.hat.base); px(c, 4, 9, 16, 1, R.hat.sh)
    srect(c, 7, 4, 10, 5, R.hat); clr(c, 7, 4); clr(c, 16, 4)
  } else if (ft.hat === "hood") {
    srect(c, 6, 4, 12, 11, R.accent); clr(c, 6, 4); clr(c, 17, 4)
  } else {
    srect(c, 7, 7, 10, 9, R.hair); clr(c, 7, 7); clr(c, 16, 7)
    px(c, 8, 8, 8, 1, R.hair.hi)
  }
}

// ── LEFT-facing profile (dir 2). Mirrored for right in buildCharCanvas.
function bodyLeft(c: C2D, R: Ramps, ft: Feat, f: number) {
  const fb = [0, -1, 0, 1][f], bb = [0, 1, 0, -1][f]   // front/back leg swing
  const aw = [0, -1, 0, 1][f]                           // arm swing
  const wide = ft.build === "stocky" ? 1 : 0
  px(c, 6, 38, 13, 2, 0x000000, 0.16)
  // rear leg (darker), front leg
  px(c, 12, 30, 3, 7 + bb, R.pants.sh); px(c, 12, 36 + bb, 4, 3, R.shoe.sh)
  srect(c, 9, 30, 3, 7 + fb, R.pants); px(c, 8, 36 + fb, 5, 3, R.shoe.base); px(c, 8, 38 + fb, 5, 1, R.shoe.sh)
  // torso (profile, slimmer)
  srect(c, 8, 20, 9 + wide, 11, R.shirt)
  clr(c, 8, 20)
  if (ft.apron) srect(c, 8, 22, 5, 9, R.accent)
  if (ft.hat === "hood") { srect(c, 8, 22, 9, 12, R.accent); clr(c, 8, 22) }
  // front arm swings
  srect(c, 9 + aw, 21, 3, 8, R.shirt); px(c, 9 + aw, 28, 3, 2, R.skin.base)
  // head (profile), nose to the left
  srect(c, 8, 8, 9, 11, R.skin)
  clr(c, 8, 8); clr(c, 16, 8); clr(c, 16, 18)
  px(c, 7, 12, 1, 4, R.skin.base)                       // nose/brow ridge
  px(c, 7, 13, 1, 2, R.skin.mid)
  if (ft.beard) { px(c, 8, 14, 7, 5, R.hair.mid); clr(c, 8, 14); px(c, 9, 16, 3, 1, R.skin.base) }
  eye(c, 9, 12, -1)
  px(c, 8, 11, 3, 1, R.hair.sh)                          // brow
  px(c, 8, 16, 3, 1, ft.beard ? 0x7a3528 : 0x8a4332)     // mouth
  px(c, 15, 13, 2, 2, R.skin.mid)                        // ear hint
  headgearLeft(c, R, ft)
}

function headgearLeft(c: C2D, R: Ramps, ft: Feat) {
  if (ft.hat === "straw") {
    srect(c, 8, 4, 9, 5, R.hat); clr(c, 8, 4); clr(c, 16, 4)
    px(c, 5, 8, 15, 2, R.hat.base); px(c, 5, 9, 15, 1, R.hat.sh)
    px(c, 6, 8, 13, 1, R.hat.hi)
  } else if (ft.hat === "goggles") {
    srect(c, 8, 5, 9, 5, R.hair); clr(c, 8, 5); clr(c, 16, 5)
    px(c, 7, 8, 11, 2, 0x2c2622)
    px(c, 8, 8, 4, 2, 0x9fd4ff); px(c, 8, 8, 4, 1, 0xd9f0ff)
  } else {
    srect(c, 7, 4, 11, 8, R.accent); clr(c, 7, 4); clr(c, 17, 4)
    px(c, 8, 9, 8, 1, R.accent.sh)
  }
}

// Silhouette outline pass: paint a dark ring around solid pixels.
function addOutline(cv: HTMLCanvasElement, col: number) {
  const c = cv.getContext("2d")!
  const W = cv.width, H = cv.height
  const img = c.getImageData(0, 0, W, H)
  const d = img.data
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 200
  const out = c.createImageData(W, H)
  const o = out.data
  const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (d[i + 3] > 0) { o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = d[i + 3]; continue }
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255
      }
    }
  }
  c.putImageData(out, 0, 0)
}

function buildCharCanvas(pal: Pal, ft: Feat): HTMLCanvasElement {
  const R: Ramps = {
    skin: makeRamp(pal.skin), hair: makeRamp(pal.hair), shirt: makeRamp(pal.shirt),
    pants: makeRamp(pal.pants), shoe: makeRamp(pal.shoe), accent: makeRamp(pal.accent), hat: makeRamp(pal.hat),
  }
  const sheet = document.createElement("canvas")
  sheet.width = SW * SWALK
  sheet.height = SH * SDIRS
  const sctx = sheet.getContext("2d")!
  sctx.imageSmoothingEnabled = false
  sctx.clearRect(0, 0, sheet.width, sheet.height)

  const renderCell = (drawFn: (c: C2D) => void): HTMLCanvasElement => {
    const cell = document.createElement("canvas")
    cell.width = SW; cell.height = SH
    const cc = cell.getContext("2d")!
    cc.imageSmoothingEnabled = false
    drawFn(cc)
    addOutline(cell, OUTLINE)
    return cell
  }

  for (let f = 0; f < SWALK; f++) {
    sctx.drawImage(renderCell((cc) => bodyDown(cc, R, ft, f)), f * SW, 0 * SH)        // dir 0 down
    sctx.drawImage(renderCell((cc) => bodyUp(cc, R, ft, f)), f * SW, 1 * SH)          // dir 1 up
    sctx.drawImage(renderCell((cc) => bodyLeft(cc, R, ft, f)), f * SW, 2 * SH)        // dir 2 left
    // dir 3 right = mirrored left
    const cell = renderCell((cc) => bodyLeft(cc, R, ft, f))
    sctx.save()
    sctx.translate((f + 1) * SW, 3 * SH)
    sctx.scale(-1, 1)
    sctx.drawImage(cell, 0, 0)
    sctx.restore()
  }
  return sheet
}

// ─── Environment sprite functions ─────────────────────────────────────────

function drawTool(g: Phaser.GameObjects.Graphics, kind: "watering"|"hammer"|"quill", x: number, y: number) {
  g.clear()
  if (kind === "watering") {
    g.fillStyle(0x9aa0a8, 1); g.fillRect(x - 4, y - 6, 9, 7)
    g.fillStyle(0x6e747c, 1); g.fillRect(x - 5, y - 6, 1, 7)
    g.fillStyle(0xbcbcc4, 1); g.fillRect(x - 2, y - 8, 7, 2)
    g.fillStyle(0x6e747c, 1); g.fillRect(x + 4, y - 6, 3, 1); g.fillRect(x + 7, y - 7, 2, 2)
  } else if (kind === "hammer") {
    g.fillStyle(0x6a3a18, 1); g.fillRect(x - 1, y - 8, 2, 8)
    g.fillStyle(0x8a8a8a, 1); g.fillRect(x - 4, y - 10, 8, 4)
    g.fillStyle(0xb8b8b8, 1); g.fillRect(x - 3, y - 10, 2, 1)
  } else {
    g.fillStyle(0xfdfaf0, 1); g.fillTriangle(x, y - 8, x + 2, y - 2, x - 2, y - 2)
    g.fillStyle(0x4a2810, 1); g.fillRect(x - 1, y - 2, 1, 6)
    g.fillStyle(0xc8b890, 0.6); g.fillRect(x - 1, y - 7, 1, 5)
  }
}

function drawForgeSparks(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number) {
  g.clear()
  // sparks emanating from forge chimney top
  const rng = (seed: number) => Math.abs(Math.sin(seed * 9301 + t * 0.003))
  for (let i = 0; i < 8; i++) {
    const age = (t * 0.007 + i * 0.42) % 1
    const sx = x + (rng(i * 3.1) - 0.5) * 24 * age
    const sy = y - age * 28
    const alpha = (1 - age) * 0.9
    const hue = age < 0.4 ? 0xffd040 : 0xff6010
    if (alpha > 0.05) {
      g.fillStyle(hue, alpha)
      g.fillRect(Math.round(sx), Math.round(sy), 2, 2)
    }
  }
}

// ── Farmhouse (Lil Claw): 2.5D cottage — visible roof-top face + side wall + larger scale
function drawFarmhouse(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  // Ground mat / shadow
  g.fillStyle(0x1e2e14, 0.35); g.fillEllipse(x + 4, y + 3, 80, 10)
  // Stone foundation
  g.fillStyle(0x8a7a5a, 1); g.fillRect(x - 28, y - 4, 56, 5)
  g.fillStyle(0x5a5040, 0.7); g.fillRect(x - 28, y, 56, 1)

  // RIGHT SIDE WALL (depth cue — darker, set back)
  g.fillStyle(0x5a3818, 1); g.fillRect(x + 26, y - 52, 12, 48)
  g.fillStyle(0x3a2010, 0.55); g.fillRect(x + 26, y - 52, 2, 48) // inner edge dark
  g.fillStyle(0x7a5028, 0.3);  g.fillRect(x + 32, y - 52, 4, 48) // outer face mid-light

  // FRONT WALL — warm plank wood
  g.fillStyle(0x9a6030, 1); g.fillRect(x - 28, y - 52, 54, 48)
  // Plank lines
  g.fillStyle(0x6a4020, 0.35); for (let pl = 1; pl <= 6; pl++) g.fillRect(x - 28, y - 52 + pl * 8, 54, 1)
  // Right edge shadow on front wall
  g.fillStyle(0x5a3010, 0.3); g.fillRect(x + 20, y - 52, 6, 48)
  // Left corner post
  g.fillStyle(0x7a4820, 0.7); g.fillRect(x - 29, y - 52, 3, 48)

  // ROOF GABLE (front view of pitched roof)
  g.fillStyle(0xb83020, 1); g.fillTriangle(x - 32, y - 52, x + 32, y - 52, x, y - 80)
  // Right slope darker (shadow side away from top-left light)
  g.fillStyle(0x881814, 1); g.fillTriangle(x, y - 80, x + 32, y - 52, x + 16, y - 52)
  // Ridge cap
  g.fillStyle(0x3a0808, 1); g.fillRect(x - 1, y - 81, 2, 3)
  // Roof overhang shadow on wall
  g.fillStyle(0x3a1808, 0.35); g.fillRect(x - 28, y - 54, 60, 4)

  // ROOF TOP FACE — the 2.5D key: narrow strip visible from above angle
  g.fillStyle(0x992010, 1); g.fillRect(x - 26, y - 57, 52, 7)
  g.fillStyle(0xb82818, 0.45); g.fillRect(x - 24, y - 57, 48, 2) // front edge lit
  g.fillStyle(0x5a0c08, 0.8); g.fillRect(x - 24, y - 51, 48, 2)  // rear edge dark
  // Right side of roof top face
  g.fillStyle(0x6a1008, 1); g.fillRect(x + 26, y - 57, 10, 5)

  // CHIMNEY (left, pierces through roof)
  g.fillStyle(0x6a5040, 1); g.fillRect(x - 20, y - 96, 13, 40)
  g.fillStyle(0x8a6a50, 0.8); g.fillRect(x - 20, y - 96, 13, 3) // chimney cap
  g.fillStyle(0x4a3028, 0.5); g.fillRect(x - 9,  y - 96, 2, 40) // shadow side
  // Smoke wisps
  g.fillStyle(0xd0c0a8, 0.22); g.fillCircle(x - 13, y - 101, 5)
  g.fillStyle(0xd0c0a8, 0.14); g.fillCircle(x - 11, y - 108, 4)
  g.fillStyle(0xd0c0a8, 0.08); g.fillCircle(x - 9,  y - 114, 3)

  // WINDOWS — two rows (upper + lower storey)
  for (const [wx, wy2] of [[x - 20, y - 46], [x + 8, y - 46], [x - 20, y - 30], [x + 8, y - 30]] as [number,number][]) {
    g.fillStyle(0x3a2010, 1); g.fillRect(wx - 1, wy2, 13, 13)
    g.fillStyle(0x6eb4d4, 0.85); g.fillRect(wx, wy2 + 1, 11, 11)
    g.fillStyle(0xa8d8f0, 0.5); g.fillRect(wx, wy2 + 1, 6, 5)   // pane highlight
    g.fillStyle(0x3a2010, 0.65); g.fillRect(wx + 5, wy2 + 1, 1, 11); g.fillRect(wx, wy2 + 6, 11, 1) // cross
    // Shutters
    g.fillStyle(0x5ec27e, 1); g.fillRect(wx - 4, wy2, 4, 13); g.fillRect(wx + 11, wy2, 4, 13)
    g.fillStyle(0x3a9a5a, 0.5); for (let sl = 0; sl < 4; sl++) g.fillRect(wx - 4, wy2 + 1 + sl * 3, 4, 1)
  }
  // Flower boxes on lower windows
  g.fillStyle(0x6a3a18, 1); g.fillRect(x - 23, y - 18, 16, 4); g.fillRect(x + 5, y - 18, 16, 4)
  g.fillStyle(0xc44a50, 1); for (let fp = 0; fp < 4; fp++) { g.fillRect(x - 22 + fp * 4, y - 21, 3, 4); g.fillRect(x + 6 + fp * 4, y - 21, 3, 4) }

  // DOOR (center, taller now)
  g.fillStyle(0x3a2010, 1); g.fillRect(x - 7, y - 30, 14, 30)
  g.fillStyle(0x5a3018, 0.6); g.fillRect(x - 6, y - 29, 2, 28); g.fillRect(x + 4, y - 29, 2, 28)
  g.fillStyle(0xd4a855, 1); g.fillRect(x + 4, y - 14, 2, 2) // door knob
  g.fillStyle(0x2a1008, 1); g.fillRect(x - 7, y - 32, 14, 3) // arch cap

  // SIGN POST (right side)
  g.fillStyle(0x6a3a18, 1); g.fillRect(x + 34, y - 26, 2, 26)
  g.fillStyle(0xc8a870, 1); g.fillRect(x + 30, y - 42, 22, 18)
  g.fillStyle(0x4a2810, 1)
  g.fillRect(x + 30, y - 42, 22, 1); g.fillRect(x + 30, y - 25, 22, 1)
  g.fillRect(x + 30, y - 42, 1, 18); g.fillRect(x + 51, y - 42, 1, 18)
  g.fillStyle(0x4a2810, 0.55); g.fillRect(x + 33, y - 39, 15, 1); g.fillRect(x + 33, y - 35, 12, 1); g.fillRect(x + 33, y - 31, 9, 1)
}

// ── Smithy (Goop): 2.5D stone forge hall — side wall visible, roof top face strip
function drawSmithy(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  // Ground shadow
  g.fillStyle(0x1a1816, 0.4); g.fillEllipse(x + 4, y + 3, 100, 12)
  // Cobblestone floor platform
  g.fillStyle(0x5a5248, 1); g.fillRect(x - 38, y - 4, 76, 5)
  g.fillStyle(0x6a6258, 0.5); for (let ci = 0; ci < 9; ci++) g.fillRect(x - 36 + ci * 8, y - 3, 7, 3)

  // RIGHT SIDE WALL (depth cue)
  g.fillStyle(0x3a3830, 1); g.fillRect(x + 30, y - 58, 14, 54)
  g.fillStyle(0x2a2820, 0.5); g.fillRect(x + 30, y - 58, 2, 54) // inner shadow
  g.fillStyle(0x5a5448, 0.3); g.fillRect(x + 36, y - 58, 6, 54) // highlight

  // FRONT WALL — stone masonry
  g.fillStyle(0x5a5248, 1); g.fillRect(x - 32, y - 58, 62, 54)
  // Stone mortar lines
  g.fillStyle(0x3a3230, 0.45)
  for (let row = 1; row <= 6; row++) g.fillRect(x - 32, y - 58 + row * 9, 62, 1)
  g.fillRect(x - 16, y - 58, 1, 54); g.fillRect(x + 0, y - 49, 1, 45); g.fillRect(x + 16, y - 58, 1, 54)
  // Right shadow on front face
  g.fillStyle(0x2a2220, 0.45); g.fillRect(x + 22, y - 58, 8, 54)

  // METAL ROOF — gable
  g.fillStyle(0x4a5058, 1); g.fillTriangle(x - 36, y - 58, x + 36, y - 58, x, y - 82)
  g.fillStyle(0x384048, 1); g.fillTriangle(x, y - 82, x + 36, y - 58, x + 18, y - 58) // right darker
  g.fillStyle(0x5a6068, 0.4); g.fillRect(x - 8, y - 82, 16, 4) // ridge highlight
  g.fillStyle(0x2a2828, 1); g.fillRect(x - 1, y - 83, 2, 3)    // ridge cap

  // ROOF TOP FACE (2.5D — visible strip from above)
  g.fillStyle(0x384048, 1); g.fillRect(x - 30, y - 62, 60, 7)
  g.fillStyle(0x4a5260, 0.5); g.fillRect(x - 28, y - 62, 56, 2) // front-lit edge
  g.fillStyle(0x1e2028, 0.8); g.fillRect(x - 28, y - 56, 56, 2) // rear dark edge
  // Right side of roof top
  g.fillStyle(0x28303a, 1); g.fillRect(x + 30, y - 62, 12, 5)

  // MASSIVE CHIMNEY (left side)
  g.fillStyle(0x4a4038, 1); g.fillRect(x - 28, y - 98, 16, 40)
  g.fillStyle(0x6a5848, 0.8); g.fillRect(x - 28, y - 98, 16, 4) // cap
  g.fillStyle(0x3a3028, 0.5); g.fillRect(x - 14, y - 98, 2, 40)  // shadow
  // Forge glow from chimney top
  g.fillStyle(0xff8020, 0.28); g.fillCircle(x - 20, y - 102, 8)
  g.fillStyle(0xffb040, 0.18); g.fillCircle(x - 20, y - 108, 6)
  g.fillStyle(0xffc060, 0.10); g.fillCircle(x - 20, y - 114, 4)

  // OPEN FORGE BAY (center arch opening)
  g.fillStyle(0x1a1814, 1); g.fillRect(x - 16, y - 44, 32, 40)
  // Fire layers inside bay
  g.fillStyle(0xff4800, 0.55); g.fillRect(x - 12, y - 16, 24, 10)
  g.fillStyle(0xff8020, 0.72); g.fillRect(x - 9,  y - 14, 18, 8)
  g.fillStyle(0xffb840, 0.82); g.fillRect(x - 6,  y - 12, 12, 5)
  g.fillStyle(0xfff060, 0.65); g.fillRect(x - 3,  y - 11, 6, 3)
  g.fillStyle(0xff6020, 0.20); g.fillEllipse(x, y - 8, 48, 14) // fire floor glow
  // Bellows left
  g.fillStyle(0x6a3818, 1); g.fillRect(x - 16, y - 30, 7, 14)
  g.fillStyle(0x4a2810, 0.7); g.fillRect(x - 16, y - 24, 7, 1); g.fillRect(x - 16, y - 20, 7, 1)
  g.fillStyle(0x8a5028, 0.5); g.fillRect(x - 16, y - 30, 2, 14)
  // Tool wall right
  g.fillStyle(0x3a3028, 1); g.fillRect(x + 9, y - 44, 7, 40)
  g.fillStyle(0x6a6058, 0.8)
  g.fillRect(x + 11, y - 42, 2, 8); g.fillRect(x + 10, y - 42, 4, 2)  // hammer 1
  g.fillRect(x + 11, y - 30, 2, 8); g.fillRect(x + 10, y - 32, 4, 2)  // hammer 2
  g.fillRect(x + 11, y - 18, 2, 8); g.fillRect(x + 10, y - 20, 4, 2)  // hammer 3

  // ANVIL (forward right — high Y = close, depth 118+10=128ish)
  g.fillStyle(0x2a2822, 1); g.fillRect(x + 36, y - 10, 18, 8)
  g.fillStyle(0x4a4840, 1); g.fillRect(x + 36, y - 12, 18, 3)
  g.fillStyle(0x6a6858, 0.4); g.fillRect(x + 36, y - 12, 7, 1) // highlight
  g.fillStyle(0x3a3830, 1); g.fillRect(x + 40, y - 2, 10, 5)
  g.fillStyle(0x2a2820, 1); g.fillRect(x + 42, y + 3, 6, 2)

  // COAL PILE + BARREL (far left)
  g.fillStyle(0x1a1812, 1); g.fillEllipse(x - 44, y - 4, 20, 9)
  g.fillStyle(0x2e2820, 0.7); g.fillEllipse(x - 42, y - 6, 12, 6)
  g.fillStyle(0x5a4030, 1); g.fillRect(x - 58, y - 18, 12, 18) // barrel
  g.fillStyle(0x3a2820, 0.5); for (let bl = 0; bl < 4; bl++) g.fillRect(x - 58, y - 16 + bl * 4, 12, 1)
  g.fillStyle(0x6a5040, 0.4); g.fillRect(x - 58, y - 18, 2, 18)
}

// ── Scholar tower (Mason): 2.5D stone turret — battlement top visible from above
function drawScholarTower(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  // Ground moss/shadow
  g.fillStyle(0x1e3818, 0.4); g.fillEllipse(x + 2, y + 3, 60, 10)
  g.fillStyle(0x2a5a2a, 0.35); g.fillEllipse(x - 8, y + 1, 30, 7)

  // Stone base steps
  g.fillStyle(0x7a6a58, 1); g.fillRect(x - 20, y - 5, 40, 6)
  g.fillStyle(0x6a5a48, 0.7); g.fillRect(x - 22, y - 2, 44, 2)

  // RIGHT SIDE WALL (depth cue — narrower tower)
  g.fillStyle(0x4a4238, 1); g.fillRect(x + 16, y - 76, 10, 71)
  g.fillStyle(0x2a2820, 0.5); g.fillRect(x + 16, y - 76, 2, 71)
  g.fillStyle(0x5a5248, 0.3); g.fillRect(x + 20, y - 76, 4, 71)

  // TOWER BODY — tall stone masonry
  g.fillStyle(0x6a6050, 1); g.fillRect(x - 18, y - 76, 34, 71)
  // Stone mortar pattern
  g.fillStyle(0x4a4038, 0.42)
  for (let row = 1; row <= 8; row++) g.fillRect(x - 18, y - 76 + row * 9, 34, 1)
  g.fillRect(x - 9,  y - 76, 1, 71); g.fillRect(x + 0,  y - 67, 1, 58); g.fillRect(x + 9,  y - 76, 1, 71)
  // Right shadow on front
  g.fillStyle(0x2a2018, 0.45); g.fillRect(x + 12, y - 76, 4, 71)
  // Ivy (left face)
  g.fillStyle(0x2a5a1a, 0.65); g.fillRect(x - 18, y - 74, 3, 38)
  g.fillStyle(0x3a6a2a, 0.55); for (let iv = 0; iv < 7; iv++) { g.fillRect(x - 20, y - 71 + iv * 6, 4, 4); g.fillRect(x - 18, y - 69 + iv * 6, 2, 3) }

  // BATTLEMENTS — 4 merlons with visible top face (2.5D key element)
  for (let m = 0; m < 4; m++) {
    const mx = x - 15 + m * 10
    g.fillStyle(0x5a5040, 1); g.fillRect(mx, y - 84, 7, 8) // merlon front face
    g.fillStyle(0x4a4030, 0.5); g.fillRect(mx + 1, y - 84, 3, 8) // mortar shadow
    // TOP FACE visible from above — 2.5D
    g.fillStyle(0x6a6050, 1); g.fillRect(mx, y - 87, 7, 4)
    g.fillStyle(0x7a7060, 0.5); g.fillRect(mx, y - 87, 7, 1) // top-lit edge
    g.fillStyle(0x3a3828, 0.7); g.fillRect(mx, y - 84, 7, 1) // rear dark
  }
  // Wall top face between merlons (the crenelation walk)
  g.fillStyle(0x524a3c, 1); g.fillRect(x - 18, y - 82, 34, 6)
  g.fillStyle(0x6a6050, 0.5); g.fillRect(x - 18, y - 82, 34, 2) // lit front edge

  // ARCHED WINDOW (center, two storey height)
  g.fillStyle(0x1a1614, 1); g.fillRect(x - 6, y - 52, 12, 20)
  g.fillStyle(0x1a1614, 1); g.fillEllipse(x, y - 52, 12, 10) // arch top
  // Candlelight inside
  g.fillStyle(0xffa830, 0.65); g.fillRect(x - 5, y - 50, 10, 16)
  g.fillStyle(0xffe080, 0.45); g.fillRect(x - 3, y - 49, 6, 11)
  // Candle
  g.fillStyle(0xf0eee8, 1); g.fillRect(x - 1, y - 36, 2, 7)
  g.fillStyle(0xffd060, 1); g.fillRect(x - 1, y - 39, 2, 3)
  // Window frame
  g.fillStyle(0x3a3028, 0.7)
  g.fillRect(x - 7, y - 54, 14, 2); g.fillRect(x - 7, y - 32, 14, 1)
  g.fillRect(x - 7, y - 52, 1, 20); g.fillRect(x + 6, y - 52, 1, 20)

  // UPPER NARROW WINDOW
  g.fillStyle(0x1a1614, 1); g.fillRect(x - 3, y - 70, 6, 10)
  g.fillStyle(0x1a1614, 1); g.fillEllipse(x, y - 70, 6, 6)
  g.fillStyle(0xffa830, 0.45); g.fillRect(x - 2, y - 68, 4, 7)

  // HANGING LANTERN (right bracket)
  g.fillStyle(0x4a3820, 1); g.fillRect(x + 18, y - 62, 1, 10); g.fillRect(x + 18, y - 62, 7, 1)
  g.fillStyle(0x8a7050, 1); g.fillRect(x + 20, y - 54, 8, 10)
  g.fillStyle(0xffd060, 0.75); g.fillRect(x + 21, y - 53, 6, 8)
  g.fillStyle(0xffe8a0, 0.45); g.fillRect(x + 22, y - 52, 4, 6)
  g.fillStyle(0x6a5038, 1); g.fillRect(x + 19, y - 55, 10, 2); g.fillRect(x + 19, y - 44, 10, 2)
  g.fillStyle(0xff9020, 0.25); g.fillEllipse(x + 24, y - 48, 22, 18)

  // OUTDOOR LECTERN + OPEN BOOK (slightly forward from tower base)
  g.fillStyle(0x7a6a50, 1); g.fillRect(x - 9, y - 18, 18, 5)
  g.fillStyle(0x5a4a38, 0.7); g.fillRect(x - 7, y - 17, 14, 1); g.fillRect(x - 7, y - 14, 14, 1)
  g.fillStyle(0x3a2a18, 1); g.fillRect(x - 1, y - 13, 2, 13)
  g.fillStyle(0x6a5840, 1); g.fillRect(x - 1, y - 22, 2, 3)
  g.fillStyle(0xf0e8d4, 1); g.fillRect(x - 8, y - 22, 16, 5)
  g.fillStyle(0x8a7858, 0.5); g.fillRect(x - 1, y - 22, 1, 5)
  g.fillStyle(0x6a5a40, 0.4)
  g.fillRect(x - 7, y - 21, 5, 1); g.fillRect(x - 7, y - 19, 4, 1); g.fillRect(x + 2, y - 21, 5, 1); g.fillRect(x + 3, y - 19, 4, 1)
}

function drawStation(g: Phaser.GameObjects.Graphics, kind: "manager"|"forge"|"study", x: number, y: number) {
  g.clear()
  if (kind === "manager") drawFarmhouse(g, x, y)
  else if (kind === "forge") drawSmithy(g, x, y)
  else drawScholarTower(g, x, y)
}

function drawCloud(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
  const h = Math.round(w * 0.38)
  g.fillStyle(0xf0e8d8, 0.18); g.fillEllipse(x, y, w, h)
  g.fillStyle(0xf8f0e4, 0.12); g.fillEllipse(x - w * 0.22, y - h * 0.2, w * 0.55, h * 0.75)
  g.fillStyle(0xfdf8f0, 0.10); g.fillEllipse(x + w * 0.18, y - h * 0.25, w * 0.45, h * 0.7)
  g.fillStyle(0xe0d8cc, 0.08); g.fillEllipse(x, y + h * 0.2, w * 0.7, h * 0.5)
}

function drawFencePost(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number) {
  g.fillStyle(0x8a6a3a, 1); g.fillRect(x, y - h, 4, h)
  g.fillStyle(0xb89050, 0.5); g.fillRect(x, y - h, 2, h)
  g.fillStyle(0x5a3a18, 0.5); g.fillRect(x + 3, y - h, 1, h)
  g.fillStyle(0xa07040, 1); g.fillRect(x - 1, y - h - 3, 6, 3)       // post cap
}

function drawFenceSection(g: Phaser.GameObjects.Graphics, x: number, y: number, len: number) {
  for (let p = 0; p <= len; p += 18) drawFencePost(g, x + p, y, 18)
  g.fillStyle(0x8a6a3a, 1); g.fillRect(x, y - 13, len + 4, 2)
  g.fillStyle(0x8a6a3a, 1); g.fillRect(x, y - 7, len + 4, 2)
  g.fillStyle(0xb89050, 0.4); g.fillRect(x, y - 13, len + 4, 1)
  g.fillStyle(0xb89050, 0.4); g.fillRect(x, y - 7, len + 4, 1)
}

function drawHayBale(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0xd4a030, 1); g.fillEllipse(x, y, 22, 14)
  g.fillStyle(0xe8c050, 0.6); g.fillEllipse(x - 3, y - 2, 14, 8)
  g.fillStyle(0xa87820, 0.5)
  g.fillRect(x - 9, y - 2, 18, 1); g.fillRect(x - 8, y + 1, 16, 1); g.fillRect(x - 6, y - 5, 12, 1)
  g.fillStyle(0xb89030, 0.6); g.fillRect(x - 2, y - 7, 1, 14); g.fillRect(x + 3, y - 6, 1, 12)
}

function drawCampfire(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  // logs
  g.fillStyle(0x5a3010, 1); g.fillRect(x - 7, y - 2, 14, 3)
  g.fillStyle(0x3a1808, 0.6); g.fillRect(x - 6, y - 1, 12, 1)
  // embers on ground
  g.fillStyle(0xff4000, 0.5); g.fillEllipse(x, y, 12, 5)
  g.fillStyle(0xff8020, 0.6); g.fillEllipse(x, y - 1, 8, 4)
  // flames
  g.fillStyle(0xff6010, 0.85); g.fillTriangle(x - 4, y - 2, x + 4, y - 2, x - 2, y - 11)
  g.fillStyle(0xff8030, 0.8);  g.fillTriangle(x - 2, y - 2, x + 5, y - 2, x + 1, y - 13)
  g.fillStyle(0xffb040, 0.7);  g.fillTriangle(x - 1, y - 2, x + 3, y - 2, x + 1, y - 9)
  g.fillStyle(0xffe060, 0.55); g.fillTriangle(x - 1, y - 3, x + 2, y - 3, x,     y - 8)
  // glow halo
  g.fillStyle(0xff7020, 0.12); g.fillEllipse(x, y - 4, 32, 20)
  g.fillStyle(0xff9040, 0.08); g.fillEllipse(x, y - 6, 48, 28)
}

function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number, size: 1|2 = 1) {
  const r  = size === 2 ? 15 : 10
  const tH = size === 2 ? 23 : 16
  const tW = size === 2 ? 7 : 5
  // Ground shadow (light source top-left → shadow slightly right/below)
  g.fillStyle(0x182a10, 0.5); g.fillEllipse(x + 4, y + 2, r * 2.2, 7)
  // Canopy layers back→front (drawn before trunk so trunk appears in front at base)
  g.fillStyle(0x284c18, 1); g.fillCircle(x, y - tH - r + 4, r)                            // back/shadow
  g.fillStyle(0x356624, 1); g.fillCircle(x - Math.round(r*0.35), y - tH - Math.round(r*0.65), Math.round(r*0.78))
  g.fillStyle(0x3d7228, 1); g.fillCircle(x + Math.round(r*0.22), y - tH - Math.round(r*0.80), Math.round(r*0.65))
  g.fillStyle(0x52883c, 0.9); g.fillCircle(x - Math.round(r*0.28), y - tH - Math.round(r*0.48), Math.round(r*0.5)) // mid-highlight
  g.fillStyle(0x6aaa50, 0.65); g.fillCircle(x - Math.round(r*0.12), y - tH - Math.round(r*0.88), Math.round(r*0.3)) // top catch-light
  // Trunk drawn LAST — visible below canopy, properly upward from ground
  g.fillStyle(0x6a3a18, 1); g.fillRect(x - Math.floor(tW/2), y - tH, tW, tH + 1)
  g.fillStyle(0x8a5028, 0.65); g.fillRect(x - Math.floor(tW/2), y - tH, 2, tH)          // left highlight
  g.fillStyle(0x3a1c08, 0.55); g.fillRect(x + Math.floor(tW/2) - 1, y - tH, 1, tH)     // right shadow
  if (tH > 15) {                                                                           // bark detail on larger trees
    g.fillStyle(0x5a3010, 0.5); g.fillRect(x - 1, y - Math.round(tH*0.65), 1, 2); g.fillRect(x + 1, y - Math.round(tH*0.38), 1, 2)
  }
}

function drawWheat(g: Phaser.GameObjects.Graphics, x: number, y: number, ripe: boolean) {
  g.clear()
  const stalk = ripe ? 0xd4a035 : 0x7aad4a
  const head  = ripe ? 0xe8b840 : 0x8aca5a
  g.fillStyle(stalk, 1); g.fillRect(x, y - 12, 1, 12)
  g.fillStyle(head,  1); g.fillRect(x - 1, y - 15, 3, 4)
  if (ripe) {
    g.fillStyle(0xf0c840, 1)
    g.fillRect(x - 1, y - 17, 1, 2); g.fillRect(x + 1, y - 17, 1, 2); g.fillRect(x, y - 18, 1, 1)
  }
  g.fillStyle(stalk, 0.8); g.fillRect(x - 2, y - 7, 2, 1); g.fillRect(x + 1, y - 4, 2, 1)
}

function drawFlower(g: Phaser.GameObjects.Graphics, x: number, y: number, petals: number) {
  g.fillStyle(0xffdd22, 1); g.fillRect(x, y, 1, 1)
  g.fillStyle(petals, 0.9)
  g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1)
  g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1)
  g.fillStyle(0x4a7a3a, 1); g.fillRect(x, y + 1, 1, 2)
}

function drawBush(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0x4a7a3a, 1); g.fillCircle(x, y, 4)
  g.fillStyle(0x5a8a4a, 1); g.fillCircle(x - 1, y - 1, 2)
  g.fillStyle(0x6a9a5a, 0.65); g.fillCircle(x + 1, y - 2, 1)
}

function drawRock(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x7a7068, 1); g.fillEllipse(x, y, w, h)
  g.fillStyle(0x9a9088, 0.6); g.fillEllipse(x - w * 0.15, y - h * 0.25, w * 0.4, h * 0.3)
}

function drawCoop(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.clear()
  g.fillStyle(0xc44a2a, 1); g.fillRect(x - 10, y - 8, 20, 12)
  g.fillStyle(0x8a2a14, 1); g.fillTriangle(x - 12, y - 8, x + 12, y - 8, x, y - 16)
  g.fillStyle(0xfdfaf0, 1); g.fillRect(x - 3, y - 4, 6, 8)
  g.fillStyle(0x4a2810, 1); g.fillRect(x - 1, y - 1, 2, 5)
  g.fillStyle(0x8eb8d4, 1); g.fillRect(x - 8, y - 5, 3, 3)
  g.fillStyle(0x4a2810, 1); g.fillRect(x - 7, y - 4, 1, 1)
  g.fillStyle(0x6a3a18, 1)
  g.fillRect(x - 18, y + 4, 36, 1)
  for (let fx = x - 18; fx <= x + 18; fx += 6) { g.fillRect(fx, y + 2, 1, 4); g.fillRect(fx - 1, y + 2, 3, 1) }
}

function drawScarecrow(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.clear()
  g.fillStyle(0x6a3a18, 1); g.fillRect(x - 1, y - 18, 2, 20); g.fillRect(x - 8, y - 14, 16, 2)
  g.fillStyle(0xff8a3a, 1); g.fillRect(x - 3, y - 22, 6, 5)
  g.fillStyle(0x4a2810, 1); g.fillRect(x - 2, y - 20, 1, 1); g.fillRect(x + 1, y - 20, 1, 1); g.fillRect(x, y - 18, 1, 1)
  g.fillStyle(0x2a1808, 1); g.fillRect(x - 4, y - 23, 8, 2); g.fillRect(x - 2, y - 26, 4, 3)
  g.fillStyle(0xc44a2a, 1); g.fillRect(x - 5, y - 12, 10, 5)
  g.fillStyle(0xe8c860, 1); g.fillRect(x - 10, y - 13, 2, 1); g.fillRect(x + 8, y - 13, 2, 1)
}

function drawWell(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.clear()
  g.fillStyle(0x6a6058, 1); g.fillRect(x - 8, y - 4, 16, 6)
  g.fillStyle(0x4a4238, 1); g.fillRect(x - 8, y + 1, 16, 1)
  g.fillStyle(0x4a7a9a, 1); g.fillRect(x - 6, y - 1, 12, 3)
  g.fillStyle(0x7ab8d4, 0.6); g.fillRect(x - 5, y - 1, 10, 1)
  g.fillStyle(0x6a3a18, 1)
  g.fillRect(x - 7, y - 12, 2, 9); g.fillRect(x + 5, y - 12, 2, 9); g.fillRect(x - 7, y - 13, 14, 2)
  g.fillStyle(0x8a2a14, 1); g.fillTriangle(x - 10, y - 13, x + 10, y - 13, x, y - 21)
}

function drawPlot(g: Phaser.GameObjects.Graphics, x: number, y: number, growth: 0|1|2|3) {
  g.fillStyle(0x5a3a1a, 1); g.fillRect(x - 6, y - 2, 12, 4)
  g.fillStyle(0x4a2a10, 0.7); g.fillRect(x - 6, y + 1, 12, 1)
  if (growth === 0) return
  if (growth === 1) {
    g.fillStyle(0x6aad5a, 1); g.fillRect(x - 1, y - 3, 1, 2); g.fillRect(x, y - 4, 1, 1)
  } else if (growth === 2) {
    g.fillStyle(0x5a9a4a, 1); g.fillRect(x - 1, y - 5, 1, 3); g.fillRect(x, y - 6, 1, 2); g.fillRect(x - 2, y - 4, 1, 1)
  } else {
    g.fillStyle(0x4a8a3a, 1); g.fillRect(x - 1, y - 7, 1, 4); g.fillRect(x, y - 8, 1, 3)
    g.fillRect(x - 2, y - 6, 1, 2); g.fillRect(x + 1, y - 5, 1, 2)
    g.fillStyle(0xff8a3a, 1); g.fillRect(x, y - 9, 1, 1)
  }
}

function drawChicken(g: Phaser.GameObjects.Graphics, x: number, y: number, dir: "left"|"right") {
  g.clear()
  const f = dir === "right" ? 1 : -1
  g.fillStyle(0xfff5d0, 1); g.fillEllipse(x, y, 7, 4)
  g.fillStyle(0xdecf9a, 0.6); g.fillEllipse(x - 1, y, 4, 3)
  g.fillStyle(0xfff5d0, 1); g.fillCircle(x + f * 3, y - 1, 2)
  g.fillStyle(0xff3333, 1); g.fillRect(x + f * 3, y - 3, 1, 1)
  g.fillStyle(0xff9922, 1); g.fillRect(x + f * 4, y - 1, 2, 1)
  g.fillStyle(0x1a1a1a, 1); g.fillRect(x + f * 3, y - 1, 1, 1)
  g.fillStyle(0xeee8c0, 1); g.fillTriangle(x - f * 3, y - 1, x - f * 6, y - 2, x - f * 6, y + 1)
}

function drawCow(g: Phaser.GameObjects.Graphics, x: number, y: number, dir: "left"|"right") {
  g.clear()
  const f = dir === "right" ? 1 : -1
  g.fillStyle(0xf0e8d0, 1); g.fillEllipse(x, y, 18, 10)
  g.fillStyle(0x3a2818, 0.7); g.fillEllipse(x + f * 3, y - 1, 5, 4); g.fillEllipse(x - f * 4, y + 2, 4, 3)
  g.fillStyle(0xf0e8d0, 1); g.fillEllipse(x + f * 10, y - 1, 9, 7)
  g.fillStyle(0xf0c0b0, 1); g.fillEllipse(x + f * 13, y, 5, 3)
  g.fillStyle(0x2a1808, 1); g.fillRect(x + f * 12, y, 1, 1); g.fillRect(x + f * 14, y, 1, 1)
  g.fillStyle(0x1a1a1a, 1); g.fillRect(x + f * 10, y - 2, 1, 1)
  g.fillStyle(0xe0d0b8, 1); g.fillEllipse(x + f * 8, y - 4, 4, 3)
  g.fillStyle(0xd4b878, 1); g.fillRect(x + f * 9, y - 6, 1, 2); g.fillRect(x + f * 7, y - 6, 1, 2)
  g.fillStyle(0xe0d8c0, 1)
  g.fillRect(x - 6, y + 4, 2, 5); g.fillRect(x - 2, y + 4, 2, 5)
  g.fillRect(x + 2, y + 4, 2, 5); g.fillRect(x + 6, y + 4, 2, 5)
  g.fillStyle(0x3a2818, 1)
  g.fillRect(x - 6, y + 8, 2, 2); g.fillRect(x - 2, y + 8, 2, 2)
  g.fillRect(x + 2, y + 8, 2, 2); g.fillRect(x + 6, y + 8, 2, 2)
  g.fillStyle(0xf0b0a0, 1); g.fillEllipse(x - 2, y + 6, 6, 3)
  g.fillStyle(0xd4c8a8, 1); g.fillRect(x - f * 8, y - 2, 1, 4)
  g.fillStyle(0xc8b890, 0.8); g.fillEllipse(x - f * 8, y + 3, 3, 3)
}

function drawPond(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.clear()
  g.fillStyle(0x2a5a7a, 0.9); g.fillEllipse(x, y, 52, 22)
  g.fillStyle(0x4a8aaa, 0.7); g.fillEllipse(x - 4, y - 3, 28, 10)
  g.fillStyle(0x9abcd4, 0.4); g.fillEllipse(x - 6, y - 4, 14, 5)
  g.fillStyle(0x3a7a2a, 0.9); g.fillEllipse(x - 14, y + 4, 10, 5)
  g.fillStyle(0x2a6a1a, 0.5); g.fillRect(x - 14, y + 2, 1, 3)
  g.fillStyle(0x3a7a2a, 0.9); g.fillEllipse(x + 12, y + 5, 8, 4)
  g.fillStyle(0x4a6a3a, 1); g.fillRect(x - 24, y - 2, 1, 6); g.fillRect(x + 24, y - 1, 1, 5)
  g.fillStyle(0x8a5a2a, 1); g.fillRect(x - 23, y - 7, 2, 2); g.fillRect(x + 24, y - 3, 2, 2)
}

function drawFishingLine(g: Phaser.GameObjects.Graphics, x: number, y: number, bobY: number) {
  g.clear()
  g.lineStyle(1, 0x6a3a18, 1)
  g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 12, y - 5); g.strokePath()
  g.lineStyle(1, 0xd4c8b0, 0.7)
  g.beginPath(); g.moveTo(x + 12, y - 5); g.lineTo(x + 16, bobY); g.strokePath()
  g.fillStyle(0xdd2222, 1); g.fillCircle(x + 16, bobY, 2)
  g.fillStyle(0xffffff, 1); g.fillCircle(x + 16, bobY - 1, 1)
}

function drawButterfly(g: Phaser.GameObjects.Graphics, x: number, y: number, open: boolean, primary: number, secondary: number) {
  g.clear()
  if (open) {
    g.fillStyle(primary, 0.85); g.fillEllipse(x - 4, y - 2, 7, 5); g.fillEllipse(x + 4, y - 2, 7, 5)
    g.fillStyle(secondary, 0.7); g.fillEllipse(x - 3, y + 3, 5, 4); g.fillEllipse(x + 3, y + 3, 5, 4)
    g.fillStyle(0x000000, 0.25); g.fillCircle(x - 3, y - 1, 0.8); g.fillCircle(x + 3, y - 1, 0.8)
  } else {
    g.fillStyle(primary, 0.85); g.fillEllipse(x - 2, y - 1, 4, 7); g.fillEllipse(x + 2, y - 1, 4, 7)
  }
  g.fillStyle(0x2a1808, 1); g.fillRect(x, y - 3, 1, 6)
  g.fillRect(x - 2, y - 5, 1, 2); g.fillRect(x + 1, y - 5, 1, 2)
}

// ─── Component ────────────────────────────────────────────────────────────

export type WeatherCondition = "sunny" | "cloudy" | "rain" | "storm"

export interface PixelGuildProps {
  agents?: Record<string, ApiAgentState> | null
  taskDetails?: Record<string, AgentTaskDetails> | null
  height?: number
  mytHour?: number
  weather?: WeatherCondition
}

export default function PixelGuild({ agents = null, taskDetails = null, height = 240, mytHour, weather }: PixelGuildProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef<{
    agents: Record<string, ApiAgentState> | null
    taskDetails: Record<string, AgentTaskDetails> | null
    mytHour: number
    weather: WeatherCondition
  }>({ agents: null, taskDetails: null, mytHour: new Date().getHours(), weather: "sunny" })

  useEffect(() => {
    dataRef.current = {
      agents, taskDetails,
      mytHour: mytHour ?? new Date().getHours(),
      weather: weather ?? "sunny",
    }
  }, [agents, taskDetails, mytHour, weather])

  useEffect(() => {
    let game: import("phaser").Game | null = null
    let destroyed = false

    ;(async () => {
      const Phaser = (await import("phaser")).default
      if (destroyed || !hostRef.current) return
      const host = hostRef.current

      type RichFields = { session_active?: boolean; health?: "green"|"amber"|"red"; completed_today?: number }
      type AgentLocal = {
        id: string
        cfg: typeof AGENTS[number]
        wx: number; wy: number; tx: number; ty: number
        dir: 0|1|2|3  // 0=down,1=up,2=left,3=right
        wait: number
        walkF: 0|1|2|3  // walk frame (0=stand)
        // Idle look-around
        idleAnimMode: "down"|"left"|"right"|"up"
        idleAnimTimer: number
        frameTick: number
        idleTime: number
        isWorking: boolean; prevWorking: boolean
        completedPrev: number; inboxCount: number
        health: "green"|"amber"|"red"
        // Scholar (Mason) mode
        masonMode: "wander"|"read"|"fish"|"visit"
        masonTimer: number
        masonVisitX: number; masonVisitY: number
        // Goop idle sub-target
        goopTarget: "forge"|"anvil"|"logs"|"wander"
        goopTargetTimer: number
        // Lil Claw idle sub-target
        lilTarget: "wander"|"coop"|"crops"
        lilTargetTimer: number
        // Sprite
        sprite: Phaser.GameObjects.Sprite
        toolG: Phaser.GameObjects.Graphics
        glow: Phaser.GameObjects.Graphics
        nameTag: Phaser.GameObjects.Text
      }
      type ChickenLocal = { g: Phaser.GameObjects.Graphics; wx:number; wy:number; tx:number; ty:number; dir:"left"|"right"; wait:number }
      type Butterfly = { g: Phaser.GameObjects.Graphics; bx:number; by:number; ph:number; sp:number; primary:number; secondary:number }
      type Heart = { g: Phaser.GameObjects.Graphics; alpha:number; vy:number }
      type Firefly = { g: Phaser.GameObjects.Graphics; bx:number; by:number; ph:number; sp:number; hue:number }
      type WheatStalk = { g: Phaser.GameObjects.Graphics; x:number; y:number; ripe:boolean }
      // Arc packet for handoff animation
      type HandoffPacket = { g: Phaser.GameObjects.Graphics; fromX:number; fromY:number; toX:number; toY:number; progress:number; color:number }

      class Scene extends Phaser.Scene {
        ags: AgentLocal[] = []
        chickens: ChickenLocal[] = []
        butterflies: Butterfly[] = []
        hearts: Heart[] = []
        fireflies: Firefly[] = []
        wheats: WheatStalk[] = []
        handoffPackets: HandoffPacket[] = []
        rainG!: Phaser.GameObjects.Graphics
        rainDrops: { x: number; y: number; len: number; speed: number }[] = []
        coopG!: Phaser.GameObjects.Graphics
        wellG!: Phaser.GameObjects.Graphics
        scarecrowG!: Phaser.GameObjects.Graphics
        cowG!: Phaser.GameObjects.Graphics
        cowState = { wx: 172, wy: 130, tx: 185, ty: 128, dir: "right" as "left"|"right", wait: 60 }
        pondG!: Phaser.GameObjects.Graphics
        fishingG!: Phaser.GameObjects.Graphics
        sparkG!: Phaser.GameObjects.Graphics
        seedGfx!: Phaser.GameObjects.Graphics
        skyOverlay!: Phaser.GameObjects.Graphics
        stations: Phaser.GameObjects.Graphics[] = []

        create() {
          // ── Sky gradient: dusk plum → amber
          const bg = this.add.graphics().setDepth(-10)
          const sky = [
            { t: 0.00, r: 0x20, g: 0x18, b: 0x3c },
            { t: 0.45, r: 0x5a, g: 0x30, b: 0x50 },
            { t: 0.72, r: 0xb8, g: 0x58, b: 0x38 },
            { t: 1.00, r: 0xf2, g: 0xa8, b: 0x48 },
          ]
          const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
          for (let y = 0; y < GROUND_Y; y++) {
            const t = y / GROUND_Y
            let s0 = sky[0], s1 = sky[sky.length - 1]
            for (let k = 0; k < sky.length - 1; k++) {
              if (t >= sky[k].t && t <= sky[k + 1].t) { s0 = sky[k]; s1 = sky[k + 1]; break }
            }
            const lt = (t - s0.t) / Math.max(0.0001, s1.t - s0.t)
            const col = (lerp(s0.r, s1.r, lt) << 16) | (lerp(s0.g, s1.g, lt) << 8) | lerp(s0.b, s1.b, lt)
            bg.fillStyle(col, 1); bg.fillRect(0, y, BASE_W, 1)
          }
          // Setting sun (bigger, richer halo)
          bg.fillStyle(0xff9030, 0.12); bg.fillCircle(742, GROUND_Y - 4, 44)
          bg.fillStyle(0xffc060, 0.22); bg.fillCircle(742, GROUND_Y - 4, 32)
          bg.fillStyle(0xffe090, 0.50); bg.fillCircle(742, GROUND_Y - 4, 20)
          bg.fillStyle(0xfff8cc, 0.90); bg.fillCircle(742, GROUND_Y - 4, 12)
          // Horizon bloom (wide warm strip)
          bg.fillStyle(0xff7020, 0.10); bg.fillRect(400, GROUND_Y - 18, 500, 18)
          bg.fillStyle(0xffb040, 0.08); bg.fillRect(500, GROUND_Y - 12, 400, 12)
          // Stars (more, varied brightness)
          const stars: [number, number, number][] = [[120,16,0.9],[210,30,0.7],[330,10,0.85],[60,38,0.6],[470,18,0.8],[560,32,0.65],[150,44,0.5],[290,22,0.75],[420,40,0.6],[80,12,0.7],[640,14,0.8],[380,50,0.4]]
          for (const [sx, sy, sa] of stars) { bg.fillStyle(0xfdf6e0, sa); bg.fillRect(sx, sy, 1, 1) }
          // Crescent moon (top-left)
          bg.fillStyle(0xf0e8c4, 0.65); bg.fillCircle(72, 22, 9)
          bg.fillStyle(0x38284a, 1);     bg.fillCircle(78, 20, 7)     // cutout → crescent
          // Clouds
          const cloudGfx = this.add.graphics().setDepth(-9)
          drawCloud(cloudGfx, 160, 18, 80)
          drawCloud(cloudGfx, 380, 28, 60)
          drawCloud(cloudGfx, 620, 14, 96)
          drawCloud(cloudGfx, 830, 32, 70)
          // Mountain range — two layers for depth
          bg.fillStyle(0x28284a, 0.85)
          bg.fillTriangle(0, GROUND_Y, 90, GROUND_Y - 28, 200, GROUND_Y)
          bg.fillTriangle(140, GROUND_Y, 240, GROUND_Y - 20, 355, GROUND_Y)
          bg.fillStyle(0x3c2e48, 0.9)
          bg.fillTriangle(290, GROUND_Y, 420, GROUND_Y - 32, 545, GROUND_Y)
          bg.fillTriangle(470, GROUND_Y, 580, GROUND_Y - 20, 675, GROUND_Y)
          bg.fillTriangle(630, GROUND_Y, 768, GROUND_Y - 28, 905, GROUND_Y)
          // Front ridge (closer, slightly warmer tint)
          bg.fillStyle(0x2e2232, 0.7)
          bg.fillTriangle(0, GROUND_Y, 60, GROUND_Y - 14, 130, GROUND_Y)
          bg.fillTriangle(200, GROUND_Y, 280, GROUND_Y - 10, 360, GROUND_Y)
          bg.fillTriangle(550, GROUND_Y, 620, GROUND_Y - 12, 700, GROUND_Y)
          bg.fillTriangle(820, GROUND_Y, 870, GROUND_Y - 10, 905, GROUND_Y)
          // Snow caps
          bg.fillStyle(0xf4f0ea, 0.60)
          bg.fillTriangle(90, GROUND_Y - 28, 82, GROUND_Y - 22, 98, GROUND_Y - 22)
          bg.fillTriangle(420, GROUND_Y - 32, 412, GROUND_Y - 24, 428, GROUND_Y - 24)
          bg.fillTriangle(768, GROUND_Y - 28, 760, GROUND_Y - 20, 776, GROUND_Y - 20)

          // ── Ground base
          const ground = this.add.graphics().setDepth(-8)
          ground.fillStyle(0x36502e, 1); ground.fillRect(0, GROUND_Y, BASE_W, BASE_H - GROUND_Y)
          // Zone-specific ground tints
          ground.fillStyle(0x5a7040, 0.25); ground.fillRect(0, GROUND_Y, 240, BASE_H - GROUND_Y)       // farm: warm lush
          ground.fillStyle(0x2a2a22, 0.20); ground.fillRect(340, GROUND_Y, 220, BASE_H - GROUND_Y)      // forge: scorched
          ground.fillStyle(0x2a4a3a, 0.22); ground.fillRect(630, GROUND_Y, BASE_W - 630, BASE_H - GROUND_Y) // scholar: cool mossy
          // Forge cobblestone patch (depth 88+22=110 area)
          ground.fillStyle(0x4a4840, 0.6); ground.fillRect(360, GROUND_Y, 180, 60)
          ground.fillStyle(0x3a3830, 0.35)
          for (let ci = 0; ci < 9; ci++) ground.fillRect(362 + ci * 20, GROUND_Y + 2, 18, 12)
          for (let ci = 0; ci < 8; ci++) ground.fillRect(372 + ci * 20, GROUND_Y + 16, 18, 12)
          for (let ci = 0; ci < 9; ci++) ground.fillRect(362 + ci * 20, GROUND_Y + 30, 18, 12)
          for (let ci = 0; ci < 8; ci++) ground.fillRect(372 + ci * 20, GROUND_Y + 44, 18, 12)
          // Moss patches (scholar zone)
          ground.fillStyle(0x3a6a38, 0.45); ground.fillEllipse(700, GROUND_Y + 35, 55, 20)
          ground.fillStyle(0x2a5a28, 0.35); ground.fillEllipse(840, GROUND_Y + 50, 70, 25)
          ground.fillStyle(0x4a7a40, 0.3); ground.fillEllipse(780, GROUND_Y + 18, 40, 14)
          // Grass tufts (scattered)
          for (let i = 0; i < 100; i++) {
            const x = (i * 19 + 7) % BASE_W
            const y = GROUND_Y + ((i * 11) % (BASE_H - GROUND_Y - 10))
            ground.fillStyle(0x2a4222, 0.50); ground.fillRect(x, y, 1, 2)
            ground.fillStyle(0x4a6838, 0.40); ground.fillRect(x + 1, y - 1, 1, 1)
          }
          // 2.5D PERSPECTIVE BANDS — horizontal lines that imply ground receding upward
          // (closer to horizon = lighter; closer to viewer = normal)
          for (let row = 0; row < 7; row++) {
            const gy = GROUND_Y + 4 + row * 16
            const alpha = 0.06 + row * 0.01 // very subtle
            ground.fillStyle(0x4a6a38, alpha); ground.fillRect(0, gy, BASE_W, 1)
          }
          // Dirt footpath
          for (let i = 0; i < 13; i++) {
            const px = 60 + i * 64
            ground.fillStyle(0x8a7a58, 0.80); ground.fillRoundedRect(px, BASE_H - 13, 46, 8, 2)
            ground.fillStyle(0x6a5e44, 0.45); ground.fillRoundedRect(px + 2, BASE_H - 8, 42, 3, 1)
          }
          // ── Foreground depth strip (bigger rocks + dark roots at very bottom)
          const fgGfx = this.add.graphics().setDepth(200)
          fgGfx.fillStyle(0x1c2818, 0.70); fgGfx.fillRect(0, BASE_H - 8, BASE_W, 8)
          fgGfx.fillStyle(0x243020, 0.55); fgGfx.fillRect(0, BASE_H - 14, BASE_W, 6)
          // large foreground rocks
          const fgRocks: [number, number, number, number][] = [[50,BASE_H-10,28,14],[200,BASE_H-9,20,11],[390,BASE_H-11,32,14],[560,BASE_H-10,24,12],[720,BASE_H-9,26,13],[855,BASE_H-10,22,11]]
          for (const [rx,ry,rw,rh] of fgRocks) { fgGfx.fillStyle(0x3a3630,1); fgGfx.fillEllipse(rx,ry,rw,rh); fgGfx.fillStyle(0x5a5248,0.5); fgGfx.fillEllipse(rx-rw*0.1,ry-rh*0.3,rw*0.4,rh*0.35) }
          // exposed roots
          fgGfx.fillStyle(0x3a2810,0.6); fgGfx.fillRect(130,BASE_H-12,3,12); fgGfx.fillRect(133,BASE_H-10,8,3)
          fgGfx.fillRect(480,BASE_H-11,3,11); fgGfx.fillRect(483,BASE_H-9,6,2)
          fgGfx.fillRect(780,BASE_H-10,3,10); fgGfx.fillRect(783,BASE_H-8,7,2)
          // foreground tall grass blades
          fgGfx.fillStyle(0x2e4a20, 0.8)
          for (const gx of [80,95,285,300,450,465,640,655,800,815]) { fgGfx.fillRect(gx, BASE_H - 18, 2, 10); fgGfx.fillRect(gx + 3, BASE_H - 15, 1, 8) }

          // ── Zone fences — depth = their Y position
          const fenceGfx = this.add.graphics().setDepth(GROUND_Y + 28)
          drawFenceSection(fenceGfx, 238, GROUND_Y + 28, 54)    // east side of farm
          drawFenceSection(fenceGfx, 574, GROUND_Y + 28, 50)    // west side of scholar zone

          // ── Scattered flowers — ground level, depth by Y
          const flowerColors = [0xe84040, 0xe8d040, 0x8040e8, 0xe880a0, 0x40c8e8, 0xffa040, 0xff6090, 0xa0e840]
          const flowerSpots = [[28,148],[42,162],[62,138],[110,180],[148,172],[168,158],[230,148],[268,162],[305,170],[348,144],[395,168],[430,178],[460,154],[488,172],[518,162],[545,148],[570,160],[612,152],[648,180],[676,162],[700,148],[730,172],[758,158],[785,168],[818,152],[848,170],[872,144],[890,160]]
          const flowerGfx = this.add.graphics().setDepth(0)
          for (const [fx, fy] of flowerSpots)
            drawFlower(flowerGfx, fx, fy, flowerColors[Math.floor(fx / 34) % flowerColors.length])

          // ── Rocks — mid-ground (depth = their Y)
          const rockNear = this.add.graphics().setDepth(178)
          drawRock(rockNear, 308, 178, 12, 7); drawRock(rockNear, 560, 170, 8, 5)
          const rockMid = this.add.graphics().setDepth(110)
          drawRock(rockMid, 258, 106, 16, 9); drawRock(rockMid, 271, 112, 10, 6)
          drawRock(rockMid, 588, 104, 13, 7); drawRock(rockMid, 601, 110, 9, 5)
          drawRock(rockMid, 335, 145, 7, 4); drawRock(rockMid, 718, 162, 10, 6)
          drawRock(rockMid, 850, 138, 8, 5); drawRock(rockMid, 880, 152, 6, 4)

          // ── Trees — each gets its own graphics with depth = trunk-base Y (Y-sort)
          // Background trees at GROUND_Y (depth 88) — behind buildings + characters
          const tBg1 = this.add.graphics().setDepth(GROUND_Y); drawTree(tBg1,  44, GROUND_Y, 1)
          const tBg2 = this.add.graphics().setDepth(GROUND_Y); drawTree(tBg2, 252, GROUND_Y, 2)
          const tBg3 = this.add.graphics().setDepth(GROUND_Y); drawTree(tBg3, 312, GROUND_Y, 1)
          const tBg4 = this.add.graphics().setDepth(GROUND_Y); drawTree(tBg4, 596, GROUND_Y, 1)
          const tBg5 = this.add.graphics().setDepth(GROUND_Y); drawTree(tBg5, 740, GROUND_Y, 1)
          const tBg6 = this.add.graphics().setDepth(GROUND_Y); drawTree(tBg6, 892, GROUND_Y, 1)
          // Mid-ground reading tree (Mason's zone) at y=104 — in front of buildings(118), behind characters
          const tMid = this.add.graphics().setDepth(104); drawTree(tMid, 660, 104, 2)

          // ── Bushes (more, clustered)
          const bushGfx = this.add.graphics().setDepth(0)
          drawBush(bushGfx, 18, 168); drawBush(bushGfx, 26, 174); drawBush(bushGfx, 10, 172)
          drawBush(bushGfx, 576, 166); drawBush(bushGfx, 584, 172)
          drawBush(bushGfx, 876, 168); drawBush(bushGfx, 886, 174)
          drawBush(bushGfx, 330, 164); drawBush(bushGfx, 710, 158)

          // ── Hay bales (depth = their Y) + campfire
          const hayGfx = this.add.graphics().setDepth(148)
          drawHayBale(hayGfx, 216, 148); drawHayBale(hayGfx, 238, 152)
          const campfireGfx = this.add.graphics().setDepth(178)
          drawCampfire(campfireGfx, 302, 178)

          // ── Wheat rows for Lil Claw's farm — each row gets its own depth
          this.wheats = []
          const wheatXs = [34, 46, 58, 70, 82, 94]
          for (const wx of wheatXs) {
            const ripe = wx % 24 < 12
            const wg = this.add.graphics().setDepth(168)   // nearer row
            drawWheat(wg, wx, 168, ripe)
            this.wheats.push({ g: wg, x: wx, y: 168, ripe })
            const wg2 = this.add.graphics().setDepth(155)  // farther row
            drawWheat(wg2, wx, 155, !ripe)
            this.wheats.push({ g: wg2, x: wx, y: 155, ripe: !ripe })
          }
          // Veggie plots (depth = their Y)
          const plotGfx = this.add.graphics().setDepth(168)
          const plots = [[148,168,3],[168,168,2],[188,168,1],[148,178,1],[168,178,3],[188,178,2]]
          for (const [px, py, gr] of plots) drawPlot(plotGfx, px, py, gr as 0|1|2|3)

          // ── Chicken coop + chickens (Lil Claw zone — depth 138, in front of farmhouse at 118)
          this.coopG = this.add.graphics().setDepth(138); drawCoop(this.coopG, 188, 138)
          this.chickens = []
          for (let i = 0; i < 3; i++) {
            const cg = this.add.graphics()  // depth set dynamically in update()
            const cx = 168 + i * 14, cy = 145
            drawChicken(cg, cx, cy, i % 2 === 0 ? "right" : "left")
            cg.setDepth(cy)
            this.chickens.push({
              g: cg, wx: cx, wy: cy,
              tx: 155 + Math.random() * 55,
              ty: 132 + Math.random() * 20,
              dir: i % 2 === 0 ? "right" : "left",
              wait: 20 + Math.random() * 80,
            })
          }

          // ── Cow (depth set dynamically in update() — initially at y=142)
          this.cowG = this.add.graphics()
          this.cowState = { wx: 178, wy: 142, tx: 192, ty: 138, dir: "right", wait: 60 }
          drawCow(this.cowG, 178, 142, "right")
          this.cowG.setDepth(142)

          // ── Pond (Mason's zone — depth 174, in foreground)
          this.pondG = this.add.graphics().setDepth(174)
          drawPond(this.pondG, 845, 174)

          // ── Well and scarecrow — depth = their Y
          this.wellG = this.add.graphics().setDepth(172); drawWell(this.wellG, 600, 172)
          this.scarecrowG = this.add.graphics().setDepth(172); drawScarecrow(this.scarecrowG, 282, 172)

          // ── Workstations — depth = station.y so characters Y-sort correctly around them
          this.stations = []
          const kinds: ("manager"|"forge"|"study")[] = ["manager", "forge", "study"]
          AGENTS.forEach((a, i) => {
            const sg = this.add.graphics().setDepth(a.station.y)  // Y-sort: building base
            drawStation(sg, kinds[i], 0, 0)
            sg.setPosition(a.station.x, a.station.y).setScale(STATION_SCALE)
            this.stations.push(sg)
          })

          // ── Seed packets on chore board
          this.seedGfx = this.add.graphics().setDepth(2)

          // ── Register character textures (LPC-style canvas sprites)
          AGENTS.forEach(a => {
            const key = `char-${a.id}`
            if (this.textures.exists(key)) return
            const charCanvas = buildCharCanvas(a.pal, a.feat)
            const canvasTex = this.textures.createCanvas(key, charCanvas.width, charCanvas.height)
            if (!canvasTex) return
            const ctx = canvasTex.getContext()
            if (ctx) ctx.drawImage(charCanvas, 0, 0)
            canvasTex.refresh()
            // Register frame regions: frame = dir * SWALK + walkStep
            const tex = this.textures.get(key)
            for (let d = 0; d < SDIRS; d++)
              for (let f = 0; f < SWALK; f++)
                tex.add(d * SWALK + f, 0, f * SW, d * SH, SW, SH)
          })

          // ── Agents (sprites) — initial depth = home.y; overridden every frame for Y-sort
          AGENTS.forEach((a, i) => {
            const key = `char-${a.id}`
            const sprite = this.add.sprite(a.home.x, a.home.y, key, 0)
              .setScale(SPRITE_SCALE)
              .setDepth(a.home.y)
              .setOrigin(0.5, 1)  // feet at (wx, wy)
            const toolG = this.add.graphics().setDepth(a.home.y + 1)
            const glow  = this.add.graphics().setDepth(a.home.y - 2)
            const nameTag = this.add.text(a.home.x, a.home.y + 6, a.name, {
              fontFamily: "monospace", fontSize: "9px",
              color: a.colorCss, stroke: "#080406", strokeThickness: 4,
              resolution: 4, backgroundColor: "rgba(6,3,2,0.72)",
              padding: { x: 4, y: 2 },
            }).setOrigin(0.5, 0).setDepth(9999)
            this.ags.push({
              id: a.id, cfg: a,
              wx: a.home.x, wy: a.home.y,
              tx: a.home.x, ty: a.home.y,
              dir: 0, wait: 30 + i * 40,
              walkF: 0, frameTick: 0, idleTime: 0,
              isWorking: false, prevWorking: false,
              completedPrev: 0, inboxCount: 0, health: "green",
              masonMode: "wander", masonTimer: 200 + Math.random() * 200,
              masonVisitX: 450, masonVisitY: 155,
              goopTarget: "wander", goopTargetTimer: 0,
              lilTarget: "wander", lilTargetTimer: 0,
              idleAnimMode: "down", idleAnimTimer: 60 + i * 35,
              sprite, toolG, glow, nameTag,
            })
          })

          // ── Lantern glows
          const glowLayer = this.add.graphics().setDepth(40)
          const warmGlow = (x: number, y: number, r: number, a: number) => {
            glowLayer.fillStyle(0xffb24a, a * 0.5); glowLayer.fillCircle(x, y, r)
            glowLayer.fillStyle(0xffd27a, a * 0.7); glowLayer.fillCircle(x, y, r * 0.6)
            glowLayer.fillStyle(0xfff0c0, a);        glowLayer.fillCircle(x, y, r * 0.3)
          }
          AGENTS.forEach(a => warmGlow(a.station.x, a.station.y - 6, 34, 0.16))
          warmGlow(845, 168, 16, 0.08)   // pond shimmer
          warmGlow(360, 166, 16, 0.10)   // well

          // ── Vignette
          const vig = this.add.graphics().setDepth(8500)
          vig.fillStyle(0x140d04, 0.55); vig.fillRect(0, 0, BASE_W, 14); vig.fillRect(0, BASE_H - 16, BASE_W, 16)
          vig.fillStyle(0x140d04, 0.40); vig.fillRect(0, 0, 22, BASE_H); vig.fillRect(BASE_W - 22, 0, 22, BASE_H)
          vig.fillStyle(0x140d04, 0.30)
          vig.fillEllipse(0, 0, 160, 120); vig.fillEllipse(BASE_W, 0, 160, 120)
          vig.fillEllipse(0, BASE_H, 160, 120); vig.fillEllipse(BASE_W, BASE_H, 160, 120)

          // ── Butterflies
          const bfPairs: [number, number][] = [[0xf08020, 0x2a1808], [0x4080f0, 0xf0e060], [0xf0e060, 0x4a8a2a], [0xf040a0, 0xfff0c0]]
          for (let i = 0; i < 4; i++) {
            const bg2 = this.add.graphics().setDepth(8700)
            this.butterflies.push({
              g: bg2,
              bx: 80 + i * 200 + Math.random() * 60,
              by: GROUND_Y + 5 + Math.random() * 20,
              ph: Math.random() * Math.PI * 2,
              sp: 0.5 + Math.random() * 0.6,
              primary: bfPairs[i][0],
              secondary: bfPairs[i][1],
            })
          }

          // ── Fireflies
          const ffHues = [0xffd66a, 0xffe08a, 0xc7e08a]
          for (let i = 0; i < 14; i++) {
            const ffg = this.add.graphics().setDepth(8800)
            this.fireflies.push({
              g: ffg,
              bx: 30 + Math.random() * (BASE_W - 60),
              by: GROUND_Y - 6 + Math.random() * (BASE_H - GROUND_Y - 4),
              ph: Math.random() * Math.PI * 2,
              sp: 0.4 + Math.random() * 0.7,
              hue: ffHues[i % ffHues.length],
            })
          }

          // ── Forge sparks + fishing line (animated, redrawn in update)
          this.sparkG   = this.add.graphics().setDepth(60)
          this.fishingG = this.add.graphics().setDepth(60)

          // ── Sky overlay for time-of-day + weather tint
          this.skyOverlay = this.add.graphics().setDepth(9000)

          // ── Rain layer (drawn above sky tint, below UI hearts/packets)
          this.rainG = this.add.graphics().setDepth(9002)
          this.rainDrops = Array.from({ length: 70 }, () => ({
            x: Math.random() * BASE_W,
            y: Math.random() * BASE_H,
            len: 4 + Math.random() * 5,
            speed: 2.4 + Math.random() * 2.2,
          }))
        }

        drawSeedPackets(n: number) {
          this.seedGfx.clear()
          const max = Math.min(n, 6)
          for (let i = 0; i < max; i++) {
            const sx = 102 + (i % 3) * 4, sy = 144 - Math.floor(i / 3) * 4
            this.seedGfx.fillStyle(0xdecb95, 1); this.seedGfx.fillRect(sx, sy, 3, 3)
            const sc = [0xc44a2a, 0x5a8a3a, 0xe8a935, 0x9b87f0]
            this.seedGfx.fillStyle(sc[i % 4], 1); this.seedGfx.fillRect(sx + 1, sy + 1, 1, 1)
          }
        }

        spawnHeart(x: number, y: number) {
          if (this.hearts.length >= 8) return
          const g = this.add.graphics().setDepth(9997)
          g.fillStyle(0xff6b8a, 1); g.fillCircle(x - 1, y, 1.5); g.fillCircle(x + 1, y, 1.5)
          g.fillTriangle(x - 2, y + 1, x + 2, y + 1, x, y + 4)
          this.hearts.push({ g, alpha: 1, vy: -0.3 })
        }

        update() {
          const t = this.time.now
          const { agents: apiAgents, mytHour, weather } = dataRef.current
          const isBadWeather = weather === "rain" || weather === "storm"
          const isNight = mytHour < 6 || mytHour >= 22

          // ── Time-of-day tint (MYT hour, fed from the real clock — not the
          // viewer's browser locale) + weather darkening, stacked.
          let tint = 0x000000, tintA = 0
          if (mytHour >= 5  && mytHour < 7)  { tint = 0x6a2f6a; tintA = 0.22 }  // dawn
          else if (mytHour >= 7  && mytHour < 9)  { tint = 0xffc080; tintA = 0.10 }  // morning
          else if (mytHour >= 9  && mytHour < 16) { tint = 0xfff8d0; tintA = 0.0  }  // midday
          else if (mytHour >= 16 && mytHour < 18) { tint = 0xff9050; tintA = 0.10 }  // golden hour
          else if (mytHour >= 18 && mytHour < 20) { tint = 0xb84a30; tintA = 0.16 }  // dusk
          else                                     { tint = 0x141040; tintA = 0.40 }  // night
          this.skyOverlay.clear()
          if (tintA > 0) { this.skyOverlay.fillStyle(tint, tintA); this.skyOverlay.fillRect(0, 0, BASE_W, BASE_H) }
          if (weather === "cloudy") { this.skyOverlay.fillStyle(0x808890, 0.12); this.skyOverlay.fillRect(0, 0, BASE_W, BASE_H) }
          else if (weather === "rain")  { this.skyOverlay.fillStyle(0x404858, 0.22); this.skyOverlay.fillRect(0, 0, BASE_W, BASE_H) }
          else if (weather === "storm") { this.skyOverlay.fillStyle(0x282838, 0.34); this.skyOverlay.fillRect(0, 0, BASE_W, BASE_H) }

          // ── Rain particles
          this.rainG.clear()
          if (isBadWeather) {
            const stormy = weather === "storm"
            this.rainG.lineStyle(1, 0xaad4ff, stormy ? 0.5 : 0.35)
            for (const d of this.rainDrops) {
              d.y += d.speed * (stormy ? 1.7 : 1)
              if (d.y > BASE_H) { d.y = -10; d.x = Math.random() * BASE_W }
              this.rainG.lineBetween(d.x, d.y, d.x - 2, d.y + d.len)
            }
          }

          // ── Agents
          let goopIsWorking = false
          for (const ag of this.ags) {
            ag.prevWorking = ag.isWorking
            if (apiAgents) {
              const ad = apiAgents[ag.id] as (ApiAgentState & RichFields) | undefined
              if (ad) {
                ag.isWorking = (ad.session_active ?? false) || (ad.working_count ?? 0) > 0
                ag.inboxCount = ad.inbox_count ?? 0
                ag.health = ad.health ?? "green"
                const c = ad.completed_today ?? 0
                if (c > ag.completedPrev) {
                  this.spawnHeart(ag.wx, ag.wy - 28); this.spawnHeart(ag.wx + 6, ag.wy - 24)
                  // Spawn a handoff arc to a peer agent
                  const others = this.ags.filter(a => a.id !== ag.id)
                  if (others.length > 0) {
                    const dest = others[Math.floor(t / 1000) % others.length]
                    const pkg = this.add.graphics().setDepth(9990)
                    this.handoffPackets.push({ g: pkg, fromX: ag.wx, fromY: ag.wy - 16, toX: dest.wx, toY: dest.wy - 16, progress: 0, color: ag.cfg.color })
                  }
                }
                ag.completedPrev = c
              }
            }
            if (ag.id === "goop") goopIsWorking = ag.isWorking

            // ── Target selection (role-specific behaviors)
            if (isBadWeather && !ag.isWorking) {
              // Seek shelter at own station instead of wandering in the rain
              ag.tx = ag.cfg.station.x + (ag.id === "goop" ? 10 : 22)
              ag.ty = ag.cfg.station.y + 18
            } else if (ag.isWorking) {
              ag.tx = ag.cfg.station.x + 28
              ag.ty = ag.cfg.station.y + 18  // in front of building base (station.y+18 > station.y)

            } else if (ag.id === "mason") {
              // Scholar: rotate through read / fish / visit / wander
              ag.masonTimer -= 1
              if (ag.masonTimer <= 0) {
                const roll = Math.random()
                if (roll < 0.30) { ag.masonMode = "wander"; ag.masonTimer = 280 + Math.random() * 160 }
                else if (roll < 0.55) { ag.masonMode = "read"; ag.masonTimer = 380 + Math.random() * 200 }
                else if (roll < 0.75) { ag.masonMode = "fish"; ag.masonTimer = 320 + Math.random() * 140 }
                else {
                  ag.masonMode = "visit"
                  // Visit Lil Claw or Goop
                  const target = this.ags[Math.floor(Math.random() * 2)]
                  ag.masonVisitX = target.wx
                  ag.masonVisitY = target.wy
                  ag.masonTimer = 450 + Math.random() * 200
                }
              }
              if (ag.masonMode === "read") {
                ag.tx = 662; ag.ty = 116   // near mid-ground reading tree (y=104 tree base)
              } else if (ag.masonMode === "fish") {
                ag.tx = 834; ag.ty = 170   // pond edge
              } else if (ag.masonMode === "visit") {
                ag.tx = ag.masonVisitX
                ag.ty = ag.masonVisitY
              } else {
                // normal zone wander
                if (Math.abs(ag.tx - ag.wx) < 1 && Math.abs(ag.ty - ag.wy) < 1 && ag.wait <= 0) {
                  const z = ag.cfg.zone
                  ag.tx = z.x1 + 8 + Math.random() * (z.x2 - z.x1 - 16)
                  ag.ty = z.y1 + 16 + Math.random() * (z.y2 - z.y1 - 24)
                  ag.wait = 80 + Math.random() * 100
                }
              }

            } else if (ag.id === "goop") {
              // Blacksmith: visits anvil, logs, or wanders in forge zone
              ag.goopTargetTimer -= 1
              if (ag.goopTargetTimer <= 0) {
                const roll = Math.random()
                ag.goopTarget = roll < 0.35 ? "forge" : roll < 0.6 ? "anvil" : roll < 0.75 ? "logs" : "wander"
                ag.goopTargetTimer = 200 + Math.random() * 200
              }
              if (ag.goopTarget === "forge") { ag.tx = ag.cfg.station.x + 10; ag.ty = ag.cfg.station.y + 22 }
              else if (ag.goopTarget === "anvil") { ag.tx = ag.cfg.station.x + 52; ag.ty = ag.cfg.station.y + 15 }
              else if (ag.goopTarget === "logs") { ag.tx = ag.cfg.station.x - 52; ag.ty = ag.cfg.station.y + 10 }
              else {
                if (Math.abs(ag.tx - ag.wx) < 1 && Math.abs(ag.ty - ag.wy) < 1 && ag.wait <= 0) {
                  const z = ag.cfg.zone
                  ag.tx = z.x1 + 8 + Math.random() * (z.x2 - z.x1 - 16)
                  ag.ty = z.y1 + 16 + Math.random() * (z.y2 - z.y1 - 24)
                  ag.wait = 80 + Math.random() * 100
                }
              }

            } else if (ag.id === "lil-claw") {
              // Farm manager: checks crops, visits coop, or wanders farm
              ag.lilTargetTimer -= 1
              if (ag.lilTargetTimer <= 0) {
                const roll = Math.random()
                ag.lilTarget = roll < 0.4 ? "crops" : roll < 0.6 ? "coop" : "wander"
                ag.lilTargetTimer = 240 + Math.random() * 200
              }
              if (ag.lilTarget === "crops") { ag.tx = 40 + Math.random() * 100; ag.ty = 155 + Math.random() * 18 }
              else if (ag.lilTarget === "coop") { ag.tx = 188; ag.ty = 145 }  // new coop at 188,138
              else {
                if (Math.abs(ag.tx - ag.wx) < 1 && Math.abs(ag.ty - ag.wy) < 1 && ag.wait <= 0) {
                  const z = ag.cfg.zone
                  ag.tx = z.x1 + 8 + Math.random() * (z.x2 - z.x1 - 16)
                  ag.ty = z.y1 + 16 + Math.random() * (z.y2 - z.y1 - 24)
                  ag.wait = 80 + Math.random() * 100
                }
              }
            }

            // ── Movement
            const dx = ag.tx - ag.wx, dy = ag.ty - ag.wy, dist = Math.hypot(dx, dy)
            const walking = dist > 2

            if (walking) {
              const absDx = Math.abs(dx), absDy = Math.abs(dy)
              ag.dir = absDx > absDy ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1)
              const speedMul = isNight && !ag.isWorking ? 0.55 : 1
              ag.wx += (dx / dist) * 0.38 * speedMul
              ag.wy += (dy / dist) * 0.38 * speedMul
              // Working agents walk faster cycle; idle walk normal
              ag.frameTick++
              const walkThr = ag.isWorking ? 3 : 5
              if (ag.frameTick > walkThr) { ag.walkF = ((ag.walkF + 1) % 4) as 0|1|2|3; ag.frameTick = 0 }
            } else {
              ag.walkF = 0; ag.frameTick = 0
              // ── Idle look-around: periodically face different directions while standing
              if (!ag.isWorking) {
                ag.idleAnimTimer--
                if (ag.idleAnimTimer <= 0) {
                  const roll = Math.random()
                  ag.idleAnimMode = roll < 0.38 ? "down" : roll < 0.62 ? "left" : roll < 0.82 ? "right" : "up"
                  ag.idleAnimTimer = 72 + Math.random() * 130
                }
                ag.dir = ag.idleAnimMode === "down" ? 0 : ag.idleAnimMode === "up" ? 1 : ag.idleAnimMode === "left" ? 2 : 3
              }
            }
            if (ag.wait > 0) ag.wait--
            if (dist < 1.5) ag.idleTime++

            // ── Sprite frame
            const frameIdx = ag.dir * SWALK + ag.walkF
            ag.sprite.setFrame(frameIdx)

            // ── Animation state: three distinct modes
            const phase = ag.wx * 0.05
            let bob = 0
            let bx_off = 0

            if (ag.isWorking) {
              // WORKING — energetic bob + micro lateral sway
              bob    = Math.sin(t / 80 + phase) * 2.2
              bx_off = Math.sin(t / 130 + phase) * 0.8
            } else if (ag.health === "red") {
              // STUCK — horizontal trembling to signal distress
              bob    = Math.sin(t / 400 + phase) * 0.5
              bx_off = Math.sin(t / 58) * 1.9
            } else {
              // IDLE — calm breathing bob only
              bob = Math.sin(t / 450 + phase) * 0.7
            }

            ag.sprite.setPosition(Math.round(ag.wx + bx_off), Math.round(ag.wy + bob))
            ag.nameTag.setPosition(Math.round(ag.wx), Math.round(ag.wy + 6)).setAlpha(ag.isWorking ? 1 : 0.7)

            // ── Y-sort + depth
            const depth = Math.round(ag.wy)
            ag.sprite.setDepth(depth)
            ag.toolG.setDepth(depth + 1)
            ag.glow.setDepth(depth - 2)
            ag.nameTag.setDepth(depth + 8900)

            // ── Y-scale (2.5D depth illusion)
            const ySc = 0.72 + 0.28 * Math.max(0, Math.min(1, (ag.wy - 110) / 72))
            ag.sprite.setScale(SPRITE_SCALE * ySc)

            // ── Tool OR stuck indicator (share toolG)
            ag.toolG.clear()
            if (ag.isWorking) {
              const dir = ag.dir === 2 ? -1 : 1
              drawTool(ag.toolG, ag.cfg.tool, Math.round(ag.wx + bx_off) + dir * 12, Math.round(ag.wy - 18 + bob))
            } else if (ag.health === "red") {
              // Floating "!" above stuck character (bobs gently)
              const bx2 = Math.round(ag.wx)
              const bangY = Math.round(ag.wy - 42 + Math.sin(t / 320) * 2)
              ag.toolG.fillStyle(0xff2a2a, 0.9); ag.toolG.fillRect(bx2 - 1, bangY, 2, 8)    // bar
              ag.toolG.fillRect(bx2 - 1, bangY + 11, 2, 2)                                    // dot
              ag.toolG.fillStyle(0xff0000, 0.15); ag.toolG.fillCircle(bx2, bangY + 6, 7)     // halo
            }

            // ── Fishing line for Mason when fishing
            if (ag.id === "mason" && ag.masonMode === "fish" && !ag.isWorking && dist < 5) {
              const bobY = 172 + Math.sin(t / 800) * 2
              drawFishingLine(this.fishingG, Math.round(ag.wx), Math.round(ag.wy - 8), bobY)
            } else if (ag.id === "mason") {
              this.fishingG.clear()
            }

            // ── Glow ring — distinct per state
            ag.glow.clear()
            if (ag.isWorking) {
              // WORKING: brighter, faster pulse + wider aura
              const gA = 0.28 + Math.sin(t / 280) * 0.13
              ag.glow.fillStyle(ag.cfg.color, gA * 0.38); ag.glow.fillCircle(0, 0, 22)
              ag.glow.fillStyle(ag.cfg.color, gA);         ag.glow.fillCircle(0, 0, 11)
            } else if (ag.health === "red") {
              // STUCK: rapid alarm pulse, wider than working
              const gA = 0.32 + Math.sin(t / 190) * 0.18
              ag.glow.fillStyle(0xff2222, gA * 0.30); ag.glow.fillCircle(0, 0, 28)
              ag.glow.fillStyle(0xc45a3a, gA);         ag.glow.fillCircle(0, 0, 16)
            } else if (ag.health === "amber") {
              const gA = 0.12 + Math.sin(t / 500) * 0.04
              ag.glow.fillStyle(0xe8a935, gA);           ag.glow.fillCircle(0, 0, 14)
            }
            ag.glow.setPosition(ag.wx + bx_off, ag.wy - 14 * SPRITE_SCALE)

            // Idle heart (occasional, only when calm)
            if (!ag.isWorking && ag.health === "green" && ag.idleTime > 0 && ag.idleTime % 240 === 0)
              this.spawnHeart(ag.wx + (Math.random() - 0.5) * 10, ag.wy - 32)

            // ── Proximity hearts: when Mason visits someone
            if (ag.id === "mason" && ag.masonMode === "visit" && dist < 6) {
              const targetAg = this.ags.find(a => a.wx === ag.masonVisitX || Math.abs(a.wx - ag.masonVisitX) < 20)
              if (targetAg && Math.floor(t / 80) % 40 === 0)
                this.spawnHeart((ag.wx + (targetAg?.wx ?? ag.wx)) / 2, ag.wy - 24)
            }

          }

          // ── Seed packets
          const totalInbox = this.ags.reduce((s, a) => s + a.inboxCount, 0)
          this.drawSeedPackets(totalInbox)

          // ── Forge sparks (when Goop is working)
          if (goopIsWorking) {
            const goopAg = this.ags.find(a => a.id === "goop")
            if (goopAg) {
              // Sparks from forge chimney (smithy chimney is ~26px left, ~102px above station base)
              const forgeX = AGENTS[1].station.x - 22
              const forgeY = AGENTS[1].station.y - 102
              drawForgeSparks(this.sparkG, forgeX, forgeY, t)
            }
          } else {
            this.sparkG.clear()
          }

          // ── Chickens (wander in front of farmhouse: y 128-155, depth = their wy)
          for (const ch of this.chickens) {
            if (ch.wait > 0) { ch.wait--; continue }
            const dx = ch.tx - ch.wx, dy = ch.ty - ch.wy, dist = Math.hypot(dx, dy)
            if (dist < 1.5) {
              if (isBadWeather) { ch.tx = 185 + Math.random() * 10; ch.ty = 138 + Math.random() * 8 }
              else { ch.tx = 152 + Math.random() * 58; ch.ty = 128 + Math.random() * 26 }
              ch.dir = ch.tx > ch.wx ? "right" : "left"
              ch.wait = isBadWeather ? 140 + Math.random() * 120 : 50 + Math.random() * 90
            } else {
              const hurry = isBadWeather ? 1.6 : 1
              ch.wx += (dx / dist) * 0.17 * hurry; ch.wy += (dy / dist) * 0.12 * hurry
            }
            drawChicken(ch.g, ch.wx, ch.wy, ch.dir)
            ch.g.setPosition(0, 0)
            ch.g.setDepth(Math.round(ch.wy))  // Y-sort chickens
          }

          // ── Cow (slow wander in front of farmhouse: y 128-150)
          const cs = this.cowState
          if (cs.wait > 0) { cs.wait-- }
          else {
            const dx = cs.tx - cs.wx, dy = cs.ty - cs.wy, d = Math.hypot(dx, dy)
            if (d < 1.5) {
              if (isBadWeather) { cs.tx = 168 + Math.random() * 14; cs.ty = 136 + Math.random() * 10 }
              else { cs.tx = 155 + Math.random() * 45; cs.ty = 128 + Math.random() * 20 }
              cs.dir = cs.tx > cs.wx ? "right" : "left"
              cs.wait = isBadWeather ? 160 + Math.random() * 140 : 100 + Math.random() * 120
            } else {
              const hurry = isBadWeather ? 1.5 : 1
              cs.wx += (dx / d) * 0.10 * hurry; cs.wy += (dy / d) * 0.10 * hurry
            }
          }
          drawCow(this.cowG, cs.wx, cs.wy, cs.dir)
          this.cowG.setDepth(Math.round(cs.wy))  // Y-sort cow

          // ── Butterflies
          for (const bf of this.butterflies) {
            const bx = bf.bx + Math.sin(t / 1200 * bf.sp + bf.ph) * 30
            const by = bf.by + Math.cos(t / 1600 * bf.sp + bf.ph * 1.3) * 14
            const open = Math.sin(t / 200 * bf.sp + bf.ph) > 0
            drawButterfly(bf.g, bx, by, open, bf.primary, bf.secondary)
          }

          // ── Fireflies
          for (const f of this.fireflies) {
            const x = f.bx + Math.sin(t / 1400 * f.sp + f.ph) * 26
            const y = f.by + Math.cos(t / 1700 * f.sp + f.ph * 1.7) * 12
            const a = 0.35 + (Math.sin(t / 500 * f.sp + f.ph) * 0.5 + 0.5) * 0.55
            f.g.clear()
            f.g.fillStyle(f.hue, a * 0.25); f.g.fillCircle(x, y, 2.4)
            f.g.fillStyle(f.hue, a);        f.g.fillCircle(x, y, 0.9)
          }

          // ── Hearts
          for (let i = this.hearts.length - 1; i >= 0; i--) {
            const h = this.hearts[i]
            h.g.y += h.vy; h.alpha = Math.max(0, h.alpha - 0.008); h.g.setAlpha(h.alpha)
            if (h.alpha <= 0) { h.g.destroy(); this.hearts.splice(i, 1) }
          }

          // ── Handoff packets — arc animation from completing agent to receiving agent
          for (let i = this.handoffPackets.length - 1; i >= 0; i--) {
            const pk = this.handoffPackets[i]
            pk.progress += 0.014  // ~70 frames to travel
            if (pk.progress >= 1) { pk.g.destroy(); this.handoffPackets.splice(i, 1); continue }
            const p = pk.progress
            // Quadratic Bezier arc (midpoint lifted above both endpoints)
            const midX = (pk.fromX + pk.toX) / 2
            const midY = Math.min(pk.fromY, pk.toY) - 40
            const bx3 = (1-p)*(1-p)*pk.fromX + 2*(1-p)*p*midX + p*p*pk.toX
            const by3 = (1-p)*(1-p)*pk.fromY + 2*(1-p)*p*midY + p*p*pk.toY
            const alpha3 = p < 0.08 ? p/0.08 : p > 0.88 ? (1-p)/0.12 : 1
            pk.g.clear()
            // Outer glow
            pk.g.fillStyle(pk.color, alpha3 * 0.22); pk.g.fillCircle(bx3, by3, 6)
            // Core dot
            pk.g.fillStyle(pk.color, alpha3 * 0.9);  pk.g.fillCircle(bx3, by3, 2.5)
            // Bright centre
            pk.g.fillStyle(0xffffff,  alpha3 * 0.65); pk.g.fillCircle(bx3, by3, 1.1)
            // Trailing ghost
            if (p > 0.07) {
              const pt = p - 0.07
              const tbx = (1-pt)*(1-pt)*pk.fromX + 2*(1-pt)*pt*midX + pt*pt*pk.toX
              const tby = (1-pt)*(1-pt)*pk.fromY + 2*(1-pt)*pt*midY + pt*pt*pk.toY
              pk.g.fillStyle(pk.color, alpha3 * 0.22); pk.g.fillCircle(tbx, tby, 1.5)
            }
          }
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO, parent: host,
        width: BASE_W, height: BASE_H,
        pixelArt: true, roundPixels: true,
        backgroundColor: "#7da848",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: Scene,
      })
    })()

    return () => { destroyed = true; game?.destroy(true) }
  }, [])

  return (
    <div
      ref={hostRef}
      style={{ width: "100%", height, imageRendering: "pixelated", background: "#7da848" }}
    />
  )
}
