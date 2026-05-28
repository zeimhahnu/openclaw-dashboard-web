/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import { useEffect, useState, useCallback } from "react"
import { AgentSprite, PixelCard, StaminaBar, GoldCounter, QuestLog, A2AParticles } from "./components"

const API_BASE = "https://dashboard.vpszeimhahnu.uk"
const AGENTS = [
  { id: "lil-claw" as const, name: "Lil Claw", color: "#a78bfa", bgColor: "#2d1f5e" },
  { id: "goop" as const, name: "Goop", color: "#00d4ff", bgColor: "#0e2d3a" },
  { id: "mason" as const, name: "Mason", color: "#00ff88", bgColor: "#0e2d1a" },
]

const SPRITE_STYLES: Record<string, React.CSSProperties> = {
  "lil-claw": { background: "linear-gradient(135deg, #2d1f5e 0%, #4c1d95 100%)", boxShadow: "0 0 0 2px #1e0f3a, inset 0 -4px 0 rgba(0,0,0,0.3)" },
  goop: { background: "linear-gradient(135deg, #0e2d3a 0%, #0e4a5e 100%)", boxShadow: "0 0 0 2px #062029, inset 0 -4px 0 rgba(0,0,0,0.3)" },
  mason: { background: "linear-gradient(135deg, #0e2d1a 0%, #14532d 100%)", boxShadow: "0 0 0 2px #0a1f10, inset 0 -4px 0 rgba(0,0,0,0.3)" },
}

function AgentCard({ agent, staminaPct, gold, activeTask, isWorking }: {
  agent: typeof AGENTS[number]
  staminaPct: number
  gold: number
  activeTask: string | null
  isWorking: boolean
}) {
  return (
    <div className="pixel-card p-4 bg-[var(--card)] border border-[var(--border)]">
      {/* Sprite */}
      <div className="flex justify-center mb-3">
        <div
          className={`relative ${isWorking ? "sprite-working" : "sprite-idle"}`}
          style={{ width: 64, height: 64, borderRadius: 4, ...SPRITE_STYLES[agent.id] }}
        >
          <AgentSprite agentId={agent.id} color={agent.color} />
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-sm flex items-center justify-center text-[8px]"
            style={{
              background: isWorking ? "var(--pixel-grass)" : "var(--pixel-border)",
              border: "1px solid var(--pixel-border)",
              color: isWorking ? "#0a0a0a" : "#8a8060",
            }}
          >
            {isWorking ? "●" : "○"}
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] mb-3 truncate" style={{ color: agent.color, fontFamily: "'Press Start 2P', monospace" }}>
        {agent.name}
      </p>

      <div className="mb-2">
        <p className="text-[7px] mb-1 text-[var(--muted-foreground)]" style={{ fontFamily: "'Press Start 2P', monospace" }}>STA</p>
        <StaminaBar value={staminaPct} color={agent.color} />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[7px] text-[var(--muted-foreground)]" style={{ fontFamily: "'Press Start 2P', monospace" }}>GOLD</span>
        <GoldCounter amount={gold} />
      </div>

      {activeTask && (
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          <p className="text-[7px] text-[var(--muted-foreground)] truncate" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            → {activeTask}
          </p>
        </div>
      )}
    </div>
  )
}

interface State {
  ts: string
  agents: Record<string, { inbox_count: number; working_count: number; outbox_count: number }>
  router: { decisions_count: number; total_cost_usd: number; model_breakdown: Record<string, number> }
  wal_tails: Record<string, string[]>
}

