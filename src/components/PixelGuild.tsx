"use client"
import { useEffect, useRef } from "react"
import type { AgentState as ApiAgentState, AgentTaskDetails } from "@/hooks/useDashboardApi"

const BASE_W = 900, BASE_H = 200
const GROUND_Y = 88   // ground baseline

// ─── Agent config: each villager is unique, with their own workstation & tool
const AGENTS = [
  {
    id: "lil-claw" as const, name: "Lil Claw", color: 0x5ec27e, colorCss: "#5ec27e",
    role: "Farm Manager",
    // Spawn point + wandering home spot
    home:  { x: 110, y: 152 },
    // The workstation they walk to when working
    station: { x: 80,  y: 158 },
    // The zone bounds (where they wander when idle / where tilled plots are)
    zone:  { x1: 28,  y1: 92,  x2: 235, y2: 188 },
    // Role-specific sprite config
    skin:  0xf3c8a4, hair: 0x4a2810, shirt: 0xc44a2a, pants: 0x6b3818,
    tool:  "watering" as const,
  },
  {
    id: "goop" as const, name: "Goop", color: 0x52b8d0, colorCss: "#52b8d0",
    role: "Blacksmith & Carpenter",
    home:  { x: 450, y: 148 },
    station: { x: 430, y: 158 },
    zone:  { x1: 320, y1: 92,  x2: 560, y2: 188 },
    skin:  0xd1a87a, hair: 0x222222, shirt: 0x4a7090, pants: 0x3a2818,
    tool:  "hammer" as const,
  },
  {
    id: "mason" as const, name: "Mason", color: 0x9b87f0, colorCss: "#9b87f0",
    role: "Scholar of the Vale",
    home:  { x: 780, y: 152 },
    station: { x: 760, y: 158 },
    zone:  { x1: 630, y1: 92,  x2: 870, y2: 188 },
    skin:  0xf3c8a4, hair: 0xc0c0c0, shirt: 0x6a4a8c, pants: 0x3a2818,
    tool:  "quill" as const,
  },
]

// ─── Tool render: drawn in hand (offset relative to sprite origin)
type ToolKind = "watering" | "hammer" | "quill"

function drawTool(
  g: Phaser.GameObjects.Graphics,
  kind: ToolKind,
  x: number, y: number
) {
  // Tool anchor is in front of the villager (right hand side)
  g.clear()
  g.fillStyle(0x000000, 0.0) // no-op
  if (kind === "watering") {
    // Watering can: grey can with spout + handle
    g.fillStyle(0x9aa0a8, 1)
    g.fillRect(x - 4, y - 6, 9, 7)
    g.fillStyle(0x6e747c, 1)
    g.fillRect(x - 5, y - 6, 1, 7)
    g.fillStyle(0xbcbcc4, 1)
    g.fillRect(x - 2, y - 8, 7, 2)
    g.fillStyle(0x6e747c, 1)
    g.fillRect(x + 4, y - 6, 3, 1)  // spout base
    g.fillRect(x + 7, y - 7, 2, 2)  // spout tip
  } else if (kind === "hammer") {
    // Hammer held vertically: brown handle + grey head
    g.fillStyle(0x6a3a18, 1)
    g.fillRect(x - 1, y - 8, 2, 8)
    g.fillStyle(0x8a8a8a, 1)
    g.fillRect(x - 4, y - 10, 8, 4)
    g.fillStyle(0xb8b8b8, 1)
    g.fillRect(x - 3, y - 10, 2, 1)
  } else {
    // Quill: white feather + brown tip
    g.fillStyle(0xfdfaf0, 1)
    g.fillTriangle(x, y - 8, x + 2, y - 2, x - 2, y - 2)
    g.fillStyle(0x4a2810, 1)
    g.fillRect(x - 1, y - 2, 1, 6)
    g.fillStyle(0xc8b890, 0.6)
    g.fillRect(x - 1, y - 7, 1, 5)
  }
}

