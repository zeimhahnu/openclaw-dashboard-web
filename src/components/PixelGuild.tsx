"use client"
import { useEffect, useRef } from "react"
import type { AgentState as ApiAgentState, AgentTaskDetails } from "@/hooks/useDashboardApi"

const BASE_W = 900, BASE_H = 200
const GROUND_Y = 88
// LPC-style sprite: 16w x 32h per frame, 4 walk frames x 4 directions
const SW = 16, SH = 32, SDIRS = 4, SWALK = 4
const SPRITE_SCALE = 1.8
const STATION_SCALE = 1.85

const AGENTS = [
  {
    id: "lil-claw" as const, name: "Lil Claw", color: 0x5ec27e, colorCss: "#5ec27e",
    role: "Farm Manager",
    home:     { x: 110, y: 155 },
    station:  { x: 80,  y: 160 },
    zone:     { x1: 28, y1: 95, x2: 235, y2: 188 },
    pal: { skin: 0xf3c8a4, hair: 0x4a2810, shirt: 0xc44a2a, pants: 0x6b3818, shoe: 0x2a1808 },
    tool: "watering" as const,
  },
  {
    id: "goop" as const, name: "Goop", color: 0x52b8d0, colorCss: "#52b8d0",
    role: "Blacksmith & Carpenter",
    home:     { x: 450, y: 152 },
    station:  { x: 420, y: 160 },
    zone:     { x1: 320, y1: 95, x2: 560, y2: 188 },
    pal: { skin: 0xd1a87a, hair: 0x222222, shirt: 0x4a7090, pants: 0x3a2818, shoe: 0x1a0808 },
    tool: "hammer" as const,
  },
  {
    id: "mason" as const, name: "Mason", color: 0x9b87f0, colorCss: "#9b87f0",
    role: "Scholar of the Vale",
    home:     { x: 780, y: 155 },
    station:  { x: 755, y: 160 },
    zone:     { x1: 630, y1: 95, x2: 880, y2: 188 },
    pal: { skin: 0xf3c8a4, hair: 0xb8b8c8, shirt: 0x6a4a8c, pants: 0x3a2838, shoe: 0x2a1808 },
    tool: "quill" as const,
  },
]

// ─── Canvas-based LPC-style sprite generation ──────────────────────────────

type Pal = { skin: number; hair: number; shirt: number; pants: number; shoe: number }
type C2D = CanvasRenderingContext2D

function rgb(h: number): string {
  return `rgb(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255})`
}
function rgba(h: number, a: number): string {
  return `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${a})`
}
function px(c: C2D, x: number, y: number, w: number, h: number, col: number, a?: number) {
  c.fillStyle = a != null ? rgba(col, a) : rgb(col)
  c.fillRect(x, y, w, h)
}

