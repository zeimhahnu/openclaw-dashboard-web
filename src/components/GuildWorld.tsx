"use client"

import { useEffect, useRef } from "react"
import type { AgentState, AgentTaskDetails } from "@/hooks/useDashboardApi"

// ── Palette ──────────────────────────────────────────────────────────────────
const AGENT_COLOR: Record<string, string> = {
  "lil-claw": "#00ff88",
  goop:       "#00d4ff",
  mason:      "#a78bfa",
}
const AGENT_ORDER = ["lil-claw", "goop", "mason"] as const

// ── Monster taxonomy (RPG v2 spec) ───────────────────────────────────────────
//  chaos     = ops/stuck/backlog/anything else  dark-purple  jittery particle cluster
//  threat    = security/system failure          red-orange   spiky cross
//  knowledge = research/analysis gaps           pale-blue    ethereal circle
//  build     = implementation/code debt         orange-rust  heavy golem block
type MonsterClass = "chaos" | "threat" | "knowledge" | "build"
const MONSTER_COLOR: Record<MonsterClass, string> = {
  chaos:     "#7c3aed",
  threat:    "#f97316",
  knowledge: "#7dd3fc",
  build:     "#ea580c",
}
// Death spark colors (brighter, per C3 spec)
const DEATH_COLOR: Record<MonsterClass, string> = {
  chaos:     "#a855f7",
  threat:    "#f97316",
  knowledge: "#7dd3fc",
  build:     "#ea580c",
}

function classifyTask(taskType: string, desc?: string): MonsterClass {
  const s = ((taskType ?? "") + " " + (desc ?? "")).toLowerCase()
  if (/security|uptime|incident|breach|alert|threat/.test(s))             return "threat"
  if (/research|analysis|distillation|extraction|intel|investigate|market|knowledge/.test(s)) return "knowledge"
  if (/implement|build|feature|deploy|ship|code|develop|create|prototype/.test(s))            return "build"
  return "chaos"
}

// ── Monster lifecycle ─────────────────────────────────────────────────────────
//  lurking   = queued (dim, pulsing, waiting at field edge)
//  engaged   = working (bright, agent is fighting it)
//  retreating= task failed (monster retreats to the right edge — not the agent's fault)
//  dying     = task completed (death animation)
type MonsterPhase = "lurking" | "engaged" | "retreating" | "dying"

// ── Agent display state ───────────────────────────────────────────────────────
//  idle    = no tasks — breathing softly at camp
//  working = actively processing (engaged monster, bright glow)
//  heavy   = 3+ tasks queued (strained pulse, amber tint)
type AgentDisplayState = "idle" | "working" | "heavy"

// ── 8×12 pixel sprites ───────────────────────────────────────────────────────
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

// ── Entity types ──────────────────────────────────────────────────────────────
type AgentPhase = "idle" | "walking" | "fighting" | "returning" | "summoning"

interface Agent {
  id: string; color: string
  x: number; y: number; homeX: number; homeY: number
  phase: AgentPhase; displayState: AgentDisplayState
  face: 1 | -1; target: Monster | null
  anim: number; bob: number
  summonT: number   // 0→1 summon animation progress
  attackCd: number  // frames until next attack (cooldown)
}

interface Monster {
  id: string; owner: string
  x: number; y: number
  hp: number; maxHp: number
  cls: MonsterClass; priority: string
  wobble: number
  phase: MonsterPhase
  dyingT: number   // 0→1 dying progress
}

interface Projectile { fromId: string; toId: string; t: number; speed: number; color: string }
interface FloatText  { x: number; y: number; t: number; text: string; color: string }
interface Spark      { x: number; y: number; vx: number; vy: number; t: number; color: string }
interface SummonEffect { agentId: string; t: number; x: number; y: number; color: string }
interface AttackProjectile { x: number; y: number; tx: number; ty: number; t: number; fromId: string; toId: string; type: "fireball" | "slash" | "arrow"; color: string }

export interface GuildWorldProps {
  agents: Record<string, AgentState> | null
  taskDetails: Record<string, AgentTaskDetails> | null
}

const LOGICAL_W = 900
const LOGICAL_H = 360