function drawVillager(
  g: Phaser.GameObjects.Graphics,
  cfg: typeof AGENTS[number],
  x: number, y: number,
  dir: "down" | "up" | "left" | "right",
  frame: 0 | 1 | 2 | 3, // walk cycle
  holding: boolean
) {
  g.clear()
  // ── Body (16x24 standing, plus 8x8 head)
  // Pixel grid: y=0 is feet, y=24 is top of head
  // Bob with frame for walk anim
  const bob = frame === 1 ? -1 : 0
  const legLift = (frame === 1 || frame === 3) ? 1 : 0
  // Coords
  const topY = y - 24 + bob
  // Body shadow under feet
  g.fillStyle(0x000000, 0.25)
  g.fillEllipse(x, y + 1, 12, 4)

  // Pants (legs)
  g.fillStyle(cfg.pants, 1)
  if (frame === 1) {
    g.fillRect(x - 4, topY + 16, 3, 7 - legLift)
    g.fillRect(x + 1, topY + 16, 3, 7)
  } else if (frame === 3) {
    g.fillRect(x - 4, topY + 16, 3, 7)
    g.fillRect(x + 1, topY + 16, 3, 7 - legLift)
  } else {
    g.fillRect(x - 4, topY + 16, 3, 7)
    g.fillRect(x + 1, topY + 16, 3, 7)
  }
  // Shoes
  g.fillStyle(0x2a1808, 1)
  g.fillRect(x - 5, topY + 22, 4, 2)
  g.fillRect(x + 1, topY + 22, 4, 2)

  // Torso (shirt)
  g.fillStyle(cfg.shirt, 1)
  g.fillRect(x - 5, topY + 8, 10, 9)
  // Belt
  g.fillStyle(0x2a1808, 1)
  g.fillRect(x - 5, topY + 15, 10, 1)

  // Arms (alternating with walk cycle)
  g.fillStyle(cfg.skin, 1)
  if (frame === 1) {
    g.fillRect(x - 6, topY + 9, 1, 5)  // back arm
    g.fillRect(x + 5, topY + 11, 1, 5) // forward arm
  } else if (frame === 3) {
    g.fillRect(x - 6, topY + 11, 1, 5)
    g.fillRect(x + 5, topY + 9, 1, 5)
  } else {
    g.fillRect(x - 6, topY + 9, 1, 5)
    g.fillRect(x + 5, topY + 9, 1, 5)
  }

  // Head (skin)
  g.fillStyle(cfg.skin, 1)
  g.fillRect(x - 4, topY, 8, 8)
  // Hair (top)
  g.fillStyle(cfg.hair, 1)
  g.fillRect(x - 4, topY, 8, 3)
  g.fillRect(x - 5, topY + 1, 1, 2)
  g.fillRect(x + 4, topY + 1, 1, 2)
  // Eyes (2 pixels) — direction-aware
  g.fillStyle(0x000000, 1)
  if (dir === "down") {
    g.fillRect(x - 2, topY + 4, 1, 1)
    g.fillRect(x + 1, topY + 4, 1, 1)
  } else if (dir === "up") {
    // back of head — no eyes
  } else if (dir === "left") {
    g.fillRect(x - 3, topY + 4, 1, 1)
  } else {
    g.fillRect(x + 2, topY + 4, 1, 1)
  }
  // Mouth (single pixel)
  g.fillStyle(0x4a2810, 1)
  g.fillRect(x, topY + 6, 1, 1)

  // Tool in hand (only when "holding") — drawn to the right of body for right-facing, mirrored
  if (holding) {
    const tx = dir === "left" ? x - 7 : x + 6
    const ty = topY + 11
    drawTool(g, cfg.tool, tx, ty)
  }
}