// Draw one 16x32 character frame at canvas offset (ox, oy)
// dir: 0=down, 1=up, 2=left, 3=right  |  f: walk frame 0-3
function drawFrame(ctx: C2D, ox: number, oy: number, pal: Pal, dir: number, f: number) {
  const { skin, hair, shirt, pants, shoe } = pal
  // walk cycle: alternating leg/arm offsets
  const LLY = [0, -2, 0, 2]   // left-leg Y offset (negative=forward step)
  const RLY = [0,  2, 0, -2]  // right-leg Y offset
  const LLX = [0, -1, 0,  1]  // left-leg X
  const RLX = [0,  1, 0, -1]  // right-leg X
  const LAY = [0,  1, 0, -1]  // left-arm Y (opposite to right leg)
  const RAY = [0, -1, 0,  1]  // right-arm Y
  const BOB = [0,  1, 0,  1]  // body bob (down mid-stride)
  const b = BOB[f]

  if (dir === 0) { // FACING DOWN (camera)
    px(ctx, ox+3,         oy+30,          10, 2, 0x000000, 0.18) // shadow
    px(ctx, ox+2+LLX[f], oy+27+LLY[f],   5,  3, shoe)           // left shoe
    px(ctx, ox+9+RLX[f], oy+27+RLY[f],   5,  3, shoe)           // right shoe
    px(ctx, ox+3+LLX[f], oy+17+b,        4,  10+LLY[f], pants)  // left leg
    px(ctx, ox+9+RLX[f], oy+17+b,        4,  10+RLY[f], pants)  // right leg
    px(ctx, ox+2,         oy+16+b,        12, 2, 0x2a1808)       // belt
    px(ctx, ox+2,         oy+7+b,         12, 10, shirt)          // torso
    px(ctx, ox+0,         oy+8+b+LAY[f], 2,  8, skin)            // left arm
    px(ctx, ox+14,        oy+8+b+RAY[f], 2,  8, skin)            // right arm
    px(ctx, ox+6,         oy+5+b,         4,  3, skin)            // neck
    px(ctx, ox+3,         oy+0+b,         10, 6, skin)            // head
    px(ctx, ox+4,         oy-3+b,         8,  4, hair)            // top hair
    px(ctx, ox+2,         oy+0+b,         2,  4, hair)            // sideburn L
    px(ctx, ox+12,        oy+0+b,         2,  4, hair)            // sideburn R
    px(ctx, ox+5,         oy+2+b,         1,  1, 0x1a1a1a)       // eye L
    px(ctx, ox+9,         oy+2+b,         1,  1, 0x1a1a1a)       // eye R
    px(ctx, ox+5,         oy+1+b,         2,  1, hair)            // brow L
    px(ctx, ox+9,         oy+1+b,         2,  1, hair)            // brow R
    px(ctx, ox+7,         oy+4+b,         2,  1, 0x8a3a2a)       // mouth
  } else if (dir === 1) { // FACING UP (back to camera)
    px(ctx, ox+3,         oy+30,          10, 2, 0x000000, 0.18)
    px(ctx, ox+2+LLX[f], oy+27+LLY[f],   5,  3, shoe)
    px(ctx, ox+9+RLX[f], oy+27+RLY[f],   5,  3, shoe)
    px(ctx, ox+3+LLX[f], oy+17+b,        4,  10+LLY[f], pants)
    px(ctx, ox+9+RLX[f], oy+17+b,        4,  10+RLY[f], pants)
    px(ctx, ox+2,         oy+16+b,        12, 2, 0x2a1808)
    px(ctx, ox+2,         oy+7+b,         12, 10, shirt)
    px(ctx, ox+0,         oy+8+b+LAY[f], 2,  8, skin)
    px(ctx, ox+14,        oy+8+b+RAY[f], 2,  8, skin)
    px(ctx, ox+6,         oy+5+b,         4,  3, skin)
    px(ctx, ox+3,         oy+0+b,         10, 6, skin)
    px(ctx, ox+3,         oy-4+b,         10, 8, hair)   // full back hair, thicker
    px(ctx, ox+2,         oy+0+b,         2,  5, hair)   // wide sideburn
    px(ctx, ox+12,        oy+0+b,         2,  5, hair)
    // no eyes/mouth (back of head)
  } else if (dir === 2) { // FACING LEFT (profile)
    px(ctx, ox+4,         oy+30,          8,  2, 0x000000, 0.15)
    px(ctx, ox+3+LLX[f], oy+27+LLY[f],   5,  3, shoe)           // front foot
    px(ctx, ox+5+RLX[f], oy+27+RLY[f],   4,  3, 0x1a0808)       // rear foot (darker)
    px(ctx, ox+4+LLX[f], oy+17+b,        4,  10+LLY[f], pants)  // front leg
    px(ctx, ox+5+RLX[f], oy+17+b,        3,  10+RLY[f], 0x3a2010) // rear leg
    px(ctx, ox+3,         oy+16+b,        9,  2, 0x2a1808)
    px(ctx, ox+3,         oy+7+b,         9,  10, shirt)
    px(ctx, ox+1,         oy+8+b+LAY[f], 2,  8, skin)            // front arm
    px(ctx, ox+11,        oy+9+b,         2,  7, 0x3a2a18)       // rear arm hint
    px(ctx, ox+5,         oy+5+b,         3,  3, skin)            // neck
    px(ctx, ox+4,         oy+0+b,         8,  6, skin)            // head
    px(ctx, ox+3,         oy-3+b,         9,  5, hair)            // hair
    px(ctx, ox+2,         oy-1+b,         2,  4, hair)            // side hang
    px(ctx, ox+4,         oy+2+b,         1,  1, 0x1a1a1a)       // eye (profile)
    px(ctx, ox+4,         oy+1+b,         2,  1, hair)            // brow
    px(ctx, ox+3,         oy+3+b,         1,  1, 0xa0826a)       // nose
    px(ctx, ox+4,         oy+4+b,         1,  1, 0x8a3a2a)       // mouth
    px(ctx, ox+11,        oy+2+b,         1,  2, skin)            // ear
  } else { // FACING RIGHT (profile mirrored)
    px(ctx, ox+4,         oy+30,          8,  2, 0x000000, 0.15)
    px(ctx, ox+8+RLX[f], oy+27+RLY[f],   5,  3, shoe)
    px(ctx, ox+7+LLX[f], oy+27+LLY[f],   4,  3, 0x1a0808)
    px(ctx, ox+8+RLX[f], oy+17+b,        4,  10+RLY[f], pants)
    px(ctx, ox+8+LLX[f], oy+17+b,        3,  10+LLY[f], 0x3a2010)
    px(ctx, ox+4,         oy+16+b,        9,  2, 0x2a1808)
    px(ctx, ox+4,         oy+7+b,         9,  10, shirt)
    px(ctx, ox+13,        oy+8+b+RAY[f], 2,  8, skin)
    px(ctx, ox+3,         oy+9+b,         2,  7, 0x3a2a18)
    px(ctx, ox+8,         oy+5+b,         3,  3, skin)
    px(ctx, ox+4,         oy+0+b,         8,  6, skin)
    px(ctx, ox+4,         oy-3+b,         9,  5, hair)
    px(ctx, ox+11,        oy-1+b,         2,  4, hair)
    px(ctx, ox+11,        oy+2+b,         1,  1, 0x1a1a1a)
    px(ctx, ox+10,        oy+1+b,         2,  1, hair)
    px(ctx, ox+12,        oy+3+b,         1,  1, 0xa0826a)
    px(ctx, ox+11,        oy+4+b,         1,  1, 0x8a3a2a)
    px(ctx, ox+4,         oy+2+b,         1,  2, skin)
  }
}