export function GuildWorld({ agents, taskDetails }: GuildWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number | null>(null)

  const agentsRef      = useRef<Agent[]>([])
  const monstersRef    = useRef<Monster[]>([])
  const projectilesRef = useRef<Projectile[]>([])
  const attackProjRef  = useRef<AttackProjectile[]>([])
  const floatsRef      = useRef<FloatText[]>([])
  const sparksRef      = useRef<Spark[]>([])
  const summonEffectsRef = useRef<SummonEffect[]>([])
  const seenEventsRef  = useRef<Set<string>>(new Set())
  const prevWorkingRef = useRef<Record<string, number>>({})

  const dataRef = useRef<{ agents: typeof agents; details: typeof taskDetails }>({ agents: null, details: null })
  useEffect(() => { dataRef.current = { agents, details: taskDetails } }, [agents, taskDetails])

  // Gold = total tasks ever delivered (outbox totals)
  const goldTotal = taskDetails
    ? Object.values(taskDetails).reduce((s, td) => s + (td.outbox?.length ?? 0), 0)
    : 0

  // ── Init agents once ──────────────────────────────────────────────────────
  useEffect(() => {
    const stations: Record<string, [number, number]> = {
      "lil-claw": [120,  95],
      goop:       [ 70, 195],
      mason:      [165, 270],
    }
    agentsRef.current = AGENT_ORDER.map((id, i) => {
      const [hx, hy] = stations[id]
      return { id, color: AGENT_COLOR[id], x: hx, y: hy, homeX: hx, homeY: hy,
               phase: "idle", displayState: "idle", face: 1, target: null,
               anim: 0, bob: i * 0.8, summonT: 0, attackCd: 0 } as Agent
    })
  }, [])

  // ── A2A handoff events → projectiles ─────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/tasks/events?n=15")
        if (!res.ok) return
        const evs: Array<{ id: string; from: string; to: string; priority: string }> = await res.json()
        for (const ev of evs) {
          if (seenEventsRef.current.has(ev.id)) continue
          seenEventsRef.current.add(ev.id)
          if (ev.from === ev.to || !AGENT_COLOR[ev.from] || !AGENT_COLOR[ev.to]) continue
          projectilesRef.current.push({
            fromId: ev.from, toId: ev.to, t: 0,
            speed: 0.018 + Math.random() * 0.01,
            color: AGENT_COLOR[ev.from],
          })
        }
        if (seenEventsRef.current.size > 120)
          seenEventsRef.current = new Set([...seenEventsRef.current].slice(-60))
      } catch { /* degrade */ }
    }
    poll()
    const id = setInterval(poll, 10_000)
    return () => clearInterval(id)
  }, [])

  // ── Sync task data → monsters + agent display state (every 2s) ───────────
  useEffect(() => {
    const sync = () => {
      const data    = dataRef.current.agents
      const details = dataRef.current.details
      if (!data) return

      for (const id of AGENT_ORDER) {
        const st   = data[id]
        const ag   = agentsRef.current.find(a => a.id === id)
        if (!st || !ag) continue

        const inbox = details?.[id]?.inbox ?? []
        const live  = inbox.filter(t => t.status !== "completed" && t.status !== "deadletter")
        const liveIds = new Set(live.map(t => t.id))

        // Spawn/update monsters for every live task
        for (const t of live) {
          const m = monstersRef.current.find(m => m.id === t.id)
          const engaged = t.status === "working"
          const failed  = t.status === "failed"
          if (!m) {
            monstersRef.current.push({
              id: t.id, owner: id,
              x: 360 + Math.random() * 470,
              y:  50 + Math.random() * 260,
              hp: 100, maxHp: 100,
              cls: classifyTask(t.type ?? "", t.description),
              priority: t.priority?.toLowerCase() ?? "low",
              wobble: Math.random() * Math.PI * 2,
              phase: failed ? "retreating" : engaged ? "engaged" : "lurking",
              dyingT: 0,
            })
          } else {
            // Update phase from latest status
            if (failed && m.phase !== "retreating" && m.phase !== "dying") {
              m.phase = "retreating"
            } else if (engaged && m.phase === "lurking") {
              m.phase = "engaged"
            } else if (!engaged && !failed && m.phase === "engaged") {
              m.phase = "lurking"
            }
          }
        }

        // Tasks that left inbox → monster dies
        for (const m of monstersRef.current)
          if (m.owner === id && m.phase !== "dying" && !liveIds.has(m.id))
            m.phase = "dying"

        // Agent display state — derived from real data only
        const queueDepth = live.filter(t => t.status !== "failed").length
        ag.displayState = (st.working_count > 0) ? "working"
                        : (queueDepth >= 3)       ? "heavy"
                        : "idle"

        // Detect sessions_spawn: working_count just went 0→1
        const prev = prevWorkingRef.current[id] ?? 0
        if (prev === 0 && st.working_count > 0) {
          // Spawn detected — start summon animation
          ag.phase = "summoning"
          ag.summonT = 0
          summonEffectsRef.current.push({
            agentId: id, t: 0, x: ag.x, y: ag.y, color: ag.color,
          })
        }
        prevWorkingRef.current[id] = st.working_count
      }
    }
    sync()
    const id = setInterval(sync, 2000)
    return () => clearInterval(id)
  }, [])

  // ── Render + simulation loop ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = Math.round(canvas.clientWidth  * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const findAgent = (id: string) => agentsRef.current.find(a => a.id === id)

    const step = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      const sx = w / LOGICAL_W, sy = h / LOGICAL_H
      const tx = (x: number) => x * sx
      const ty = (y: number) => y * sy

      ctx.clearRect(0, 0, w, h)
      drawBackground(ctx, w, h, sx, sy, performance.now() / 1000)

      // ── simulate agents ────────────────────────────────────────────────
      for (const a of agentsRef.current) {
        a.anim += 0.05

        // ── summoning phase ───────────────────────────────────────────
        if (a.phase === "summoning") {
          a.summonT += 0.025
          if (a.summonT >= 1) {
            a.summonT = 0
            // Transition to fighting if there are engaged monsters, else idle
            const myEngaged = monstersRef.current.filter(
              m => m.owner === a.id && m.phase === "engaged")
            a.phase = myEngaged.length > 0 ? "fighting" : "idle"
          }
          continue  // skip normal movement/fight logic while summoning
        }

        const myEngaged = monstersRef.current.filter(
          m => m.owner === a.id && m.phase === "engaged")

        if (myEngaged.length > 0) {
          // Fight nearest engaged monster
          if (!a.target || a.target.phase !== "engaged" || a.target.owner !== a.id) {
            a.target = myEngaged.reduce((best, m) =>
              !best || dist(a, m) < dist(a, best) ? m : best, null as Monster | null)
          }
          const m = a.target
          if (m) {
            a.face = m.x >= a.x ? 1 : -1
            // Class-specific range thresholds (Track B)
            const RANGE = a.id === "lil-claw" ? 120 : a.id === "mason" ? 180 : 35
            if (dist(a, m) > RANGE) {
              a.phase = "walking"
              moveToward(a, m.x - RANGE * 0.9 * a.face, m.y, 2.2)
            } else {
              a.phase = "fighting"
              a.attackCd = Math.max(0, a.attackCd - 1)
              if (a.attackCd === 0) {
                const dmg = a.id === "lil-claw" ? 1.2 : a.id === "goop" ? 1.8 : 0.8
                const atype:
                  "fireball" | "slash" | "arrow" =
                  a.id === "lil-claw" ? "fireball" :
                  a.id === "goop"     ? "slash"    : "arrow"
                // Fire projectile
                attackProjRef.current.push({
                  x: a.x, y: a.y - 10,
                  tx: m.x, ty: m.y - 10, t: 0,
                  fromId: a.id, toId: m.id,
                  type: atype, color: a.color,
                })
                m.hp -= dmg
                floatsRef.current.push({
                  x: m.x, y: m.y - 24, t: 1,
                  text: dmg.toFixed(1), color: a.color,
                })
                // Cooldown: mage=24 frames (0.4s), warrior=15 (0.25s), archer=30 (0.5s)
                a.attackCd = a.id === "lil-claw" ? 24 : a.id === "goop" ? 15 : 30
                if (m.hp <= 0 && m.phase === "engaged") m.phase = "dying"
              }
            }
          }
        } else {
          // Return to camp
          if (dist(a, { x: a.homeX, y: a.homeY }) > 4) {
            a.phase = "returning"
            moveToward(a, a.homeX, a.homeY, 1.6)
          } else {
            a.phase = "idle"
            a.target = null
          }
        }
      }

      // ── simulate monsters ──────────────────────────────────────────────
      monstersRef.current = monstersRef.current.filter(m => {
        m.wobble += 0.06

        if (m.phase === "dying") {
          m.dyingT += 0.07
          if (m.dyingT >= 0.01 && m.dyingT < 0.08) {
            // Burst sparks on first dying frame — monster-type-specific colors (C3)
            for (let i = 0; i < 12; i++) {
              const ang = (i / 12) * Math.PI * 2
              sparksRef.current.push({ x: m.x, y: m.y,
                vx: Math.cos(ang) * 2.5, vy: Math.sin(ang) * 2.5, t: 1,
                color: DEATH_COLOR[m.cls] })
            }
            floatsRef.current.push({ x: m.x, y: m.y - 20, t: 1, text: "+1", color: "#f59e0b" })
          }
          return m.dyingT < 1
        }

        if (m.phase === "retreating") {
          // Failed task: monster retreats toward right edge
          m.x += 2.5
          m.hp = Math.max(0, m.hp - 0.3) // lose HP as they escape
          if (m.x > LOGICAL_W + 60) {
            floatsRef.current.push({ x: LOGICAL_W - 60, y: m.y - 20, t: 1,
              text: "ESCAPED", color: "#f97316" })
            return false
          }
        }

        return true
      })

      // ── draw monsters ──────────────────────────────────────────────────
      for (const m of monstersRef.current) {
        drawMonster(ctx, tx(m.x), ty(m.y), (sx + sy) / 2, m)
      }

      // ── draw summon effects ───────────────────────────────────────────
      summonEffectsRef.current = summonEffectsRef.current.filter(se => {
        se.t += 0.025
        if (se.t >= 1) return false
        const x = tx(se.x), y = ty(se.y)
        const t = se.t
        // Outer ritual circle — expands then fades
        const outerR = (20 + t * 40) * ((sx + sy) / 2)
        const outerAlpha = Math.sin(t * Math.PI) * 0.7
        ctx.save()
        ctx.globalAlpha = outerAlpha
        ctx.strokeStyle = se.color; ctx.lineWidth = 1.5
        ctx.shadowColor = se.color; ctx.shadowBlur = 12
        ctx.beginPath(); ctx.arc(x, y, outerR, 0, Math.PI * 2); ctx.stroke()

        // Inner rotating rune glyphs (6 runes)
        const innerAlpha = Math.sin(t * Math.PI) * 0.9
        ctx.globalAlpha = innerAlpha
        ctx.font = `${10 * ((sx + sy) / 2)}px serif`
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        const runes = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ"]
        const runeR = (12 + t * 20) * ((sx + sy) / 2)
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + t * Math.PI * 2
          ctx.fillStyle = se.color
          ctx.fillText(runes[i], x + Math.cos(angle) * runeR, y + Math.sin(angle) * runeR)
        }

        // Center glow burst
        const glowAlpha = Math.sin(t * Math.PI) * 0.5
        ctx.globalAlpha = glowAlpha
        const grad = ctx.createRadialGradient(x, y, 0, x, y, outerR * 0.6)
        grad.addColorStop(0, se.color)
        grad.addColorStop(1, "transparent")
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(x, y, outerR * 0.6, 0, Math.PI * 2); ctx.fill()

        ctx.restore()
        return true
      })

      // ── draw agents ────────────────────────────────────────────────────
      for (const a of agentsRef.current) {
        drawAgent(ctx, tx(a.x), ty(a.y), (sx + sy) / 2, a)
      }

      // ── projectiles (A2A handoffs) ─────────────────────────────────────
      projectilesRef.current = projectilesRef.current.filter(p => {
        const from = findAgent(p.fromId), to = findAgent(p.toId)
        if (!from || !to) return false
        p.t += p.speed
        if (p.t >= 1) { spawnHit(sparksRef.current, to.x, to.y - 20, p.color); return false }
        const x = tx(from.x + (to.x - from.x) * p.t)
        const y = ty((from.y - 18) + ((to.y - 18) - (from.y - 18)) * p.t)
        ctx.save()
        ctx.globalAlpha = Math.sin(p.t * Math.PI)
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
        return true
      })

      // ── attack projectiles (fireball / slash / arrow) ─────────────────
      attackProjRef.current = attackProjRef.current.filter(ap => {
        ap.t += 0.06
        if (ap.t >= 1) {
          // On hit — spawn sparks at target monster position
          spawnHit(sparksRef.current, ap.tx, ap.ty,
            ap.type === "fireball" ? "#f97316" :
            ap.type === "arrow"    ? "#00d4ff" : "#ffffff")
          return false
        }
        const x = tx(ap.x + (ap.tx - ap.x) * ap.t)
        const y = ty(ap.y + (ap.ty - ap.y) * ap.t)
        const progress = ap.t
        ctx.save()

        if (ap.type === "fireball") {
          // Orange/red expanding fireball with glow
          const r = (4 + progress * 8) * ((sx + sy) / 2)
          ctx.globalAlpha = 0.9
          const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
          grad.addColorStop(0,   "#fef08a")
          grad.addColorStop(0.4, "#f97316")
          grad.addColorStop(1,   "#7c2d12")
          ctx.fillStyle = grad
          ctx.shadowColor = "#f97316"; ctx.shadowBlur = 14
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        } else if (ap.type === "arrow") {
          // Thin cyan arrow line with dot head
          const dx = ap.tx - ap.x, dy = ap.ty - ap.y
          const angle = Math.atan2(dy, dx)
          const len = 16 * ((sx + sy) / 2)
          ctx.globalAlpha = 0.9
          ctx.strokeStyle = "#00d4ff"; ctx.lineWidth = 2
          ctx.shadowColor = "#00d4ff"; ctx.shadowBlur = 8
          ctx.beginPath()
          ctx.moveTo(x - Math.cos(angle) * len, y - Math.sin(angle) * len)
          ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
          ctx.stroke()
          // Arrowhead dot
          ctx.fillStyle = "#00d4ff"
          ctx.beginPath(); ctx.arc(x + Math.cos(angle) * len, y + Math.sin(angle) * len, 2.5, 0, Math.PI * 2); ctx.fill()
        } else {
          // slash — wide arc spark
          const dx = ap.tx - ap.x, dy = ap.ty - ap.y
          const angle = Math.atan2(dy, dx)
          ctx.globalAlpha = 0.85 - progress * 0.3
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5
          ctx.shadowColor = "#00d4ff"; ctx.shadowBlur = 10
          ctx.beginPath()
          ctx.arc(x, y, 14 * ((sx + sy) / 2),
            angle - Math.PI / 3, angle + Math.PI / 3)
          ctx.stroke()
        }
        ctx.restore()
        return true
      })

      // ── sparks ─────────────────────────────────────────────────────────
      sparksRef.current = sparksRef.current.filter(s => {
        s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.t -= 0.04
        if (s.t <= 0) return false
        ctx.save()
        ctx.globalAlpha = Math.max(0, s.t); ctx.fillStyle = s.color
        ctx.fillRect(tx(s.x), ty(s.y), 2, 2)
        ctx.restore()
        return true
      })

      // ── float text ─────────────────────────────────────────────────────
      floatsRef.current = floatsRef.current.filter(f => {
        f.y -= 0.5; f.t -= 0.012
        if (f.t <= 0) return false
        ctx.save()
        ctx.globalAlpha = Math.max(0, f.t); ctx.fillStyle = f.color
        ctx.font = "bold 11px 'Fira Code', monospace"; ctx.textAlign = "center"
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
         style={{ height: "360px" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
              style={{ imageRendering: "pixelated" }} />

      <div className="absolute top-2 left-3 flex flex-col gap-0.5 pointer-events-none select-none">
        <span className="font-pixel text-[7px] text-[#00ff88]/70">THE GUILD</span>
        <span className="font-code text-[6px] text-[#00ff88]/30">fortress of persistent memory</span>
      </div>

      <div className="absolute top-2 right-3 flex items-center gap-3 pointer-events-none select-none">
        {goldTotal > 0 && (
          <span className="font-pixel text-[7px] text-[#f59e0b]/80">GOLD: {goldTotal}</span>
        )}
        <span className="font-code text-[8px] text-[var(--muted-foreground)]/60">camp · battlefield</span>
      </div>

      {/* Monster type legend */}
      <div className="absolute bottom-2 left-3 flex items-center gap-3 pointer-events-none select-none">
        {([
          { cls: "chaos",     label: "chaos",     color: "#7c3aed" },
          { cls: "threat",    label: "threat",    color: "#f97316" },
          { cls: "knowledge", label: "knowledge", color: "#7dd3fc" },
          { cls: "build",     label: "build",     color: "#ea580c" },
        ] as const).map(({ cls, label, color }) => (
          <div key={cls} className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: color + "80" }} />
            <span className="font-code text-[6px]" style={{ color: color + "90" }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-2 right-3 font-code text-[6px] text-[#00ff88]/25 pointer-events-none select-none">
        failed = retreats · done = defeated
      </div>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────
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

// Stable star field positions (0–1 fractions of the battlefield rect)
const STARS: [number, number, number][] = [  // [rx, ry, seed]
  [0.06,0.08,0],[0.14,0.22,1],[0.23,0.06,2],[0.31,0.30,3],[0.40,0.14,4],
  [0.49,0.28,5],[0.55,0.07,6],[0.62,0.38,7],[0.70,0.18,8],[0.78,0.44,9],
  [0.85,0.10,10],[0.92,0.32,11],[0.18,0.50,12],[0.36,0.56,13],[0.52,0.62,14],
  [0.68,0.55,15],[0.83,0.68,16],[0.25,0.72,17],[0.60,0.78,18],[0.88,0.82,19],
  [0.10,0.88,20],[0.45,0.85,21],[0.75,0.90,22],[0.95,0.60,23],[0.03,0.42,24],
]

function drawPixelTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size
  ctx.fillStyle = "#0d2a0d"
  // Crown: 3 layers narrowing upward
  ctx.fillRect(cx - s * 1.2, cy - s * 2.2, s * 2.4, s * 0.7)
  ctx.fillRect(cx - s * 0.85, cy - s * 2.9, s * 1.7, s * 0.75)
  ctx.fillRect(cx - s * 0.5, cy - s * 3.5, s, s * 0.7)
  // Trunk
  ctx.fillStyle = "#1a0f05"
  ctx.fillRect(cx - s * 0.25, cy - s * 1.5, s * 0.5, s * 1.5)
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, sx: number, sy: number, time: number) {
  const divX = 270 * sx

  // Camp background — slightly warmer dark
  ctx.fillStyle = "#0b130b"; ctx.fillRect(0, 0, divX, h)
  // Battlefield — cold dark
  ctx.fillStyle = "#080d0d"; ctx.fillRect(divX, 0, w - divX, h)

  // Ground plane — subtle gradient at bottom third
  const ground = ctx.createLinearGradient(0, h * 0.65, 0, h)
  ground.addColorStop(0, "rgba(0,0,0,0)")
  ground.addColorStop(1, "rgba(0,8,0,0.6)")
  ctx.fillStyle = ground; ctx.fillRect(0, h * 0.65, w, h * 0.35)

  // Twinkling stars in battlefield sky
  ctx.save()
  for (const [rx, ry, seed] of STARS) {
    const stx = divX + rx * (w - divX)
    const sty = ry * h * 0.88
    const bri = 0.12 + Math.abs(Math.sin(time * (0.4 + seed * 0.07) + seed)) * 0.55
    ctx.globalAlpha = bri
    ctx.fillStyle = seed % 4 === 0 ? "#7dd3fc" : "#e8ffe8"
    ctx.fillRect(stx, sty, 1, 1)
    if (seed % 6 === 0) {  // cross-shaped bright star
      ctx.globalAlpha = bri * 0.5
      ctx.fillRect(stx - 1, sty, 3, 1)
      ctx.fillRect(stx, sty - 1, 1, 3)
    }
  }
  ctx.restore()

  // Grid lines on battlefield (faint)
  ctx.strokeStyle = "rgba(0,255,136,0.03)"; ctx.lineWidth = 1
  for (let gx = divX; gx < w; gx += 40 * sx) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke()
  }
  for (let gy = 0; gy < h; gy += 40 * sy) {
    ctx.beginPath(); ctx.moveTo(divX, gy); ctx.lineTo(w, gy); ctx.stroke()
  }

  // Fortress wall divider + battlements
  ctx.strokeStyle = "rgba(0,255,136,0.22)"; ctx.setLineDash([4 * sy, 4 * sy])
  ctx.beginPath(); ctx.moveTo(divX, 0); ctx.lineTo(divX, h); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = "rgba(0,255,136,0.08)"
  for (let gy = 0; gy < h; gy += 22 * sy) {
    ctx.fillRect(divX - 5, gy, 10, 9 * sy)
  }
  // Rune marks on the wall — small diamond symbols
  ctx.fillStyle = "rgba(0,255,136,0.18)"
  const runeY = [0.18, 0.48, 0.76]
  for (const ry of runeY) {
    const rx2 = divX, ry2 = h * ry
    const rs = 3
    ctx.beginPath()
    ctx.moveTo(rx2,      ry2 - rs * 2)
    ctx.lineTo(rx2 + rs, ry2)
    ctx.lineTo(rx2,      ry2 + rs * 2)
    ctx.lineTo(rx2 - rs, ry2)
    ctx.closePath(); ctx.fill()
  }

  // Pixel trees in camp area
  const treeScale = Math.max(3, 3.5 * sx)
  drawPixelTree(ctx,  28 * sx, h * 0.78, treeScale)
  drawPixelTree(ctx,  44 * sx, h * 0.55, treeScale * 0.8)
  drawPixelTree(ctx, 218 * sx, h * 0.30, treeScale * 0.75)
  drawPixelTree(ctx, 235 * sx, h * 0.72, treeScale * 0.9)

  // ── C2: Static Decorations ────────────────────────────────────────────────

  // Campfire glow near lil-claw camp
  const fx = 115 * sx, fy = 165 * sy
  const fireFlicker = 0.9 + Math.sin(time * 7) * 0.08 + Math.sin(time * 11.3) * 0.05
  const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 60 * sx * fireFlicker)
  g.addColorStop(0, "rgba(245,158,11,0.30)"); g.addColorStop(1, "rgba(245,158,11,0)")
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 60 * sx * fireFlicker, 0, Math.PI * 2); ctx.fill()
  // Fire embers drifting up
  ctx.save()
  for (let e = 0; e < 3; e++) {
    const phase = (time * 1.4 + e * 2.1) % 3
    const ex = fx + Math.sin(time * 2 + e * 2.4) * 5 * sx
    const ey = fy - phase * 18 * sy
    ctx.globalAlpha = Math.max(0, 1 - phase / 3) * 0.7
    ctx.fillStyle = e % 2 === 0 ? "#f59e0b" : "#ff4444"
    ctx.fillRect(ex - 1, ey - 1, 2, 2)
  }
  ctx.restore()
  ctx.fillStyle = "#f59e0b"; ctx.fillRect(fx - 3, fy - 2, 6, 5)
  ctx.fillStyle = "#ff4444"; ctx.fillRect(fx - 1, fy - 6, 2, 5)

  // ── C2: Campfire near goop's camp (x≈70, y≈210) ────────────────────────────
  const goopFireX = 70 * sx, goopFireY = 210 * sy
  const goopFlicker = 0.85 + Math.sin(time * 6.5) * 0.1 + Math.sin(time * 9.7) * 0.05
  const gg = ctx.createRadialGradient(goopFireX, goopFireY, 2, goopFireX, goopFireY, 40 * sx * goopFlicker)
  gg.addColorStop(0, "rgba(245,158,11,0.28)"); gg.addColorStop(1, "rgba(245,158,11,0)")
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(goopFireX, goopFireY, 40 * sx * goopFlicker, 0, Math.PI * 2); ctx.fill()
  // Flickering orange/yellow dots
  ctx.save()
  for (let e = 0; e < 4; e++) {
    const phase = (time * 1.2 + e * 1.8) % 2.5
    const ex2 = goopFireX + Math.sin(time * 2.5 + e * 2.1) * 4 * sx
    const ey2 = goopFireY - phase * 14 * sy
    ctx.globalAlpha = Math.max(0, 1 - phase / 2.5) * 0.65
    ctx.fillStyle = e % 2 === 0 ? "#f59e0b" : "#fbbf24"
    ctx.fillRect(ex2 - 1, ey2 - 1, 2, 2)
  }
  ctx.restore()
  // Campfire logs
  ctx.fillStyle = "#92400e"; ctx.fillRect(goopFireX - 4, goopFireY - 1, 8, 4)
  ctx.fillStyle = "#f59e0b"; ctx.fillRect(goopFireX - 2, goopFireY - 4, 4, 4)

  // ── C2: Stone monument near center / Crossroads (x≈450, y≈180) ──────────────
  const monumentX = 450 * sx, monumentY = 180 * sy
  // Base
  ctx.fillStyle = "#374151"
  ctx.fillRect(monumentX - 6 * sx, monumentY - 8 * sy, 12 * sx, 16 * sy)
  // Top cap
  ctx.fillStyle = "#4b5563"
  ctx.fillRect(monumentX - 7 * sx, monumentY - 10 * sy, 14 * sx, 4 * sy)
  // Rune glyphs on monument
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.font = `${Math.max(5, Math.floor(6 * Math.min(sx, sy)))}px serif`
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillStyle = "#9ca3af"
  ctx.fillText("✦", monumentX, monumentY + 2 * sy)
  ctx.restore()

  // ── C2: 3 small trees/rocks scattered around ─────────────────────────────────
  // Tree near battlefield (x≈300, y≈100)
  drawPixelTree(ctx, 300 * sx, 100 * sy, treeScale * 0.7)
  // Tree near chaos front edge (x≈780, y≈280)
  drawPixelTree(ctx, 780 * sx, 280 * sy, treeScale * 0.65)
  // Rock near lil-claw territory (x≈200, y≈160)
  ctx.fillStyle = "#374151"
  ctx.fillRect(198 * sx, 157 * sy, 8 * sx, 5 * sy)
  ctx.fillStyle = "#4b5563"
  ctx.fillRect(200 * sx, 154 * sy, 5 * sx, 4 * sy)

  // ── C2: Day/Night tint ───────────────────────────────────────────────────────
  const hour = new Date().getUTCHours()
  if (hour >= 22 || hour < 6) {
    ctx.fillStyle = "rgba(0,0,20,0.2)"
    ctx.fillRect(0, 0, w, h)
  }

  // Zone labels
  ctx.save()
  ctx.font = `${Math.max(7, Math.floor(6 * Math.min(sx, sy)))}px 'Fira Code', monospace`
  ctx.fillStyle = "rgba(0,255,136,0.14)"; ctx.textAlign = "left"
  ctx.fillText("GUILD CAMP",  12 * sx, 20 * sy)
  ctx.fillStyle = "rgba(255,68,68,0.14)"; ctx.textAlign = "right"
  ctx.fillText("CHAOS FRONT", w - 12 * sx, 20 * sy)

  // ── C1: Named Map Regions ───────────────────────────────────────────────────
  const labelSize = Math.max(5, Math.floor(6 * Math.min(sx, sy)))
  ctx.font = `${labelSize}px 'Fira Code', monospace`
  ctx.textAlign = "center"

  // The Observatory (lil-claw) — x≈120, y≈95 — cyan glow
  ctx.save()
  ctx.shadowColor = "#00d4ff"; ctx.shadowBlur = 8
  ctx.fillStyle = "rgba(0,212,255,0.55)"
  ctx.fillText("The Observatory", 120 * sx, 75 * sy)
  ctx.restore()

  // The Forge (goop) — x≈70, y≈195 — blue glow
  ctx.save()
  ctx.shadowColor = "#00d4ff"; ctx.shadowBlur = 8
  ctx.fillStyle = "rgba(0,212,255,0.50)"
  ctx.fillText("The Forge", 70 * sx, 175 * sy)
  ctx.restore()

  // The Study (mason) — x≈165, y≈270 — purple glow
  ctx.save()
  ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 8
  ctx.fillStyle = "rgba(167,139,250,0.50)"
  ctx.fillText("The Study", 165 * sx, 250 * sy)
  ctx.restore()

  // The Crossroads (center) — x≈450, y≈180 — neutral amber glow
  ctx.save()
  ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 8
  ctx.fillStyle = "rgba(245,158,11,0.45)"
  ctx.fillText("The Crossroads", 450 * sx, 162 * sy)
  ctx.restore()

  ctx.restore()
}

function drawSpriteGrid(
  ctx: CanvasRenderingContext2D, grid: Grid,
  cx: number, cy: number, px: number,
  color: string, face: 1 | -1, yOff: number,
) {
  const cols = grid[0].length, rows = grid.length
  const ox = cx - (cols * px) / 2, oy = cy - rows * px + yOff
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][face === 1 ? x : cols - 1 - x]
      if (cell === 0) continue
      ctx.fillStyle = cell === 1 ? color : cell === 2 ? "#0a0a0a" : color + "cc"
      ctx.fillRect(ox + x * px, oy + y * px, px, px)
    }
  }
}