// ─── Workstation renderers (one per agent)
function drawStation(g: Phaser.GameObjects.Graphics, kind: "manager" | "forge" | "study", x: number, y: number) {
  g.clear()
  if (kind === "manager") {
    // Small manager hut with sign post + barrel
    // Hut
    g.fillStyle(0x6a3a18, 1) // dark wood
    g.fillRect(x - 12, y - 10, 24, 12)
    g.fillStyle(0x8a5a2a, 1) // light wood
    g.fillRect(x - 12, y - 10, 24, 2)
    // Roof (sloped)
    g.fillStyle(0xc44a2a, 1)
    g.fillTriangle(x - 16, y - 10, x + 16, y - 10, x, y - 22)
    g.fillStyle(0x8a2a14, 1)
    g.fillTriangle(x, y - 22, x + 16, y - 10, x + 8, y - 10)
    // Door
    g.fillStyle(0x2a1808, 1)
    g.fillRect(x - 3, y - 7, 6, 9)
    g.fillStyle(0xf3c8a4, 1) // door knob
    g.fillRect(x + 1, y - 3, 1, 1)
    // Sign post (chore board)
    g.fillStyle(0x6a3a18, 1)
    g.fillRect(x + 18, y - 12, 1, 14)
    g.fillStyle(0xdecb95, 1)
    g.fillRect(x + 17, y - 14, 14, 6)
    g.fillStyle(0x4a2810, 1)
    g.fillRect(x + 18, y - 13, 12, 1)
    g.fillRect(x + 18, y - 11, 12, 1)
    g.fillRect(x + 18, y - 9, 8, 1)
  } else if (kind === "forge") {
    // Stone forge + anvil + log pile
    // Forge base (stone)
    g.fillStyle(0x6a6058, 1)
    g.fillRect(x - 14, y - 14, 28, 16)
    g.fillStyle(0x4a4238, 1)
    g.fillRect(x - 14, y - 14, 28, 2)
    // Forge opening
    g.fillStyle(0x2a1810, 1)
    g.fillRect(x - 8, y - 5, 16, 7)
    // Glow
    g.fillStyle(0xff7a2a, 0.6)
    g.fillRect(x - 6, y - 3, 12, 4)
    g.fillStyle(0xffd040, 0.5)
    g.fillRect(x - 4, y - 2, 8, 2)
    // Chimney
    g.fillStyle(0x3a3028, 1)
    g.fillRect(x - 10, y - 24, 6, 10)
    g.fillStyle(0x5a4a3a, 1)
    g.fillRect(x - 11, y - 25, 8, 2)
    // Smoke (drawn via tween-able container would be nice, skip for now)
    // Anvil
    g.fillStyle(0x2a2a2a, 1)
    g.fillRect(x + 16, y - 6, 10, 4)
    g.fillStyle(0x4a4a4a, 1)
    g.fillRect(x + 16, y - 7, 10, 1)
    g.fillStyle(0x1a1a1a, 1)
    g.fillRect(x + 18, y - 2, 6, 4)
    // Log pile (left)
    g.fillStyle(0x6a3a18, 1)
    g.fillRect(x - 22, y - 5, 6, 7)
    g.fillStyle(0x8a5a2a, 1)
    g.fillRect(x - 22, y - 5, 6, 1)
    g.fillRect(x - 23, y + 0, 8, 3)
  } else {
    // Study desk + open book + candle
    // Desk
    g.fillStyle(0x6a3a18, 1)
    g.fillRect(x - 14, y - 6, 28, 8)
    g.fillStyle(0x4a2810, 1)
    g.fillRect(x - 14, y - 6, 28, 1)
    g.fillRect(x - 14, y + 1, 28, 1)
    // Desk legs
    g.fillRect(x - 13, y + 1, 2, 6)
    g.fillRect(x + 11, y + 1, 2, 6)
    // Open book
    g.fillStyle(0xfdfaf0, 1)
    g.fillRect(x - 8, y - 5, 16, 5)
    g.fillStyle(0x8a7a5a, 1)
    g.fillRect(x - 7, y - 4, 14, 1)
    g.fillRect(x - 7, y - 2, 12, 1)
    g.fillStyle(0x4a3a2a, 1)
    g.fillRect(x, y - 5, 1, 5)  // spine
    // Candle
    g.fillStyle(0xe8c8a4, 1)
    g.fillRect(x + 12, y - 11, 2, 6)
    g.fillStyle(0xfacc6a, 0.9)
    g.fillRect(x + 12, y - 13, 2, 2)
    g.fillStyle(0xfff0a0, 0.7)
    g.fillRect(x + 12, y - 12, 1, 1)
  }
}

// ─── Plot / crop / decor renderers
function drawPlot(g: Phaser.GameObjects.Graphics, x: number, y: number, growth: 0 | 1 | 2 | 3) {
  // Tilled soil: 3x3 brown pixels
  g.fillStyle(0x5a3a1a, 1)
  g.fillRect(x - 6, y - 2, 12, 4)
  g.fillStyle(0x4a2a10, 0.7)
  g.fillRect(x - 6, y + 1, 12, 1)
  g.fillStyle(0x6a4a2a, 0.6)
  g.fillRect(x - 5, y - 1, 1, 1)
  g.fillRect(x + 2, y, 1, 1)
  if (growth === 0) return // bare soil
  // Plant
  if (growth === 1) {
    g.fillStyle(0x6aad5a, 1)
    g.fillRect(x - 1, y - 3, 1, 2)
    g.fillRect(x,     y - 4, 1, 1)
  } else if (growth === 2) {
    g.fillStyle(0x5a9a4a, 1)
    g.fillRect(x - 1, y - 5, 1, 3)
    g.fillRect(x,     y - 6, 1, 2)
    g.fillRect(x - 2, y - 4, 1, 1)
  } else {
    g.fillStyle(0x4a8a3a, 1)
    g.fillRect(x - 1, y - 7, 1, 4)
    g.fillRect(x,     y - 8, 1, 3)
    g.fillRect(x - 2, y - 6, 1, 2)
    g.fillRect(x + 1, y - 5, 1, 2)
    g.fillStyle(0xff8a3a, 1)
    g.fillRect(x,     y - 9, 1, 1) // fruit
  }
}

