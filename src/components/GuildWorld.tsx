"use client"

import { useEffect, useRef } from "react"
import type { AgentState, AgentTaskDetails } from "@/hooks/useDashboardApi"

// ── Palette ────────────────────────────────────────────────────────────────
const AGENT_COLOR: Record<string, string> = {
  "lil-claw": "#00ff88",
  goop: "#00d4ff",
  mason: "#a78bfa",
}
const AGENT_ORDER = ["lil-claw", "goop", "mason"] as const
const PRIORITY_COLOR: Record<string, string> = {
  high: "#ff4444",
  medium: "#f59e0b",
  low: "#6a9a6a",
}

// 8×12 pixel sprites (0=transparent 1=body 2=shadow 3=highlight). Reused from
// the agent cards so the world's characters match their stat sheets.
type Grid = number[][]
const SPRITES: Record<string, Grid> = {
  "lil-claw": [
    [0,1,0,0,0,0,1,0],[1,1,1,1,1,1,1,1],[1,2,1,1,1,1,2,1],[1,1,1,1,1,1,1,1],
    [1,1,0,1,1,0,1,1],[0,3,1,1,1,1,3,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],
    [0,1,3,1,1,3,1,0],[0,1,1,1,1,1,1,0],[0,0,1,0,0,1,0,0],[0,1,1,0,0,1,1,0],
  ],
  goop: [
    [0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,2,2,2,2,2,2,1],[1,1,1,1,1,1,1,1],
    [1,1,0,3,3,0,1,1],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[3,1,1,0,0,1,1,3],
    [0,1,1,1,1,1,1,0],[0,1,3,0,0,3,1,0],[0,0,1,1,1,1,0,0],[0,1,1,0,0,1,1,0],
  ],
  mason: [
    [1,1,1,1,1,1,1,1],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],
    [0,1,2,1,1,2,1,0],[0,1,1,3,3,1,1,0],[0,3,1,1,1,1,3,0],[0,0,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,1],[0,3,1,0,0,1,3,0],[0,1,1,1,1,1,1,0],[0,1,0,1,1,0,1,0],
  ],
}

// ── Entity types ─────────────────────────────────────────────────────────────
type AgentPhase = "idle" | "walking" | "fighting" | "returning" | "wounded" | "healing"

interface Agent {
  id: string
  color: string
  x: number; y: number
  homeX: number; homeY: number
  phase: AgentPhase
  face: 1 | -1
  target: Monster | null
  healTarget: Agent | null
  anim: number          // animation clock
  bob: number           // idle bob phase offset
}

interface Monster {
  id: string            // == task id (stable key)
  owner: string
  x: number; y: number
  hp: number; maxHp: number
  color: string
  wobble: number
  dying: number         // 0 = alive, >0 = death anim countdown
  engaged: boolean      // task.status === working → agent actively fights it
}

interface Projectile {
  fromId: string; toId: string
  t: number; speed: number
  color: string
}

interface FloatText { x: number; y: number; t: number; text: string; color: string }
interface Spark { x: number; y: number; vx: number; vy: number; t: number; color: string }

export interface GuildWorldProps {
  agents: Record<string, AgentState> | null
  taskDetails: Record<string, AgentTaskDetails> | null
}

const LOGICAL_W = 900
const LOGICAL_H = 360