function drawAgent(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, a: Agent) {
  const px = Math.max(2, 3 * scale)
  let yOff = 0, lean = 0

  if (a.phase === "idle")                             yOff = Math.sin(a.anim + a.bob) * 1.5
  if (a.phase === "walking" || a.phase === "returning") yOff = Math.abs(Math.sin(a.anim * 2)) * -2
  if (a.phase === "fighting")                         lean = Math.sin(a.anim * 6) * 4 * a.face

  // Shadow
  ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#000"
  ctx.beginPath(); ctx.ellipse(x, y + 2, 10 * scale, 3 * scale, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Glow by display state
  if (a.displayState === "working") {
    ctx.save(); ctx.shadowColor = a.color; ctx.shadowBlur = 12 * scale
    drawSpriteGrid(ctx, SPRITES[a.id], x + lean, y, px, a.color, a.face, yOff)
    ctx.restore()
  } else if (a.displayState === "heavy") {
    ctx.save(); ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 8 * scale
    drawSpriteGrid(ctx, SPRITES[a.id], x + lean, y, px, a.color, a.face, yOff)
    ctx.restore()
  } else {
    // idle — dim, soft
    ctx.save(); ctx.globalAlpha = 0.75
    drawSpriteGrid(ctx, SPRITES[a.id], x + lean, y, px, a.color, a.face, yOff)
    ctx.restore()
  }

  // Summoning glow ring — expands outward from agent
  if (a.phase === "summoning") {
    const t = a.summonT
    const ringR = (1 - t) * 28 * scale
    ctx.save()
    ctx.globalAlpha = t * 0.6
    ctx.strokeStyle = a.color; ctx.lineWidth = 2
    ctx.shadowColor = a.color; ctx.shadowBlur = 16 * scale
    ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = t * 0.3
    ctx.fillStyle = a.color
    ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // Name label
  ctx.save()
  ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "center"
  const labelColor = a.displayState === "heavy" ? "#f59e0b" : a.color
  ctx.fillStyle = a.displayState === "idle" ? labelColor + "80" : labelColor
  ctx.fillText(a.id.toUpperCase(), x, y + 12 * scale)
  ctx.restore()

  // Heavy load indicator
  if (a.displayState === "heavy") {
    ctx.save()
    ctx.globalAlpha = 0.5 + Math.sin(a.anim * 3) * 0.4
    ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center"
    ctx.fillStyle = "#f59e0b"
    ctx.fillText("!", x, y - 44 * scale)
    ctx.restore()
  }
}

function drawMonster(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, m: Monster) {
  const priMult   = m.priority === "high" ? 1.35 : m.priority === "low" ? 0.72 : 1.0
  const dyingMult = m.phase === "dying"       ? Math.max(0, 1 - m.dyingT) : 1
  const retreatAlpha = m.phase === "retreating"
    ? Math.max(0.2, 1 - m.x / (LOGICAL_W + 60))  // fade as it escapes
    : 1
  const s   = (5 + 2.5 * scale) * priMult * dyingMult
  const bob = Math.sin(m.wobble) * 2
  const lurkAlpha = m.phase === "lurking" ? 0.42 + Math.sin(m.wobble * 0.8) * 0.12 : retreatAlpha
  const color = MONSTER_COLOR[m.cls]

  ctx.save()
  ctx.globalAlpha = dyingMult * lurkAlpha
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = m.phase === "engaged" ? 8 : 3

  switch (m.cls) {
    case "chaos": {
      // Jittery particle cluster — 5 small squares orbiting center
      const jitter = m.phase === "retreating" ? 0 : 1
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + m.wobble * (0.8 + jitter * 0.5)
        const r = s * 0.65 + Math.sin(m.wobble * 2 + i) * s * 0.2
        const jx = jitter * (Math.sin(m.wobble * 4 + i * 1.3) * s * 0.15)
        ctx.fillRect(
          x + Math.cos(angle) * r - s * 0.25 + jx,
          y + Math.sin(angle) * r - s * 0.25 + bob,
          s * 0.5, s * 0.5
        )
      }
      // Void at center
      ctx.globalAlpha = 0
      ctx.fillRect(x - s * 0.15, y - s * 0.15 + bob, s * 0.3, s * 0.3)
      break
    }
    case "threat": {
      // Spiky cross (2 rects at 45° + 0°)
      const w2 = s * 0.35, h2 = s * 1.5
      ctx.fillRect(x - w2, y - h2 / 2 + bob, w2 * 2, h2)  // vertical
      ctx.fillRect(x - h2 / 2, y - w2 + bob, h2, w2 * 2)  // horizontal
      // Corner spikes
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + Math.PI / 4
        ctx.fillRect(
          x + Math.cos(ang) * s * 0.9 - s * 0.15,
          y + Math.sin(ang) * s * 0.9 + bob - s * 0.15,
          s * 0.3, s * 0.3
        )
      }
      break
    }
    case "knowledge": {
      // Ethereal circle — pulsing outer ring + solid center
      const pulsR = s * (1.0 + Math.sin(m.wobble * 1.2) * 0.15)
      ctx.globalAlpha = dyingMult * lurkAlpha * 0.3
      ctx.beginPath(); ctx.arc(x, y + bob, pulsR * 1.4, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = dyingMult * lurkAlpha * 0.7
      ctx.beginPath(); ctx.arc(x, y + bob, pulsR, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = dyingMult * lurkAlpha
      ctx.beginPath(); ctx.arc(x, y + bob, pulsR * 0.5, 0, Math.PI * 2); ctx.fill()
      break
    }
    case "build": {
      // Heavy golem block with shoulder plates
      ctx.fillRect(x - s * 0.9, y - s * 1.1 + bob, s * 1.8, s * 2.2)
      ctx.fillRect(x - s * 1.45, y - s * 0.6 + bob, s * 0.55, s * 0.9)
      ctx.fillRect(x + s * 0.9,  y - s * 0.6 + bob, s * 0.55, s * 0.9)
      break
    }
  }

  // Eyes (all types)
  ctx.globalAlpha = dyingMult * Math.max(lurkAlpha, 0.6)
  ctx.shadowBlur = 0; ctx.fillStyle = "#0a0a0a"
  const es = Math.max(2, s * 0.28)
  if (m.cls !== "knowledge") {  // knowledge has no eyes (ethereal)
    ctx.fillRect(x - s * 0.44, y - s * 0.22 + bob, es, es)
    ctx.fillRect(x + s * 0.16, y - s * 0.22 + bob, es, es)
  }
  ctx.restore()

  // HP bar (only while alive and damaged)
  if (m.phase !== "dying" && m.hp < m.maxHp) {
    ctx.save(); ctx.globalAlpha = lurkAlpha
    const bw = s * 2.2
    ctx.fillStyle = "#0d1a0d"
    ctx.fillRect(x - s * 1.1, y - s * 1.4 + bob, bw, 3)
    ctx.fillStyle = m.hp > 40 ? "#00ff88" : "#ff4444"
    ctx.fillRect(x - s * 1.1, y - s * 1.4 + bob, bw * (m.hp / m.maxHp), 3)
    ctx.restore()
  }
}
