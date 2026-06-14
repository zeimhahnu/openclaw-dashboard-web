"use client"
import { useEffect, useRef } from "react"
import type { AgentState as ApiAgentState, AgentTaskDetails } from "@/hooks/useDashboardApi"

const BASE_W = 900, BASE_H = 200, TILE = 16
const HOUSE_BOTTOM = 76
const FENCE_Y = 79
const CHAR_SCALE = 1.25

const AGENTS = [
  {
    id: "lil-claw", name: "Lil Claw", color: "#3fbf7f", colorHex: 0x3fbf7f,
    emblem: "crown" as const,
    zone: { x1: 30, y1: 90, x2: 270, y2: 188 },
    sx: 150, sy: 138,
    workSpot: { x: 150, y: 162 },
  },
  {
    id: "goop", name: "Goop", color: "#36a8e0", colorHex: 0x36a8e0,
    emblem: "hammer" as const,
    zone: { x1: 325, y1: 90, x2: 575, y2: 188 },
    sx: 450, sy: 134,
    workSpot: { x: 450, y: 160 },
  },
  {
    id: "mason", name: "Mason", color: "#8d6cf0", colorHex: 0x8d6cf0,
    emblem: "quill" as const,
    zone: { x1: 630, y1: 90, x2: 870, y2: 188 },
    sx: 750, sy: 138,
    workSpot: { x: 750, y: 162 },
  },
]