export function GuildWorld({ agents, taskDetails }: GuildWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  const agentsRef = useRef<Agent[]>([])
  const monstersRef = useRef<Monster[]>([])
  const projectilesRef = useRef<Projectile[]>([])
  const floatsRef = useRef<FloatText[]>([])
  const sparksRef = useRef<Spark[]>([])
  const seenEventsRef = useRef<Set<string>>(new Set())

  // Latest data the render loop reads (kept in a ref so the RAF closure is stable)
  const dataRef = useRef<{ agents: Record<string, AgentState> | null; details: Record<string, AgentTaskDetails> | null }>({ agents: null, details: null })
  // Keep dataRef in sync with render state for the RAF loop
  useEffect(() => { dataRef.current = { agents, details: taskDetails } }, [agents, taskDetails])

  // Initialize agents at their camp stations once.
  useEffect(() => {
    const stations: Record<string, [number, number]> = {
      "lil-claw": [120, 95],
      goop: [70, 195],
      mason: [165, 270],
    }
    agentsRef.current = AGENT_ORDER.map((id, i) => {
      const [hx, hy] = stations[id]
      return {
        id, color: AGENT_COLOR[id], x: hx, y: hy, homeX: hx, homeY: hy,
        phase: "idle" as AgentPhase, face: 1 as 1 | -1, target: null, healTarget: null,
        anim: 0, bob: i * 0.8,
      }
    })
  }, [])

  // Poll real A2A handoff events → projectiles.
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/tasks/events?n=15")
        if (!res.ok) return
        const events: Array<{ id: string; from: string; to: string; priority: string }> = await res.json()
        for (const ev of events) {
          if (seenEventsRef.current.has(ev.id)) continue
          seenEventsRef.current.add(ev.id)
          if (ev.from === ev.to) continue
          if (!AGENT_COLOR[ev.from] || !AGENT_COLOR[ev.to]) continue
          projectilesRef.current.push({
            fromId: ev.from, toId: ev.to, t: 0,
            speed: 0.018 + Math.random() * 0.01,
            color: PRIORITY_COLOR[ev.priority?.toLowerCase()] ?? AGENT_COLOR[ev.from],
          })
        }
        if (seenEventsRef.current.size > 120) {
          seenEventsRef.current = new Set([...seenEventsRef.current].slice(-60))
        }
      } catch { /* degrade quietly */ }
    }
    fetchEvents()
    const id = setInterval(fetchEvents, 10_000)
    return () => clearInterval(id)
  }, [])

  // ── Sync monsters + agent duty from data (every 2s) ──────────────────────
  useEffect(() => {
    const sync = () => {
      const data = dataRef.current.agents
      const details = dataRef.current.details
      if (!data) return

      for (const id of AGENT_ORDER) {
        const st = data[id]
        if (!st) continue
        const inboxTasks = details?.[id]?.inbox ?? []
        const failed = inboxTasks.filter(t => t.status === "failed").length

        // Every live (non-failed, non-done) inbox task is a MONSTER, keyed by task
        // id so it persists. status=working → engaged (agent fights it); otherwise
        // it lurks in the field. Failed tasks become the WOUNDED state, not monsters.
        const liveTasks = inboxTasks.filter(t =>
          t.status !== "failed" && t.status !== "completed" && t.status !== "deadletter")
        const liveIds = new Set(liveTasks.map(t => t.id))

        for (const t of liveTasks) {
          const existing = monstersRef.current.find(m => m.id === t.id)
          const engaged = t.status === "working"
          if (!existing) {
            monstersRef.current.push({
              id: t.id, owner: id,
              x: 360 + Math.random() * 470,
              y: 50 + Math.random() * 260,
              hp: 100, maxHp: 100,
              color: PRIORITY_COLOR[t.priority?.toLowerCase()] ?? PRIORITY_COLOR.low,
              wobble: Math.random() * Math.PI * 2,
              dying: 0, engaged,
            })
          } else {
            existing.engaged = engaged
          }
        }
        // Tasks that left the inbox (completed) → their monster dies.
        for (const m of monstersRef.current) {
          if (m.owner === id && m.dying === 0 && !liveIds.has(m.id)) m.dying = 1
        }

        // Wounded state from failed tasks.
        const ag = agentsRef.current.find(a => a.id === id)
        if (ag) {
          if (failed > 0 && ag.phase !== "wounded" && ag.phase !== "healing") {
            ag.phase = "wounded"; ag.target = null
          } else if (failed === 0 && ag.phase === "wounded") {
            ag.phase = "idle"
          }
        }
      }
    }
    sync()
    const id = setInterval(sync, 2000)
    return () => clearInterval(id)
  }, [])

  // ── Render + simulation loop ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const findAgent = (id: string) => agentsRef.current.find(a => a.id === id)

    const step = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const sx = w / LOGICAL_W
      const sy = h / LOGICAL_H
      const tx = (x: number) => x * sx
      const ty = (y: number) => y * sy

      ctx.clearRect(0, 0, w, h)
      drawBackground(ctx, w, h, sx, sy)

      // ---- simulate agents ----
      for (const a of agentsRef.current) {
        a.anim += 0.05
        const myMonsters = monstersRef.current.filter(m => m.owner === a.id && m.dying === 0)

        if (a.phase === "wounded") {
          // call for help: the nearest IDLE ally rushes over to heal. If everyone
          // is busy, the wounded waits (mirrors a real unresolved failure until a
          // peer frees up or the task is retried).
          const alreadyHealing = agentsRef.current.some(o => o.healTarget === a)
          if (!alreadyHealing) {
            const idleAllies = agentsRef.current.filter(o => o.id !== a.id && o.phase === "idle")
            if (idleAllies.length > 0) {
              const healer = idleAllies.reduce((best, o) => dist(o, a) < dist(best, a) ? o : best)
              healer.phase = "healing"; healer.healTarget = a
            }
          }
        } else if (a.phase === "healing" && a.healTarget) {
          const tgt = a.healTarget
          moveToward(a, tgt.x + 26, tgt.y, 1.6)
          if (dist(a, { x: tgt.x + 26, y: tgt.y }) < 6) {
            a.anim += 0.1
            spawnHeal(sparksRef.current, tgt.x, tgt.y)
            const ah = a as Agent & { healClock?: number }
            ah.healClock = (ah.healClock ?? 0) + 1
            if ((ah.healClock ?? 0) > 90) {
              tgt.phase = "idle"
              floatsRef.current.push({ x: tgt.x, y: tgt.y - 30, t: 1, text: "REVIVED", color: "#00ff88" })
              a.phase = "returning"; a.healTarget = null
              ah.healClock = 0
            }
          }
        } else if (myMonsters.some(m => m.engaged)) {
          // Fight the ENGAGED monsters (tasks actively being worked). Lurking
          // (queued) monsters wobble in the field until their task goes active.
          const engaged = myMonsters.filter(m => m.engaged)
          if (!a.target || a.target.dying > 0 || !a.target.engaged || a.target.owner !== a.id) {
            a.target = engaged.reduce((best, m) =>
              !best || dist(a, m) < dist(a, best) ? m : best, null as Monster | null)
          }
          const m = a.target
          if (m) {
            a.face = m.x >= a.x ? 1 : -1
            if (dist(a, m) > 40) {
              a.phase = "walking"
              moveToward(a, m.x - 36 * a.face, m.y, 1.9)
            } else {
              a.phase = "fighting"
              if (Math.floor(a.anim * 10) % 4 === 0) {
                m.hp -= 0.9
                if (Math.random() < 0.3) spawnHit(sparksRef.current, m.x, m.y, m.color)
              }
              if (m.hp <= 0 && m.dying === 0) m.dying = 1
            }
          }
        } else {
          // no active combat → return to camp and idle (lurking monsters remain)
          if (dist(a, { x: a.homeX, y: a.homeY }) > 4) {
            a.phase = "returning"
            moveToward(a, a.homeX, a.homeY, 1.6)
          } else {
            a.phase = "idle"
            a.target = null
          }
        }
      }

      // ---- simulate monsters ----
      monstersRef.current = monstersRef.current.filter(m => {
        if (m.dying > 0) {
          m.dying += 1
          if (m.dying === 2) {
            for (let i = 0; i < 10; i++) {
              const ang = (i / 10) * Math.PI * 2
              sparksRef.current.push({ x: m.x, y: m.y, vx: Math.cos(ang) * 2, vy: Math.sin(ang) * 2, t: 1, color: m.color })
            }
            floatsRef.current.push({ x: m.x, y: m.y - 20, t: 1, text: "+1", color: "#f59e0b" })
          }
          return m.dying < 16
        }
        m.wobble += 0.06
        return true
      })

      // ---- draw battlefield monsters ----
      for (const m of monstersRef.current) {
        drawMonster(ctx, tx(m.x), ty(m.y), (sx + sy) / 2, m)
      }

      // ---- draw agents ----
      for (const a of agentsRef.current) {
        drawAgent(ctx, tx(a.x), ty(a.y), (sx + sy) / 2, a)
      }

      // ---- projectiles (A2A handoffs) ----
      projectilesRef.current = projectilesRef.current.filter(p => {
        const from = findAgent(p.fromId)
        const to = findAgent(p.toId)
        if (!from || !to) return false
        p.t += p.speed
        if (p.t >= 1) {
          spawnHit(sparksRef.current, to.x, to.y - 20, p.color)
          return false
        }
        const x = tx(from.x + (to.x - from.x) * p.t)
        const y = ty((from.y - 18) + ((to.y - 18) - (from.y - 18)) * p.t)
        const alpha = Math.sin(p.t * Math.PI)
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
        return true
      })

      // ---- sparks ----
      sparksRef.current = sparksRef.current.filter(s => {
        s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.t -= 0.04
        if (s.t <= 0) return false
        ctx.save()
        ctx.globalAlpha = Math.max(0, s.t)
        ctx.fillStyle = s.color
        ctx.fillRect(tx(s.x), ty(s.y), 2, 2)
        ctx.restore()
        return true
      })

      // ---- floating text ----
      floatsRef.current = floatsRef.current.filter(f => {
        f.y -= 0.5; f.t -= 0.012
        if (f.t <= 0) return false
        ctx.save()
        ctx.globalAlpha = Math.max(0, f.t)
        ctx.fillStyle = f.color
        ctx.font = "bold 11px 'Fira Code', monospace"
        ctx.textAlign = "center"
        ctx.fillText(f.text, tx(f.x), ty(f.y))
        ctx.restore()
        return true
      })

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <div className="relative w-full rounded border border-[var(--border)] overflow-hidden bg-[#070b07]"
         style={{ aspectRatio: "900 / 360" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ imageRendering: "pixelated" }} />
      <div className="absolute top-2 left-3 font-pixel text-[8px] text-[#00ff88]/70 pointer-events-none select-none">
        THE GUILD
      </div>
      <div className="absolute top-2 right-3 font-code text-[9px] text-[var(--muted-foreground)] pointer-events-none select-none">
        camp · battlefield
      </div>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function moveToward(a: Agent, x: number, y: number, sp: number) {
  const dx = x - a.x, dy = y - a.y
  const d = Math.hypot(dx, dy) || 1
  a.x += (dx / d) * Math.min(sp, d)
  a.y += (dy / d) * Math.min(sp, d)
  if (Math.abs(dx) > 1) a.face = dx >= 0 ? 1 : -1
}
function spawnHit(arr: Spark[], x: number, y: number, color: string) {
  for (let i = 0; i < 5; i++) {
    const ang = Math.random() * Math.PI * 2
    arr.push({ x, y, vx: Math.cos(ang) * 1.6, vy: Math.sin(ang) * 1.6 - 0.5, t: 0.8, color })
  }
}
function spawnHeal(arr: Spark[], x: number, y: number) {
  if (Math.random() < 0.4) {
    arr.push({ x: x + (Math.random() - 0.5) * 20, y: y + 6, vx: 0, vy: -1.2, t: 1, color: "#00ff88" })
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, sx: number, sy: number) {
  const divX = 270 * sx
  ctx.fillStyle = "#0c140c"
  ctx.fillRect(0, 0, divX, h)
  ctx.fillStyle = "#0a0f0a"
  ctx.fillRect(divX, 0, w - divX, h)
  ctx.strokeStyle = "rgba(0,255,136,0.04)"
  ctx.lineWidth = 1
  for (let gx = divX; gx < w; gx += 40 * sx) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke()
  }
  for (let gy = 0; gy < h; gy += 40 * sy) {
    ctx.beginPath(); ctx.moveTo(divX, gy); ctx.lineTo(w, gy); ctx.stroke()
  }
  ctx.strokeStyle = "rgba(0,255,136,0.12)"
  ctx.setLineDash([4 * sy, 4 * sy])
  ctx.beginPath(); ctx.moveTo(divX, 0); ctx.lineTo(divX, h); ctx.stroke()
  ctx.setLineDash([])
  const fx = 115 * sx, fy = 165 * sy
  const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 60 * sx)
  g.addColorStop(0, "rgba(245,158,11,0.25)")
  g.addColorStop(1, "rgba(245,158,11,0)")
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(fx, fy, 60 * sx, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#f59e0b"
  ctx.fillRect(fx - 3, fy - 3, 6, 6)
  ctx.fillStyle = "#ff4444"
  ctx.fillRect(fx - 1, fy - 6, 2, 4)
}