function drawCoop(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.clear()
  // Coop house
  g.fillStyle(0xc44a2a, 1) // red barn
  g.fillRect(x - 10, y - 8, 20, 12)
  g.fillStyle(0x8a2a14, 1)
  g.fillTriangle(x - 12, y - 8, x + 12, y - 8, x, y - 16)
  g.fillStyle(0xfdfaf0, 1)
  g.fillRect(x - 3, y - 4, 6, 8) // door
  g.fillStyle(0x4a2810, 1)
  g.fillRect(x - 1, y - 1, 2, 5)
  // Window
  g.fillStyle(0x8eb8d4, 1)
  g.fillRect(x - 8, y - 5, 3, 3)
  g.fillStyle(0x4a2810, 1)
  g.fillRect(x - 7, y - 4, 1, 1)
  // Fence around coop
  g.fillStyle(0x6a3a18, 1)
  g.fillRect(x - 18, y + 4, 36, 1)
  for (let fx = x - 18; fx <= x + 18; fx += 6) {
    g.fillRect(fx, y + 2, 1, 4)
    g.fillRect(fx - 1, y + 2, 3, 1)
  }
}

function drawChicken(g: Phaser.GameObjects.Graphics, x: number, y: number, dir: "left" | "right") {
  g.clear()
  // Body
  g.fillStyle(0xfff5d0, 1)
  g.fillEllipse(x, y, 7, 4)
  g.fillStyle(0xdecf9a, 0.6)
  g.fillEllipse(x - 1, y, 4, 3)
  // Head
  g.fillStyle(0xfff5d0, 1)
  g.fillCircle(dir === "right" ? x + 3 : x - 3, y - 1, 2)
  // Comb + beak
  g.fillStyle(0xff3333, 1)
  g.fillRect(dir === "right" ? x + 3 : x - 4, y - 3, 1, 1)
  g.fillStyle(0xff9922, 1)
  if (dir === "right") g.fillRect(x + 4, y - 1, 2, 1)
  else                  g.fillRect(x - 6, y - 1, 2, 1)
  // Eye
  g.fillStyle(0x1a1a1a, 1)
  g.fillRect(dir === "right" ? x + 3 : x - 3, y - 1, 1, 1)
  // Tail
  g.fillStyle(0xeee8c0, 1)
  g.fillTriangle(dir === "right" ? x - 3 : x + 3, y - 1, dir === "right" ? x - 6 : x + 6, y - 2, dir === "right" ? x - 6 : x + 6, y + 1)
}

function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number, size: 1 | 2 = 1) {
  const r = size === 2 ? 12 : 8
  // Trunk
  g.fillStyle(0x6a3a18, 1)
  g.fillRect(x - 1, y, 3, 6)
  // Foliage
  g.fillStyle(0x4a7a3a, 1)
  g.fillCircle(x, y - 2, r)
  g.fillStyle(0x5a8a4a, 1)
  g.fillCircle(x - 2, y - 4, r * 0.6)
  g.fillStyle(0x6a9a5a, 0.7)
  g.fillCircle(x + 1, y - 5, r * 0.4)
}

function drawScarecrow(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.clear()
  // Post
  g.fillStyle(0x6a3a18, 1)
  g.fillRect(x - 1, y - 18, 2, 20)
  // Crossbar
  g.fillRect(x - 8, y - 14, 16, 2)
  // Head (pumpkin)
  g.fillStyle(0xff8a3a, 1)
  g.fillRect(x - 3, y - 22, 6, 5)
  g.fillStyle(0x4a2810, 1)
  g.fillRect(x - 2, y - 20, 1, 1)
  g.fillRect(x + 1, y - 20, 1, 1)
  g.fillRect(x,     y - 18, 1, 1)
  // Hat
  g.fillStyle(0x2a1808, 1)
  g.fillRect(x - 4, y - 23, 8, 2)
  g.fillRect(x - 2, y - 26, 4, 3)
  // Shirt (on crossbar)
  g.fillStyle(0xc44a2a, 1)
  g.fillRect(x - 5, y - 12, 10, 5)
  // Straw hands
  g.fillStyle(0xe8c860, 1)
  g.fillRect(x - 10, y - 13, 2, 1)
  g.fillRect(x + 8, y - 13, 2, 1)
}