function buildCharCanvas(pal: Pal): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = SW * SWALK
  canvas.height = SH * SDIRS
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (let d = 0; d < SDIRS; d++)
    for (let f = 0; f < SWALK; f++)
      drawFrame(ctx, f * SW, d * SH, pal, d, f)
  return canvas
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

function drawStation(g: Phaser.GameObjects.Graphics, kind: "manager"|"forge"|"study", x: number, y: number) {
  g.clear()
  if (kind === "manager") {
    g.fillStyle(0x6a3a18, 1); g.fillRect(x - 12, y - 10, 24, 12)
    g.fillStyle(0x8a5a2a, 1); g.fillRect(x - 12, y - 10, 24, 2)
    g.fillStyle(0xc44a2a, 1); g.fillTriangle(x - 16, y - 10, x + 16, y - 10, x, y - 22)
    g.fillStyle(0x8a2a14, 1); g.fillTriangle(x, y - 22, x + 16, y - 10, x + 8, y - 10)
    g.fillStyle(0x2a1808, 1); g.fillRect(x - 3, y - 7, 6, 9)
    g.fillStyle(0xf3c8a4, 1); g.fillRect(x + 1, y - 3, 1, 1)
    g.fillStyle(0x6a3a18, 1); g.fillRect(x + 18, y - 12, 1, 14)
    g.fillStyle(0xdecb95, 1); g.fillRect(x + 17, y - 14, 14, 6)
    g.fillStyle(0x4a2810, 1)
    g.fillRect(x + 18, y - 13, 12, 1); g.fillRect(x + 18, y - 11, 12, 1); g.fillRect(x + 18, y - 9, 8, 1)
  } else if (kind === "forge") {
    g.fillStyle(0x6a6058, 1); g.fillRect(x - 14, y - 14, 28, 16)
    g.fillStyle(0x4a4238, 1); g.fillRect(x - 14, y - 14, 28, 2)
    g.fillStyle(0x2a1810, 1); g.fillRect(x - 8, y - 5, 16, 7)
    g.fillStyle(0xff7a2a, 0.7); g.fillRect(x - 6, y - 3, 12, 4)
    g.fillStyle(0xffd040, 0.5); g.fillRect(x - 4, y - 2, 8, 2)
    g.fillStyle(0x3a3028, 1); g.fillRect(x - 10, y - 26, 6, 12)
    g.fillStyle(0x5a4a3a, 1); g.fillRect(x - 11, y - 27, 8, 2)
    // Anvil
    g.fillStyle(0x2a2a2a, 1); g.fillRect(x + 16, y - 6, 10, 4)
    g.fillStyle(0x4a4a4a, 1); g.fillRect(x + 16, y - 7, 10, 1)
    g.fillStyle(0x1a1a1a, 1); g.fillRect(x + 18, y - 2, 6, 4)
    // Lumber stack
    g.fillStyle(0x6a3a18, 1); g.fillRect(x - 22, y - 5, 6, 7)
    g.fillStyle(0x8a5a2a, 1); g.fillRect(x - 22, y - 5, 6, 1); g.fillRect(x - 23, y, 8, 3)
  } else {
    g.fillStyle(0x6a3a18, 1); g.fillRect(x - 14, y - 6, 28, 8)
    g.fillStyle(0x4a2810, 1); g.fillRect(x - 14, y - 6, 28, 1); g.fillRect(x - 14, y + 1, 28, 1)
    g.fillRect(x - 13, y + 1, 2, 6); g.fillRect(x + 11, y + 1, 2, 6)
    g.fillStyle(0xfdfaf0, 1); g.fillRect(x - 8, y - 5, 16, 5)
    g.fillStyle(0x8a7a5a, 1); g.fillRect(x - 7, y - 4, 14, 1); g.fillRect(x - 7, y - 2, 12, 1)
    g.fillStyle(0x4a3a2a, 1); g.fillRect(x, y - 5, 1, 5)
    g.fillStyle(0xe8c8a4, 1); g.fillRect(x + 12, y - 11, 2, 6)
    g.fillStyle(0xfacc6a, 0.9); g.fillRect(x + 12, y - 13, 2, 2)
    g.fillStyle(0xfff0a0, 0.7); g.fillRect(x + 12, y - 12, 1, 1)
  }
}