export default function PixelDashboard() {
  const [state, setState] = useState<State | null>(null)
  const [particles, setParticles] = useState<Array<{ id: number; from: string; to: string }>>([])

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/state`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setState(data)
    } catch {
      // silently keep previous state on error
    }
  }, [])

  useEffect(() => {
    fetchState()
    const id = setInterval(fetchState, 7000)
    return () => clearInterval(id)
  }, [fetchState])

  // Simulate A2A particles
  useEffect(() => {
    if (!state) return
    const interval = setInterval(() => {
      const agentKeys = Object.keys(state.agents || {})
      if (agentKeys.length >= 2 && Math.random() > 0.7) {
        const from = agentKeys[Math.floor(Math.random() * agentKeys.length)]
        const to = agentKeys[Math.floor(Math.random() * agentKeys.length)]
        if (from !== to) {
          setParticles(p => [...p.slice(-5), { id: Date.now(), from, to }])
        }
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [state])

  const removeParticle = (id: number) => setParticles(p => p.filter(x => x.id !== id))

  return (
    <div className="min-h-screen bg-[var(--pixel-bg)] relative overflow-hidden">
      <div className="fixed inset-0 scanline pointer-events-none z-50" />
      <div
        className="fixed inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
        }}
      />

      <A2AParticles particles={particles} onComplete={removeParticle} />

      {/* Header */}
      <header className="relative z-10 border-b-4 border-[var(--pixel-wood)] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-6 bg-[var(--pixel-wood)]" style={{ clipPath: "polygon(0 100%, 50% 0, 100% 100%)" }} />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-4 bg-[var(--pixel-wood-light)]" />
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-3 bg-[var(--pixel-bg)]" />
            </div>
            <div>
              <h1 className="text-[14px] text-[var(--pixel-gold)]" style={{ fontFamily: "'Press Start 2P', monospace", textShadow: "2px 2px 0 #3d2a00" }}>
                OpenClaw
              </h1>
              <p className="text-[7px] text-[var(--pixel-wood-light)] mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                Agent World v1.0
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--pixel-gold)] flex items-center justify-center" style={{ boxShadow: "0 0 0 2px var(--pixel-gold-dark)" }}>
              <span className="text-[8px] text-[var(--pixel-bg)]">$</span>
            </div>
            <span className="text-[10px] text-[var(--pixel-gold)]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {state?.router?.total_cost_usd ? `${state.router.total_cost_usd.toFixed(2)}` : "0.00"}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-6">
        <h2 className="text-[10px] text-[var(--pixel-wood-light)] mb-4" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          — AGENTS —
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {AGENTS.map(agent => {
            const data = state?.agents?.[agent.id]
            const isWorking = (data?.working_count ?? 0) > 0
            const staminaPct = data ? Math.min(100, (data.inbox_count / 10) * 100) : 0
            const goldAmt = data?.outbox_count ?? 0
            return (
              <AgentCard
                key={agent.id}
                agent={agent}
                staminaPct={staminaPct}
                gold={goldAmt}
                activeTask={isWorking ? `task-${agent.id}` : null}
                isWorking={isWorking}
              />
            )
          })}
        </div>

        <h2 className="text-[10px] text-[var(--pixel-wood-light)] mb-4" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          — QUEST LOG —
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PixelCard>
            <p className="text-[8px] text-[var(--pixel-grass)] mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>Sprint 10</p>
            <QuestLog tasks={[
              { id: "S10-S7A", label: "S7-A VPS deploy", done: false },
              { id: "S10-SDK", label: "SDK Direct Haiku", done: false },
            ]} />
          </PixelCard>
          <PixelCard>
            <p className="text-[8px] text-[var(--pixel-grass)] mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>Router</p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[7px] text-[var(--muted-foreground)]" style={{ fontFamily: "'Press Start 2P', monospace" }}>Decisions</span>
                <span className="text-[7px] text-[var(--pixel-gold)]" style={{ fontFamily: "'Press Start 2P', monospace" }}>{state?.router?.decisions_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[7px] text-[var(--muted-foreground)]" style={{ fontFamily: "'Press Start 2P', monospace" }}>Cost</span>
                <span className="text-[7px] text-[var(--pixel-gold)]" style={{ fontFamily: "'Press Start 2P', monospace" }}>${(state?.router?.total_cost_usd ?? 0).toFixed(4)}</span>
              </div>
            </div>
          </PixelCard>
        </div>

        <div className="text-center pt-4 border-t-2 border-[var(--pixel-border)] mt-6">
          <p className="text-[7px] text-[var(--muted-foreground)]" style={{ fontFamily: "'Press Start 2P', monospace" }}>PRESS START TO BEGIN</p>
          <p className="text-[6px] text-[var(--muted-foreground)] mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>alex@franklin templeton · openclaw v2026.5</p>
        </div>
      </div>
    </div>
  )
}