function drawWell(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.clear()
  // Stone base
  g.fillStyle(0x6a6058, 1)
  g.fillRect(x - 8, y - 4, 16, 6)
  g.fillStyle(0x4a4238, 1)
  g.fillRect(x - 8, y + 1, 16, 1)
  // Water
  g.fillStyle(0x4a7a9a, 1)
  g.fillRect(x - 6, y - 1, 12, 3)
  g.fillStyle(0x7ab8d4, 0.6)
  g.fillRect(x - 5, y - 1, 10, 1)
  // Posts + roof
  g.fillStyle(0x6a3a18, 1)
  g.fillRect(x - 7, y - 12, 2, 9)
  g.fillRect(x + 5, y - 12, 2, 9)
  g.fillRect(x - 7, y - 13, 14, 2)
  g.fillStyle(0x8a2a14, 1)
  g.fillTriangle(x - 10, y - 13, x + 10, y - 13, x, y - 21)
}

function drawBush(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0x4a7a3a, 1)
  g.fillCircle(x, y, 4)
  g.fillStyle(0x5a8a4a, 1)
  g.fillCircle(x - 1, y - 1, 2)
  g.fillStyle(0x6a9a5a, 0.6)
  g.fillCircle(x + 1, y - 2, 1)
}

// (hex helpers intentionally omitted — Phaser Graphics takes 0xRRGGBB ints directly)

export interface PixelGuildProps {
  agents?: Record<string, ApiAgentState> | null
  taskDetails?: Record<string, AgentTaskDetails> | null
  height?: number
}