function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number, size: 1|2 = 1) {
  const r = size === 2 ? 13 : 9
  g.fillStyle(0x6a3a18, 1); g.fillRect(x - 1, y, 3, 7)
  g.fillStyle(0x3a6a2a, 1); g.fillCircle(x, y - 2, r)
  g.fillStyle(0x4a7a3a, 1); g.fillCircle(x - 2, y - 4, Math.round(r * 0.65))
  g.fillStyle(0x5a8a4a, 0.75); g.fillCircle(x + 2, y - 5, Math.round(r * 0.45))
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

export interface PixelGuildProps {
  agents?: Record<string, ApiAgentState> | null
  taskDetails?: Record<string, AgentTaskDetails> | null
  height?: number
}

export default function PixelGuild({ agents = null, taskDetails = null, height = 240 }: PixelGuildProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef<{ agents: Record<string, ApiAgentState> | null; taskDetails: Record<string, AgentTaskDetails> | null }>({ agents: null, taskDetails: null })

  useEffect(() => { dataRef.current = { agents, taskDetails } }, [agents, taskDetails])

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
        walkF: 0|1|2|3  // walk frame
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

      class Scene extends Phaser.Scene {
        ags: AgentLocal[] = []
        chickens: ChickenLocal[] = []
        butterflies: Butterfly[] = []
        hearts: Heart[] = []
        fireflies: Firefly[] = []
        wheats: WheatStalk[] = []
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
            { t: 0.00, r: 0x2a, g: 0x22, b: 0x44 },
            { t: 0.55, r: 0x6e, g: 0x3f, b: 0x55 },
            { t: 0.80, r: 0xc4, g: 0x6e, b: 0x42 },
            { t: 1.00, r: 0xf0, g: 0xb0, b: 0x52 },
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
          // Sun
          bg.fillStyle(0xffd27a, 0.30); bg.fillCircle(742, GROUND_Y - 6, 30)
          bg.fillStyle(0xffe6a0, 0.55); bg.fillCircle(742, GROUND_Y - 6, 18)
          bg.fillStyle(0xfff2cc, 0.90); bg.fillCircle(742, GROUND_Y - 6, 11)
          // Stars
          bg.fillStyle(0xfdf6e0, 0.8)
          for (const [sx, sy] of [[120,16],[210,30],[330,12],[60,40],[470,20],[560,34]] as const)
            bg.fillRect(sx, sy, 1, 1)
          // Mountain range (jagged silhouette)
          bg.fillStyle(0x3a3450, 0.9)
          bg.fillTriangle(0, GROUND_Y, 90, GROUND_Y - 30, 200, GROUND_Y)
          bg.fillTriangle(120, GROUND_Y, 220, GROUND_Y - 22, 340, GROUND_Y)
          bg.fillStyle(0x45324a, 0.9)
          bg.fillTriangle(280, GROUND_Y, 410, GROUND_Y - 28, 530, GROUND_Y)
          bg.fillTriangle(460, GROUND_Y, 570, GROUND_Y - 18, 660, GROUND_Y)
          bg.fillTriangle(620, GROUND_Y, 760, GROUND_Y - 25, 900, GROUND_Y)
          // Snow caps
          bg.fillStyle(0xf0eee8, 0.65)
          bg.fillTriangle(90, GROUND_Y - 30, 80, GROUND_Y - 24, 100, GROUND_Y - 24)
          bg.fillTriangle(220, GROUND_Y - 22, 212, GROUND_Y - 17, 228, GROUND_Y - 17)
          bg.fillTriangle(410, GROUND_Y - 28, 400, GROUND_Y - 22, 420, GROUND_Y - 22)
          bg.fillTriangle(760, GROUND_Y - 25, 750, GROUND_Y - 19, 770, GROUND_Y - 19)

          // ── Ground
          const ground = this.add.graphics().setDepth(-8)
          ground.fillStyle(0x3c5733, 1); ground.fillRect(0, GROUND_Y, BASE_W, BASE_H - GROUND_Y)
          ground.fillStyle(0x6a5a3a, 0.22); ground.fillEllipse(742, GROUND_Y + 30, 360, 120)
          for (let i = 0; i < 80; i++) {
            const x = (i * 17 + 11) % BASE_W
            const y = GROUND_Y + ((i * 7) % (BASE_H - GROUND_Y))
            ground.fillStyle(0x2e4628, 0.55); ground.fillRect(x, y, 1, 2)
            ground.fillStyle(0x4a6a38, 0.45); ground.fillRect(x + 1, y - 1, 1, 1)
          }
          // Footpath
          for (let i = 0; i < 13; i++) {
            const px = 60 + i * 64
            ground.fillStyle(0x8c7e5e, 0.85); ground.fillRoundedRect(px, BASE_H - 12, 46, 7, 2)
            ground.fillStyle(0x6a5e44, 0.5); ground.fillRoundedRect(px + 2, BASE_H - 7, 42, 2, 1)
          }

          // ── Scattered flowers
          const flowerColors = [0xe84040, 0xe8d040, 0x8040e8, 0xe880a0, 0x40c8e8, 0xffa040]
          const flowerSpots = [[38,155],[55,168],[75,142],[130,185],[165,175],[250,160],[310,172],[350,145],[500,180],[540,168],[590,175],[645,158],[680,185],[720,170],[800,158],[840,172],[870,145],[888,162]]
          const flowerGfx = this.add.graphics().setDepth(0)
          for (const [fx, fy] of flowerSpots)
            drawFlower(flowerGfx, fx, fy, flowerColors[Math.floor(fx / 50) % flowerColors.length])

          // ── Rocks
          const rockGfx = this.add.graphics().setDepth(0)
          drawRock(rockGfx, 260, 108, 14, 8)
          drawRock(rockGfx, 272, 112, 9, 5)
          drawRock(rockGfx, 590, 105, 12, 7)
          drawRock(rockGfx, 600, 110, 8, 5)
          drawRock(rockGfx, 308, 180, 10, 6)

          // ── Trees (5 total: 2 original + reading tree + 2 more)
          const treeLeftG  = this.add.graphics().setDepth(0)
          const treeRightG = this.add.graphics().setDepth(0)
          const treeReadG  = this.add.graphics().setDepth(0)  // Mason's reading tree
          const treeExtraG = this.add.graphics().setDepth(0)
          const treeExtra2G= this.add.graphics().setDepth(0)
          drawTree(treeLeftG,  248, GROUND_Y, 2)
          drawTree(treeRightG, 595, GROUND_Y, 1)
          drawTree(treeReadG,  658, GROUND_Y, 2)   // Mason reads here
          drawTree(treeExtraG, 310, GROUND_Y, 1)
          drawTree(treeExtra2G, 42, GROUND_Y, 1)

          // ── Bushes
          const bushA = this.add.graphics().setDepth(0); drawBush(bushA, 18, 170)
          const bushB = this.add.graphics().setDepth(0); drawBush(bushB, 880, 172)
          const bushC = this.add.graphics().setDepth(0); drawBush(bushC, 580, 168)

          // ── Wheat rows for Lil Claw's farm
          this.wheats = []
          const wheatXs = [34, 46, 58, 70, 82, 94]
          for (const wx of wheatXs) {
            const ripe = wx % 24 < 12
            const wg = this.add.graphics().setDepth(1)
            drawWheat(wg, wx, 178, ripe)
            this.wheats.push({ g: wg, x: wx, y: 178, ripe })
            const wg2 = this.add.graphics().setDepth(1)
            drawWheat(wg2, wx, 166, !ripe)
            this.wheats.push({ g: wg2, x: wx, y: 166, ripe: !ripe })
          }
          // Veggie plots (right half of Lil Claw zone)
          const plotGfx = this.add.graphics().setDepth(1)
          const plots = [[145,175,3],[165,175,2],[185,175,1],[145,188,1],[165,188,3],[185,188,2]]
          for (const [px, py, gr] of plots) drawPlot(plotGfx, px, py, gr as 0|1|2|3)

          // ── Chicken coop + chickens (in Lil Claw's zone)
          this.coopG = this.add.graphics().setDepth(1); drawCoop(this.coopG, 178, 108)
          this.chickens = []
          for (let i = 0; i < 3; i++) {
            const cg = this.add.graphics().setDepth(2)
            const cx = 158 + i * 14, cy = 130
            drawChicken(cg, cx, cy, i % 2 === 0 ? "right" : "left")
            this.chickens.push({
              g: cg, wx: cx, wy: cy,
              tx: 145 + Math.random() * 60,
              ty: 122 + Math.random() * 14,
              dir: i % 2 === 0 ? "right" : "left",
              wait: 20 + Math.random() * 80,
            })
          }

          // ── Cow (Lil Claw's livestock)
          this.cowG = this.add.graphics().setDepth(2)
          drawCow(this.cowG, 172, 132, "right")

          // ── Pond (Mason's zone, right side)
          this.pondG = this.add.graphics().setDepth(1)
          drawPond(this.pondG, 845, 174)

          // ── Well and scarecrow (between zones)
          this.wellG = this.add.graphics().setDepth(1); drawWell(this.wellG, 600, 172)
          this.scarecrowG = this.add.graphics().setDepth(1); drawScarecrow(this.scarecrowG, 280, 172)

          // ── Workstations
          this.stations = []
          const kinds: ("manager"|"forge"|"study")[] = ["manager", "forge", "study"]
          AGENTS.forEach((a, i) => {
            const sg = this.add.graphics().setDepth(1)
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
            const charCanvas = buildCharCanvas(a.pal)
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

          // ── Agents (sprites)
          AGENTS.forEach((a, i) => {
            const key = `char-${a.id}`
            const sprite = this.add.sprite(a.home.x, a.home.y, key, 0)
              .setScale(SPRITE_SCALE)
              .setDepth(50 + i)
              .setOrigin(0.5, 1)  // feet at (wx, wy)
            const toolG = this.add.graphics().setDepth(52 + i)
            const glow  = this.add.graphics().setDepth(45 + i)
            const nameTag = this.add.text(a.home.x, a.home.y + 6, a.name, {
              fontFamily: "monospace", fontSize: "7px",
              color: "#f5edd6", stroke: "#1a0e00", strokeThickness: 2, resolution: 3,
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

          // ── Sky overlay for time-of-day tint
          this.skyOverlay = this.add.graphics().setDepth(9000)
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
          const { agents: apiAgents } = dataRef.current

          // ── Time-of-day tint
          const hour = new Date().getHours()
          let tint = 0x000000, tintA = 0
          if (hour >= 6  && hour < 8)  { tint = 0xffc080; tintA = 0.06 }
          else if (hour >= 8  && hour < 17) { tint = 0xfff8d0; tintA = 0.0 }
          else if (hour >= 17 && hour < 20) { tint = 0xff9050; tintA = 0.08 }
          else                              { tint = 0x2030a0; tintA = 0.18 }
          this.skyOverlay.clear()
          if (tintA > 0) { this.skyOverlay.fillStyle(tint, tintA); this.skyOverlay.fillRect(0, 0, BASE_W, BASE_H) }

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
                if (c > ag.completedPrev) { this.spawnHeart(ag.wx, ag.wy - 28); this.spawnHeart(ag.wx + 6, ag.wy - 24) }
                ag.completedPrev = c
              }
            }
            if (ag.id === "goop") goopIsWorking = ag.isWorking

            // ── Target selection (role-specific behaviors)
            if (ag.isWorking) {
              ag.tx = ag.cfg.station.x + 28
              ag.ty = ag.cfg.station.y + 12

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
                ag.tx = 660; ag.ty = 172   // near reading tree
              } else if (ag.masonMode === "fish") {
                ag.tx = 832; ag.ty = 172   // pond edge
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
              if (ag.goopTarget === "forge") { ag.tx = ag.cfg.station.x + 10; ag.ty = ag.cfg.station.y + 8 }
              else if (ag.goopTarget === "anvil") { ag.tx = ag.cfg.station.x + 50; ag.ty = ag.cfg.station.y }
              else if (ag.goopTarget === "logs") { ag.tx = ag.cfg.station.x - 28; ag.ty = ag.cfg.station.y + 2 }
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
              if (ag.lilTarget === "crops") { ag.tx = 80 + Math.random() * 110; ag.ty = 170 + Math.random() * 18 }
              else if (ag.lilTarget === "coop") { ag.tx = 170; ag.ty = 135 }
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
            if (dist > 2) {
              const absDx = Math.abs(dx), absDy = Math.abs(dy)
              ag.dir = absDx > absDy ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1)
              ag.wx += (dx / dist) * 0.38
              ag.wy += (dy / dist) * 0.38
              ag.frameTick++
              if (ag.frameTick > 6) { ag.walkF = ((ag.walkF + 1) % 4) as 0|1|2|3; ag.frameTick = 0 }
            } else {
              ag.walkF = 0; ag.frameTick = 0
            }
            if (ag.wait > 0) ag.wait--
            if (dist < 1.5) ag.idleTime++

            // ── Sprite update (texture frame)
            const frameIdx = ag.dir * SWALK + ag.walkF
            ag.sprite.setFrame(frameIdx)
            // Bob
            const standing = dist < 2
            const phase = ag.wx * 0.05
            const bob = ag.isWorking ? Math.sin(t / 120 + phase) * 1.5
              : standing ? Math.sin(t / 430 + phase) * 0.7 : 0
            ag.sprite.setPosition(Math.round(ag.wx), Math.round(ag.wy + bob))
            ag.nameTag.setPosition(Math.round(ag.wx), Math.round(ag.wy + 6)).setAlpha(ag.isWorking ? 1 : 0.7)

            // ── Tool
            if (ag.isWorking) {
              const dir = ag.dir === 2 ? -1 : 1
              drawTool(ag.toolG, ag.cfg.tool, Math.round(ag.wx) + dir * 12, Math.round(ag.wy - 18 + bob))
            } else {
              ag.toolG.clear()
            }

            // ── Fishing line for Mason when fishing
            if (ag.id === "mason" && ag.masonMode === "fish" && !ag.isWorking && dist < 5) {
              const bobY = 172 + Math.sin(t / 800) * 2
              drawFishingLine(this.fishingG, Math.round(ag.wx), Math.round(ag.wy - 8), bobY)
            } else if (ag.id === "mason") {
              this.fishingG.clear()
            }

            // ── Glow ring
            ag.glow.clear()
            if (ag.isWorking) {
              const gA = 0.20 + Math.sin(t / 500) * 0.08
              ag.glow.fillStyle(ag.cfg.color, gA); ag.glow.fillCircle(0, 0, 15)
            } else if (ag.health === "red") {
              const gA = 0.22 + Math.sin(t / 350) * 0.08
              ag.glow.fillStyle(0xc45a3a, gA); ag.glow.fillCircle(0, 0, 15)
            } else if (ag.health === "amber") {
              const gA = 0.12 + Math.sin(t / 500) * 0.04
              ag.glow.fillStyle(0xe8a935, gA); ag.glow.fillCircle(0, 0, 14)
            }
            ag.glow.setPosition(ag.wx, ag.wy - 14 * SPRITE_SCALE)

            // Idle heart
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
              // Sparks from forge chimney (forge station is at goop.station scaled)
              const forgeX = AGENTS[1].station.x - 10 * STATION_SCALE
              const forgeY = AGENTS[1].station.y - 26 * STATION_SCALE
              drawForgeSparks(this.sparkG, forgeX, forgeY, t)
            }
          } else {
            this.sparkG.clear()
          }

          // ── Chickens (wander only in Lil Claw zone: x 145-215, y 118-142)
          for (const ch of this.chickens) {
            if (ch.wait > 0) { ch.wait--; continue }
            const dx = ch.tx - ch.wx, dy = ch.ty - ch.wy, dist = Math.hypot(dx, dy)
            if (dist < 1.5) {
              ch.tx = 145 + Math.random() * 68
              ch.ty = 118 + Math.random() * 22
              ch.dir = ch.tx > ch.wx ? "right" : "left"
              ch.wait = 50 + Math.random() * 90
            } else {
              ch.wx += (dx / dist) * 0.17; ch.wy += (dy / dist) * 0.12
            }
            drawChicken(ch.g, ch.wx, ch.wy, ch.dir)
            ch.g.setPosition(0, 0)
          }

          // ── Cow (slow wander near coop)
          const cs = this.cowState
          if (cs.wait > 0) { cs.wait-- }
          else {
            const dx = cs.tx - cs.wx, dy = cs.ty - cs.wy, d = Math.hypot(dx, dy)
            if (d < 1.5) {
              cs.tx = 148 + Math.random() * 50; cs.ty = 126 + Math.random() * 14
              cs.dir = cs.tx > cs.wx ? "right" : "left"; cs.wait = 100 + Math.random() * 120
            } else {
              cs.wx += (dx / d) * 0.10; cs.wy += (dy / d) * 0.10
            }
          }
          drawCow(this.cowG, cs.wx, cs.wy, cs.dir)

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