function drawSpriteGrid(ctx: CanvasRenderingContext2D, grid: Grid, cx: number, cy: number, px: number, color: string, face: 1 | -1, yOff: number, tint?: string) {
  const cols = grid[0].length, rows = grid.length
  const ox = cx - (cols * px) / 2
  const oy = cy - rows * px + yOff
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][face === 1 ? x : cols - 1 - x]
      if (cell === 0) continue
      ctx.fillStyle = tint ? tint : cell === 1 ? color : cell === 2 ? "#0a0a0a" : color + "cc"
      ctx.fillRect(ox + x * px, oy + y * px, px, px)
    }
  }
}

function drawAgent(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, a: Agent) {
  const px = Math.max(2, 3 * scale)
  let yOff = 0
  let lean = 0
  const wounded = a.phase === "wounded"
  if (a.phase === "idle") yOff = Math.sin(a.anim + a.bob) * 1.5
  if (a.phase === "walking" || a.phase === "returning") yOff = Math.abs(Math.sin(a.anim * 2)) * -2
  if (a.phase === "fighting") lean = Math.sin(a.anim * 6) * 4 * a.face
  if (wounded) yOff = 6

  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.fillStyle = "#000"
  ctx.beginPath(); ctx.ellipse(x, y + 2, 10 * scale, 3 * scale, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  if (a.phase === "fighting" || a.phase === "healing") {
    ctx.save(); ctx.shadowColor = a.color; ctx.shadowBlur = 10 * scale
  }
  const tint = wounded ? "#ff4444" : undefined
  drawSpriteGrid(ctx, SPRITES[a.id], x + lean, y, px, a.color, a.face, yOff, tint)
  if (a.phase === "fighting" || a.phase === "healing") ctx.restore()

  ctx.save()
  ctx.font = "7px 'Press Start 2P', monospace"
  ctx.textAlign = "center"
  ctx.fillStyle = wounded ? "#ff4444" : a.color
  ctx.fillText(a.id.toUpperCase(), x, y + 12 * scale)
  ctx.restore()

  if (wounded) {
    ctx.save()
    ctx.fillStyle = "#ff4444"
    const bx = x - 6, by = y - 44 * scale
    ctx.globalAlpha = 0.6 + Math.sin(a.anim * 4) * 0.4
    ctx.fillRect(bx + 4, by, 4, 12); ctx.fillRect(bx, by + 4, 12, 4)
    ctx.restore()
  }
}

function drawMonster(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, m: Monster) {
  const dyingScale = m.dying > 0 ? Math.max(0, 1 - m.dying / 16) : 1
  const s = (6 + 2 * scale) * dyingScale
  const bob = Math.sin(m.wobble) * 2
  // Lurking (queued) monsters are dimmer + slowly pulse; engaged ones are solid.
  const lurkAlpha = m.engaged ? 1 : 0.45 + Math.sin(m.wobble * 0.8) * 0.15
  ctx.save()
  ctx.globalAlpha = dyingScale * lurkAlpha
  ctx.fillStyle = m.color
  ctx.shadowColor = m.color
  ctx.shadowBlur = m.engaged ? 8 : 4
  ctx.fillRect(x - s, y - s + bob, s * 2, s * 2)
  ctx.shadowBlur = 0
  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(x - s * 0.5, y - s * 0.3 + bob, 2.5, 2.5)
  ctx.fillRect(x + s * 0.2, y - s * 0.3 + bob, 2.5, 2.5)
  ctx.restore()

  if (m.dying === 0 && m.hp < m.maxHp) {
    const bw = s * 2
    ctx.fillStyle = "#0d1a0d"
    ctx.fillRect(x - s, y - s - 6 + bob, bw, 3)
    ctx.fillStyle = m.hp > 40 ? "#00ff88" : "#ff4444"
    ctx.fillRect(x - s, y - s - 6 + bob, bw * (m.hp / m.maxHp), 3)
  }
}