export default function PixelGuild({
  agents = null,
  taskDetails = null,
  height = 240,
}: PixelGuildProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef<{
    agents: Record<string, ApiAgentState> | null
    taskDetails: Record<string, AgentTaskDetails> | null
  }>({ agents: null, taskDetails: null })

  useEffect(() => {
    dataRef.current = { agents, taskDetails }
  }, [agents, taskDetails])

  useEffect(() => {
    let game: import("phaser").Game | null = null
    let destroyed = false

    ;(async () => {
      const Phaser = (await import("phaser")).default
      if (destroyed || !hostRef.current) return
      const host = hostRef.current

      type AgentLocal = {
        id: string
        cfg: typeof AGENTS[number]
        // Movement
        wx: number; wy: number
        tx: number; ty: number
        dir: "down" | "up" | "left" | "right"
        wait: number
        walkFrame: 0 | 1 | 2 | 3
        frameTick: number
        idleTime: number
        // Data
        isWorking: boolean
        prevWorking: boolean
        completedPrev: number
        inboxCount: number
        sessionActive: boolean
        health: "green" | "amber" | "red"
        // Render targets
        body: Phaser.GameObjects.Graphics
        tool: Phaser.GameObjects.Graphics
        glow: Phaser.GameObjects.Graphics
        nameTag: Phaser.GameObjects.Text
      }
      type ChickenLocal = {
        g: Phaser.GameObjects.Graphics
        wx: number; wy: number
        tx: number; ty: number
        dir: "left" | "right"
        wait: number
      }
      type HeartLocal = { g: Phaser.GameObjects.Graphics; alpha: number; vy: number }

      // Phase 1 (Lil Claw, 2026-06-15) adds these richer fields to AgentState.
      // We type them locally because the in-repo interface already declares them,
      // but we read defensively until Phase 1 ships to production.
      type RichAgentFields = {
        session_active?: boolean
        health?: "green" | "amber" | "red"
        completed_today?: number
        current_task?: string | null
      }

      class Scene extends Phaser.Scene {
        agents: AgentLocal[] = []
        chickens: ChickenLocal[] = []
        hearts: HeartLocal[] = []
        coopG!: Phaser.GameObjects.Graphics
        wellG!: Phaser.GameObjects.Graphics
        treeLeftG!: Phaser.GameObjects.Graphics
        treeRightG!: Phaser.GameObjects.Graphics
        scarecrowG!: Phaser.GameObjects.Graphics
        bushA!: Phaser.GameObjects.Graphics
        bushB!: Phaser.GameObjects.Graphics
        // Plot graphics
        plotLeftG!: Phaser.GameObjects.Graphics
        plotRightG!: Phaser.GameObjects.Graphics
        // Time-of-day overlay
        skyOverlay!: Phaser.GameObjects.Graphics
        // Stations
        stations: Phaser.GameObjects.Graphics[] = []
        // Seed packets on chore board
        seedGfx!: Phaser.GameObjects.Graphics

        create() {
          // ── Sky/background: warm cream with soft vertical gradient
          this.cameras.main.setBackgroundColor("#dfeac4")
          const bg = this.add.graphics().setDepth(-10)
          // Vertical gradient: warmer at top, grassier at bottom
          for (let y = 0; y < GROUND_Y; y++) {
            const t = y / GROUND_Y
            const r = Math.round(0xdf + (0xa4 - 0xdf) * t)
            const g = Math.round(0xea + (0xc8 - 0xea) * t)
            const b = Math.round(0xc4 + (0x8a - 0xc4) * t)
            const col = (r << 16) | (g << 8) | b
            bg.fillStyle(col, 1)
            bg.fillRect(0, y, BASE_W, 1)
          }
          // Soft sun in sky
          bg.fillStyle(0xfff0a0, 0.6)
          bg.fillCircle(740, 28, 18)
          bg.fillStyle(0xfff8c0, 0.5)
          bg.fillCircle(740, 28, 10)
          // Distant hills
          bg.fillStyle(0x8aaa6a, 0.5)
          bg.fillTriangle(0, GROUND_Y, 120, GROUND_Y - 22, 260, GROUND_Y)
          bg.fillTriangle(200, GROUND_Y, 380, GROUND_Y - 18, 520, GROUND_Y)
          bg.fillTriangle(480, GROUND_Y, 640, GROUND_Y - 24, 780, GROUND_Y)
          bg.fillTriangle(700, GROUND_Y, 880, GROUND_Y - 16, 900, GROUND_Y)

          // ── Ground: tilled on zones, grass in center
          const ground = this.add.graphics().setDepth(-8)
          // Grass strip
          ground.fillStyle(0x7aad5a, 1)
          ground.fillRect(0, GROUND_Y, BASE_W, BASE_H - GROUND_Y)
          // Grass texture (small darker tufts)
          for (let i = 0; i < 60; i++) {
            const x = (i * 17 + 11) % BASE_W
            const y = GROUND_Y + ((i * 7) % (BASE_H - GROUND_Y))
            ground.fillStyle(0x5a8a3a, 0.5)
            ground.fillRect(x, y, 1, 2)
            ground.fillRect(x + 1, y - 1, 1, 1)
          }
          // Center stone path
          for (let i = 0; i < 7; i++) {
            const py = GROUND_Y + 8 + i * 14
            ground.fillStyle(0xc4b890, 1)
            ground.fillRoundedRect(420 + (i % 2) * 4, py, 60, 8, 2)
            ground.fillStyle(0xa89870, 0.6)
            ground.fillRoundedRect(422 + (i % 2) * 4, py + 6, 56, 2, 1)
          }

          // ── Background decor: trees
          this.treeLeftG  = this.add.graphics().setDepth(0)
          this.treeRightG = this.add.graphics().setDepth(0)
          drawTree(this.treeLeftG,  260, GROUND_Y, 2)
          drawTree(this.treeRightG, 600, GROUND_Y, 1)

          // ── Chicken coop + chickens
          this.coopG = this.add.graphics().setDepth(1)
          drawCoop(this.coopG, 470, 110)
          this.chickens = []
          for (let i = 0; i < 3; i++) {
            const cg = this.add.graphics().setDepth(2)
            const cx = 460 + i * 10
            const cy = 138
            drawChicken(cg, cx, cy, i % 2 === 0 ? "right" : "left")
            this.chickens.push({
              g: cg, wx: cx, wy: cy,
              tx: 450 + Math.random() * 50,
              ty: 132 + Math.random() * 18,
              dir: i % 2 === 0 ? "right" : "left",
              wait: 20 + Math.random() * 80,
            })
          }

          // ── Well (center foreground)
          this.wellG = this.add.graphics().setDepth(1)
          drawWell(this.wellG, 360, 168)

          // ── Scarecrow (between left zone and coop)
          this.scarecrowG = this.add.graphics().setDepth(1)
          drawScarecrow(this.scarecrowG, 295, 168)

          // ── Tilled plots in zones (left zone = Lil Claw, right zone = Mason)
          this.plotLeftG  = this.add.graphics().setDepth(1)
          this.plotRightG = this.add.graphics().setDepth(1)
          // Lil Claw plots: 3 rows × 2 cols in zone
          const leftPlots: { x: number; y: number; growth: 0 | 1 | 2 | 3 }[] = []
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 3; c++) {
              const px = 50 + c * 32
              const py = 175 + r * 12
              const growth = ((r * 3 + c) % 4) as 0 | 1 | 2 | 3
              leftPlots.push({ x: px, y: py, growth })
            }
          }
          leftPlots.forEach(p => drawPlot(this.plotLeftG, p.x, p.y, p.growth))

          // Mason plots: flower garden
          const rightPlots: { x: number; y: number; growth: 0 | 1 | 2 | 3 }[] = []
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 3; c++) {
              const px = 700 + c * 28
              const py = 175 + r * 12
              const growth = ((r * 3 + c + 1) % 4) as 0 | 1 | 2 | 3
              rightPlots.push({ x: px, y: py, growth })
            }
          }
          rightPlots.forEach(p => drawPlot(this.plotRightG, p.x, p.y, p.growth))

          // ── Bushes (decor framing)
          this.bushA = this.add.graphics().setDepth(0)
          this.bushB = this.add.graphics().setDepth(0)
          drawBush(this.bushA, 18, 170)
          drawBush(this.bushB, 880, 172)

          // ── Seed packets on chore board (driven by inbox count)
          this.seedGfx = this.add.graphics().setDepth(2)

          // ── Workstations (one per agent)
          this.stations = []
          const stationKinds: ("manager" | "forge" | "study")[] = ["manager", "forge", "study"]
          AGENTS.forEach((a, i) => {
            const sg = this.add.graphics().setDepth(1)
            drawStation(sg, stationKinds[i], a.station.x, a.station.y)
            this.stations.push(sg)
          })

          // ── Agents
          AGENTS.forEach((a, i) => {
            const body  = this.add.graphics().setDepth(50 + i)
            const tool  = this.add.graphics().setDepth(50 + i)
            const glow  = this.add.graphics().setDepth(45 + i)
            drawVillager(body, a, a.home.x, a.home.y, "down", 0, false)
            const nameTag = this.add.text(a.home.x, a.home.y + 6, a.name, {
              fontFamily: "monospace", fontSize: "7px",
              color: "#f5edd6", stroke: "#1a0e00", strokeThickness: 2, resolution: 3,
            }).setOrigin(0.5, 0).setDepth(9999)
            this.agents.push({
              id: a.id, cfg: a,
              wx: a.home.x, wy: a.home.y,
              tx: a.home.x, ty: a.home.y,
              dir: "down", wait: 30 + i * 40,
              walkFrame: 0, frameTick: 0,
              idleTime: 0,
              isWorking: false, prevWorking: false,
              completedPrev: 0,
              inboxCount: 0, sessionActive: false, health: "green",
              body, tool, glow, nameTag,
            })
          })

          // ── Time-of-day overlay (drawn last so it tints everything)
          this.skyOverlay = this.add.graphics().setDepth(9000)
        }

        drawSeedPackets(inboxCount: number) {
          this.seedGfx.clear()
          if (inboxCount <= 0) return
          const max = Math.min(inboxCount, 6)
          // Anchor: chore board is at the right side of manager hut
          for (let i = 0; i < max; i++) {
            const x = 102 + (i % 3) * 4
            const y = 144 - Math.floor(i / 3) * 4
            // Mini seed packet: tan square with colored seed
            this.seedGfx.fillStyle(0xdecb95, 1)
            this.seedGfx.fillRect(x, y, 3, 3)
            const seedColors = [0xc44a2a, 0x5a8a3a, 0xe8a935, 0x9b87f0]
            this.seedGfx.fillStyle(seedColors[i % seedColors.length], 1)
            this.seedGfx.fillRect(x + 1, y + 1, 1, 1)
          }
        }

        spawnHeart(x: number, y: number) {
          if (this.hearts.length >= 8) return
          const g = this.add.graphics().setDepth(9997)
          g.fillStyle(0xff6b8a, 1)
          g.fillCircle(x - 1, y, 1.5)
          g.fillCircle(x + 1, y, 1.5)
          g.fillTriangle(x - 2, y + 1, x + 2, y + 1, x, y + 4)
          this.hearts.push({ g, alpha: 1, vy: -0.3 })
        }

        update() {
          const t = this.time.now
          const { agents: agentsData } = dataRef.current

          // ── Apply time-of-day tint based on local hour
          const hour = new Date().getHours()
          let tint = 0x000000, tintA = 0
          if (hour >= 6 && hour < 8)        { tint = 0xffc080; tintA = 0.06 }   // dawn
          else if (hour >= 8  && hour < 17) { tint = 0xfff8d0; tintA = 0.0  }   // day
          else if (hour >= 17 && hour < 20) { tint = 0xff9050; tintA = 0.08 }   // dusk
          else                              { tint = 0x2030a0; tintA = 0.18 }   // night
          this.skyOverlay.clear()
          if (tintA > 0) {
            this.skyOverlay.fillStyle(tint, tintA)
            this.skyOverlay.fillRect(0, 0, BASE_W, BASE_H)
          }

          // ── Update agents
          for (const ag of this.agents) {
            ag.prevWorking = ag.isWorking
            if (agentsData) {
              const ad = agentsData[ag.id] as (ApiAgentState & RichAgentFields) | undefined
              if (ad) {
                // Combine Phase-1 new field (session_active) with old (working_count) per spec
                ag.sessionActive = ad.session_active ?? false
                ag.isWorking = ag.sessionActive || (ad.working_count ?? 0) > 0
                ag.inboxCount = ad.inbox_count ?? 0
                ag.health = ad.health ?? "green"
                const completed = ad.completed_today ?? 0
                if (completed > ag.completedPrev) {
                  // New completion! ship an item
                  this.spawnHeart(ag.wx, ag.wy - 24)
                  this.spawnHeart(ag.wx + 6, ag.wy - 20)
                }
                ag.completedPrev = completed
              }
            }

            // Choose target: workstation when working, random zone point when idle
            if (ag.isWorking) {
              ag.tx = ag.cfg.station.x
              ag.ty = ag.cfg.station.y
            } else if (Math.abs(ag.tx - ag.wx) < 1 && Math.abs(ag.ty - ag.wy) < 1 && ag.wait <= 0) {
              const z = ag.cfg.zone
              ag.tx = z.x1 + 8 + Math.random() * (z.x2 - z.x1 - 16)
              ag.ty = z.y1 + 16 + Math.random() * (z.y2 - z.y1 - 24)
              const dx = ag.tx - ag.wx, dy = ag.ty - ag.wy
              ag.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")
              ag.wait = 80 + Math.random() * 100
            }

            // Movement
            const dx = ag.tx - ag.wx, dy = ag.ty - ag.wy, dist = Math.hypot(dx, dy)
            if (dist > 2) {
              ag.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")
              ag.wx += (dx / dist) * 0.35
              ag.wy += (dy / dist) * 0.35
              ag.frameTick++
              if (ag.frameTick > 6) {
                ag.walkFrame = ((ag.walkFrame + 1) % 4) as 0 | 1 | 2 | 3
                ag.frameTick = 0
              }
            } else {
              ag.walkFrame = 0
              ag.frameTick = 0
            }

            // Redraw
            drawVillager(ag.body, ag.cfg, ag.wx, ag.wy, ag.dir, ag.walkFrame, ag.isWorking)
            ag.body.setPosition(0, 0)
            ag.tool.setPosition(0, 0)
            ag.nameTag.setPosition(ag.wx, ag.wy + 8).setAlpha(ag.isWorking ? 1 : 0.7)

            // Glow ring
            ag.glow.clear()
            if (ag.isWorking) {
              const gA = 0.18 + Math.sin(t / 500) * 0.07
              ag.glow.fillStyle(ag.cfg.color, gA)
              ag.glow.fillCircle(0, 0, 22)
            } else if (ag.health === "red") {
              const gA = 0.20 + Math.sin(t / 350) * 0.08
              ag.glow.fillStyle(0xc45a3a, gA)
              ag.glow.fillCircle(0, 0, 22)
            } else if (ag.health === "amber") {
              const gA = 0.10 + Math.sin(t / 500) * 0.04
              ag.glow.fillStyle(0xe8a935, gA)
              ag.glow.fillCircle(0, 0, 20)
            }
            ag.glow.setPosition(ag.wx, ag.wy - 8)

            // Idle micro-anim: occasional heart for resting villager
            if (!ag.isWorking && ag.health === "green" && ag.idleTime > 0 && ag.idleTime % 240 === 0) {
              this.spawnHeart(ag.wx + (Math.random() - 0.5) * 12, ag.wy - 28)
            }

            // Decrement wait
            if (ag.wait > 0) ag.wait--
            if (dist < 1.5) ag.idleTime++

            // Tick idle timer
            if (!ag.isWorking && ag.wait > 0) ag.idleTime++
          }

          // Seed packets
          const totalInbox = this.agents.reduce((s, a) => s + a.inboxCount, 0)
          this.drawSeedPackets(totalInbox)

          // ── Chickens
          for (const ch of this.chickens) {
            if (ch.wait > 0) { ch.wait--; continue }
            const dx = ch.tx - ch.wx, dy = ch.ty - ch.wy, dist = Math.hypot(dx, dy)
            if (dist < 1.5) {
              ch.tx = 450 + Math.random() * 50
              ch.ty = 130 + Math.random() * 22
              ch.dir = ch.tx > ch.wx ? "right" : "left"
              ch.wait = 60 + Math.random() * 100
            } else {
              ch.wx += (dx / dist) * 0.18
              ch.wy += (dy / dist) * 0.18
            }
            drawChicken(ch.g, ch.wx, ch.wy, ch.dir)
            ch.g.setPosition(0, 0)
          }

          // ── Hearts float up + fade
          for (let i = this.hearts.length - 1; i >= 0; i--) {
            const h = this.hearts[i]
            h.g.y += h.vy
            h.alpha = Math.max(0, h.alpha - 0.008)
            h.g.setAlpha(h.alpha)
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