const EMBLEM_OFFSET = {
  crown:  { dx:  0, dy: -34 },
  hammer: { dx: 13, dy: -22 },
  quill:  { dx: 11, dy: -24 },
} as const

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
        id: string; colorHex: number
        spr: Phaser.GameObjects.Sprite
        tag: Phaser.GameObjects.Text
        badge: Phaser.GameObjects.Text
        shadow: Phaser.GameObjects.Ellipse
        emblem: Phaser.GameObjects.Graphics
        emblemOffset: { dx: number; dy: number }
        zone: { x1: number; y1: number; x2: number; y2: number }
        workSpot: { x: number; y: number }
        wx: number; wy: number; tx: number; ty: number
        dir: string; wait: number; bobPhase: number; idleTime: number
        isWorking: boolean; queueDepth: number; prevWorking: boolean
        glowGfx: Phaser.GameObjects.Graphics
        taskMarker: Phaser.GameObjects.Graphics
        lastAnim: string
      }
      type ChickenState = {
        con: Phaser.GameObjects.Container
        shadow: Phaser.GameObjects.Ellipse
        wx: number; wy: number; tx: number; ty: number
        dir: string; wait: number
      }
      type HeartState = { gfx: Phaser.GameObjects.Graphics; alpha: number }

      class Scene extends Phaser.Scene {
        agents: AgentLocal[] = []
        chickens: ChickenState[] = []
        hearts: HeartState[] = []

        preload() {
          AGENTS.forEach(a =>
            this.load.spritesheet(a.id, `/game/char-${a.id}.png`, { frameWidth: 48, frameHeight: 48 })
          )
          this.load.spritesheet("plants", "/game/plants.png",  { frameWidth: 16, frameHeight: 16 })
          this.load.spritesheet("props",  "/game/props.png",   { frameWidth: 16, frameHeight: 16 })
          this.load.image("house", "/game/house.png")
        }

        create() {
          this.cameras.main.setBackgroundColor("#7da848")

          // Checker ground
          const gnd = this.add.graphics().setDepth(0)
          for (let y = 0; y <= BASE_H / TILE; y++)
            for (let x = 0; x <= BASE_W / TILE; x++)
              if ((x + y) % 2 === 0) {
                gnd.fillStyle(0xffffff, 0.03)
                gnd.fillRect(x * TILE, y * TILE, TILE, TILE)
              }

          // House (centered, scale 0.85 → 95×68 px)
          this.add.image(BASE_W / 2, 8, "house")
            .setOrigin(0.5, 0).setScale(0.85).setDepth(HOUSE_BOTTOM)

          // Fence
          const fenceG = this.add.graphics().setDepth(FENCE_Y + 1)
          fenceG.fillStyle(0xaa7040, 0.9)
          fenceG.fillRect(40, FENCE_Y - 3, BASE_W - 80, 2)
          fenceG.fillRect(40, FENCE_Y + 2, BASE_W - 80, 2)
          fenceG.fillStyle(0x8b5e38, 1)
          for (let fx = 50; fx < BASE_W - 45; fx += 45) {
            fenceG.fillRect(fx - 2, FENCE_Y - 8, 3, 14)
            fenceG.fillRect(fx - 2, FENCE_Y - 11, 3, 3)
          }

          // Stone path down centre
          const pathG = this.add.graphics().setDepth(FENCE_Y)
          pathG.fillStyle(0xbfaa7a, 0.55)
          for (let i = 0; i < 9; i++) {
            const sx = BASE_W / 2 + (Math.random() - 0.5) * 25
            const sy = FENCE_Y + 10 + i * 16
            pathG.fillRoundedRect(sx - 10, sy - 5, 20, 10, 3)
            pathG.fillStyle(0xaa9060, 0.3)
            pathG.fillRoundedRect(sx - 9, sy - 4, 18, 8, 3)
            pathG.fillStyle(0xbfaa7a, 0.55)
          }

          // Zone tints
          const zoneG = this.add.graphics().setDepth(1)
          zoneG.fillStyle(0x3fbf7f, 0.07); zoneG.fillRect(30,  FENCE_Y, 245, BASE_H - FENCE_Y)
          zoneG.fillStyle(0x36a8e0, 0.07); zoneG.fillRect(325, FENCE_Y, 252, BASE_H - FENCE_Y)
          zoneG.fillStyle(0x8d6cf0, 0.07); zoneG.fillRect(628, FENCE_Y, 245, BASE_H - FENCE_Y)

          // Flowers
          const flowerFrames = [0, 1, 2, 3, 4, 5]
          const place = (key: string, frame: number, x: number, y: number) =>
            this.add.image(x, y, key, frame).setOrigin(0.5, 1).setDepth(y)
          for (let i = 0; i < 32; i++) {
            const x = 14 + Math.random() * (BASE_W - 28)
            const y = FENCE_Y + 8 + Math.random() * (BASE_H - FENCE_Y - 18)
            place("plants", flowerFrames[i % flowerFrames.length], x, y)
          }

          // Props — scaled from original 360×160 coords (×2.5, ×1.25)
          // lil-claw zone
          place("props",  1, 138, 125); place("props",  7, 213, 163)
          place("props", 12, 100, 175); place("props",  0, 250, 148)
          // goop zone
          place("props", 18, 413, 120); place("props", 24, 500, 163)
          place("props",  6, 388, 163); place("props",  1, 525, 123)
          // mason zone
          place("props",  0, 663, 125); place("props",  6, 775, 153)
          place("props",  7, 713, 175); place("props", 12, 825, 125)

          // Anims
          const dirs = ["down", "up", "left", "right"]
          AGENTS.forEach(a => dirs.forEach((d, r) => {
            this.anims.create({
              key: `${a.id}-walk-${d}`,
              frames: this.anims.generateFrameNumbers(a.id, { start: r * 4, end: r * 4 + 3 }),
              frameRate: 8, repeat: -1,
            })
            this.anims.create({
              key: `${a.id}-idle-${d}`,
              frames: [{ key: a.id, frame: r * 4 }],
              frameRate: 1,
            })
          }))

          // Agents
          AGENTS.forEach((a, i) => {
            const shadow = this.add.ellipse(a.sx, a.sy + 3, 28, 9, 0x000000, 0.38).setDepth(a.sy - 1)
            const spr = this.add.sprite(a.sx, a.sy, a.id, 0)
              .setOrigin(0.5, 0.875).setScale(CHAR_SCALE)
            spr.play(`${a.id}-idle-down`)
            const emblem = this.makeEmblem(a.emblem)
            const tag = this.add.text(a.sx, a.sy + 10, a.name, {
              fontFamily: "monospace", fontSize: "8px",
              color: "#f5edd6", stroke: "#1a0e00", strokeThickness: 2, resolution: 3,
            }).setOrigin(0.5, 0).setDepth(9999)
            const badge = this.add.text(a.sx + 18, a.sy - 40, "", {
              fontFamily: "monospace", fontSize: "8px",
              color: a.color, stroke: "#0a0a0a", strokeThickness: 2, resolution: 3,
            }).setOrigin(0, 0.5).setDepth(9999)
            const glowGfx  = this.add.graphics()
            const taskMarker = this.add.graphics()
            this.agents.push({
              id: a.id, colorHex: a.colorHex,
              spr, tag, badge, shadow, emblem,
              emblemOffset: EMBLEM_OFFSET[a.emblem],
              zone: a.zone, workSpot: a.workSpot,
              wx: a.sx, wy: a.sy, tx: a.sx, ty: a.sy,
              dir: "down", wait: 30 + i * 50, bobPhase: i * 2.1, idleTime: 0,
              isWorking: false, queueDepth: 0, prevWorking: false,
              glowGfx, taskMarker, lastAnim: `${a.id}-idle-down`,
            })
          })

          // Chickens — in Goop's zone (centre of farm)
          const chickenStarts = [{ x: 390, y: 140 }, { x: 510, y: 155 }]
          for (const cs of chickenStarts) {
            const con = this.makeChicken()
            con.setPosition(cs.x, cs.y).setDepth(cs.y)
            const cshadow = this.add.ellipse(cs.x, cs.y + 3, 14, 5, 0x000000, 0.2).setDepth(cs.y - 1)
            this.chickens.push({
              con, shadow: cshadow, wx: cs.x, wy: cs.y,
              tx: 350 + Math.random() * 200,
              ty: FENCE_Y + 10 + Math.random() * (BASE_H - FENCE_Y - 30),
              dir: "right", wait: 20 + Math.random() * 80,
            })
          }
        }

        makeEmblem(type: string): Phaser.GameObjects.Graphics {
          const g = this.add.graphics()
          if (type === "crown") {
            g.fillStyle(0xffd700, 1)
            g.fillRect(-5, 0, 10, 3)
            g.fillRect(-5, -5, 3, 5); g.fillRect(-1, -8, 3, 8); g.fillRect(3, -5, 3, 5)
            g.fillStyle(0xffeeaa, 0.55); g.fillRect(-4, 0, 6, 1)
          } else if (type === "hammer") {
            g.fillStyle(0xa0642a, 1); g.fillRect(-1, 2, 3, 10)
            g.fillStyle(0x888888, 1); g.fillRect(-6, -4, 11, 6)
            g.fillStyle(0xcccccc, 0.6); g.fillRect(-5, -4, 3, 1)
          } else {
            g.fillStyle(0xe8df70, 1); g.fillTriangle(0, -11, -4, 3, 4, 3)
            g.fillStyle(0xfffff0, 0.55); g.fillTriangle(0, -10, -1, 3, 1, 3)
            g.fillStyle(0x3a2810, 1); g.fillRect(-1, 3, 3, 5)
          }
          return g
        }

        makeChicken(): Phaser.GameObjects.Container {
          const g = this.add.graphics()
          g.fillStyle(0xfff5d0, 1); g.fillEllipse(0, 0, 11, 7)
          g.fillStyle(0xdecf9a, 0.6); g.fillEllipse(-1, 0, 6, 4)
          g.fillStyle(0xfff5d0, 1); g.fillCircle(6, -2, 3)
          g.fillStyle(0xff3333, 1); g.fillRect(5, -6, 2, 4)
          g.fillStyle(0x1a1a1a, 1); g.fillRect(7, -3, 1, 1)
          g.fillStyle(0xff9922, 1); g.fillRect(9, -2, 3, 1)
          g.fillStyle(0xeee8c0, 1); g.fillTriangle(-4, -1, -9, -5, -9, 2)
          return this.add.container(0, 0, [g])
        }

        spawnHeart(x: number, y: number) {
          if (this.hearts.length >= 8) return
          const h = this.add.graphics().setDepth(9997)
          h.fillStyle(0xff6b8a, 1)
          h.fillCircle(-2, 0, 2); h.fillCircle(2, 0, 2)
          h.fillTriangle(-4, 1, 4, 1, 0, 6)
          h.setPosition(x + (Math.random() - 0.5) * 12, y)
          this.hearts.push({ gfx: h, alpha: 1 })
        }

        spawnSparks(x: number, y: number, colorHex: number) {
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2
            const h = this.add.graphics().setDepth(9997)
            h.fillStyle(colorHex, 1)
            h.fillCircle(0, 0, 1.5)
            h.setPosition(x, y)
            this.tweens.add({
              targets: h,
              x: x + Math.cos(ang) * 22,
              y: y + Math.sin(ang) * 22,
              alpha: 0,
              duration: 700,
              ease: "Quad.easeOut",
              onComplete: () => h.destroy(),
            })
          }
        }

        playAnim(ag: AgentLocal, key: string) {
          if (ag.lastAnim !== key) {
            ag.spr.play(key)
            ag.lastAnim = key
          }
        }

        update() {
          const t = this.time.now
          const { agents: agentsData } = dataRef.current

          for (const ag of this.agents) {
            // Sync live data
            ag.prevWorking = ag.isWorking
            if (agentsData) {
              const ad = agentsData[ag.id]
              ag.isWorking  = (ad?.working_count ?? 0) > 0
              ag.queueDepth = ad?.inbox_count ?? 0
            }

            // Task completed → celebration
            if (ag.prevWorking && !ag.isWorking) {
              this.spawnHeart(ag.workSpot.x,     ag.workSpot.y - 20)
              this.spawnHeart(ag.workSpot.x + 8, ag.workSpot.y - 15)
              this.spawnSparks(ag.workSpot.x, ag.workSpot.y - 10, ag.colorHex)
              // Resume wander from workSpot
              ag.wx = ag.workSpot.x; ag.wy = ag.workSpot.y
              const z = ag.zone
              ag.tx = z.x1 + Math.random() * (z.x2 - z.x1)
              ag.ty = z.y1 + Math.random() * (z.y2 - z.y1)
              const ndx = ag.tx - ag.wx, ndy = ag.ty - ag.wy
              ag.dir = Math.abs(ndx) > Math.abs(ndy) ? (ndx > 0 ? "right" : "left") : (ndy > 0 ? "down" : "up")
              ag.wait = 60 + Math.random() * 90
              this.playAnim(ag, `${ag.id}-idle-down`)
            }

            // Movement
            if (ag.isWorking) {
              const dx = ag.workSpot.x - ag.wx, dy = ag.workSpot.y - ag.wy
              const dist = Math.hypot(dx, dy)
              if (dist > 4) {
                const dir = Math.abs(dx) > Math.abs(dy)
                  ? (dx > 0 ? "right" : "left")
                  : (dy > 0 ? "down" : "up")
                ag.dir = dir
                this.playAnim(ag, `${ag.id}-walk-${dir}`)
                ag.wx += (dx / dist) * 0.32
                ag.wy += (dy / dist) * 0.32
              } else {
                this.playAnim(ag, `${ag.id}-idle-down`)
              }
            } else {
              if (ag.wait > 0) {
                ag.wait--; ag.idleTime++
                if (ag.wait === 0) this.playAnim(ag, `${ag.id}-walk-${ag.dir}`)
                if (ag.idleTime > 60 && ag.idleTime % 300 === 0)
                  this.spawnHeart(ag.wx, ag.wy - 28)
              } else {
                ag.idleTime = 0
                const dx = ag.tx - ag.wx, dy = ag.ty - ag.wy, dist = Math.hypot(dx, dy)
                if (dist < 2) {
                  ag.wx = ag.tx; ag.wy = ag.ty
                  this.playAnim(ag, `${ag.id}-idle-${ag.dir}`)
                  const z = ag.zone
                  ag.tx = z.x1 + Math.random() * (z.x2 - z.x1)
                  ag.ty = z.y1 + Math.random() * (z.y2 - z.y1)
                  const ndx = ag.tx - ag.wx, ndy = ag.ty - ag.wy
                  ag.dir = Math.abs(ndx) > Math.abs(ndy) ? (ndx > 0 ? "right" : "left") : (ndy > 0 ? "down" : "up")
                  ag.wait = 90 + Math.random() * 140
                } else {
                  ag.wx += (dx / dist) * 0.24
                  ag.wy += (dy / dist) * 0.24
                }
              }
            }

            const bobY = ag.wait > 0 ? Math.sin(t / 380 + ag.bobPhase) * 0.6 : 0
            ag.spr.setPosition(Math.round(ag.wx), Math.round(ag.wy + bobY)).setDepth(ag.wy)
            ag.spr.setAlpha(ag.isWorking ? 1.0 : ag.queueDepth >= 3 ? 0.9 : 0.75)
            if (ag.queueDepth >= 3 && !ag.isWorking) ag.spr.setTint(0xffcc44)
            else ag.spr.clearTint()

            ag.shadow.setPosition(ag.wx, ag.wy + 3).setDepth(ag.wy - 1)
            ag.tag.setPosition(Math.round(ag.wx), Math.round(ag.wy + 10)).setAlpha(ag.isWorking ? 1 : 0.65)
            const off = ag.emblemOffset
            ag.emblem.setPosition(Math.round(ag.wx + off.dx), Math.round(ag.wy + off.dy)).setDepth(ag.wy + 1)

            // Queue badge
            if (ag.queueDepth > 0) {
              ag.badge.setText(`×${ag.queueDepth}`)
              ag.badge.setPosition(Math.round(ag.wx + 18), Math.round(ag.wy - 40)).setAlpha(1)
            } else {
              ag.badge.setAlpha(0)
            }

            // Glow ring on agent
            ag.glowGfx.clear()
            if (ag.isWorking) {
              const gA = 0.18 + Math.sin(t / 500 + ag.bobPhase) * 0.07
              ag.glowGfx.fillStyle(ag.colorHex, gA)
              ag.glowGfx.fillCircle(0, 0, 24)
            } else if (ag.queueDepth >= 3) {
              const gA = 0.10 + Math.sin(t / 700 + ag.bobPhase) * 0.04
              ag.glowGfx.fillStyle(0xffcc44, gA)
              ag.glowGfx.fillCircle(0, 0, 20)
            }
            ag.glowGfx.setPosition(ag.wx, ag.wy).setDepth(ag.wy - 0.5)

            // Task scroll marker at workSpot
            ag.taskMarker.clear()
            if (ag.isWorking) {
              const pulse = 0.13 + Math.sin(t / 600) * 0.06
              ag.taskMarker.fillStyle(ag.colorHex, pulse)
              ag.taskMarker.fillCircle(0, 0, 28)
              ag.taskMarker.fillStyle(0x7a5510, 1)
              ag.taskMarker.fillRoundedRect(-8, -12, 16, 24, 3)
              ag.taskMarker.fillStyle(0xfdeea8, 1)
              ag.taskMarker.fillRoundedRect(-7, -11, 14, 22, 2)
              ag.taskMarker.fillStyle(0x8b6030, 0.8)
              ag.taskMarker.fillRect(-5, -7, 10, 1); ag.taskMarker.fillRect(-5, -4, 10, 1)
              ag.taskMarker.fillRect(-5, -1, 10, 1); ag.taskMarker.fillRect(-5,  2, 7, 1)
              ag.taskMarker.setPosition(ag.workSpot.x, ag.workSpot.y - 12).setDepth(ag.workSpot.y - 1)
            } else if (ag.queueDepth > 0) {
              ag.taskMarker.fillStyle(0xdcc887, 0.22)
              ag.taskMarker.fillRoundedRect(-6, -9, 12, 18, 2)
              ag.taskMarker.setPosition(ag.workSpot.x, ag.workSpot.y - 10).setDepth(ag.workSpot.y - 1)
            }
          }

          // Chickens
          for (const ch of this.chickens) {
            if (ch.wait > 0) { ch.wait--; continue }
            const dx = ch.tx - ch.wx, dy = ch.ty - ch.wy, dist = Math.hypot(dx, dy)
            if (dist < 2) {
              ch.wx = ch.tx; ch.wy = ch.ty
              ch.tx = 350 + Math.random() * 200
              ch.ty = FENCE_Y + 10 + Math.random() * (BASE_H - FENCE_Y - 30)
              ch.dir = ch.tx > ch.wx ? "right" : "left"
              ch.wait = 80 + Math.random() * 180
            } else {
              ch.wx += (dx / dist) * 0.14; ch.wy += (dy / dist) * 0.14
            }
            ch.con.setPosition(Math.round(ch.wx), Math.round(ch.wy))
              .setScale(ch.dir === "left" ? -1 : 1, 1).setDepth(ch.wy)
            ch.shadow.setPosition(ch.wx, ch.wy + 3).setDepth(ch.wy - 1)
          }

          // Hearts
          for (let i = this.hearts.length - 1; i >= 0; i--) {
            const h = this.hearts[i]
            h.gfx.y -= 0.28
            h.alpha = Math.max(0, h.alpha - 0.007)
            h.gfx.setAlpha(h.alpha)
            if (h.alpha <= 0) { h.gfx.destroy(); this.hearts.splice(i, 1) }
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
