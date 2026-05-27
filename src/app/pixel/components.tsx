"use client"

import { useEffect, useState } from "react"

interface AgentSpriteProps {
  agentId: string
  color: string
}

export function AgentSprite({ agentId, color }: AgentSpriteProps) {
  // Simple pixel art sprites using CSS boxes
  const sprites: Record<string, React.ReactNode> = {
    "lil-claw": (
      <div className="relative w-full h-full overflow-hidden rounded-sm">
        {/* Head */}
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-sm"
          style={{ background: color }}
        />
        {/* Eyes */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-1.5 h-1.5 bg-[var(--pixel-bg)]" />
          <div className="w-1.5 h-1.5 bg-[var(--pixel-bg)]" />
        </div>
        {/* Body */}
        <div
          className="absolute top-7 left-1/2 -translate-x-1/2 w-6 h-5 rounded-sm"
          style={{ background: color, opacity: 0.8 }}
        />
        {/* Legs */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-3">
          <div className="w-2 h-3 bg-[var(--pixel-bg)]" style={{ opacity: 0.6 }} />
          <div className="w-2 h-3 bg-[var(--pixel-bg)]" style={{ opacity: 0.6 }} />
        </div>
      </div>
    ),
    goop: (
      <div className="relative w-full h-full overflow-hidden rounded-sm">
        {/* Head */}
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-sm"
          style={{ background: color }}
        />
        {/* Visor/eyes */}
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-2 rounded-sm"
          style={{ background: "var(--pixel-bg)" }}
        />
        {/* Body */}
        <div
          className="absolute top-7 left-1/2 -translate-x-1/2 w-5 h-5 rounded-sm"
          style={{ background: color, opacity: 0.8 }}
        />
        {/* Tech legs */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-1.5 h-3 bg-[var(--pixel-bg)]" style={{ opacity: 0.7 }} />
          <div className="w-1.5 h-3 bg-[var(--pixel-bg)]" style={{ opacity: 0.7 }} />
        </div>
      </div>
    ),
    mason: (
      <div className="relative w-full h-full overflow-hidden rounded-sm">
        {/* Hard hat / head */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-4 rounded-sm"
          style={{ background: color }}
        />
        {/* Face */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 w-5 h-3 rounded-sm"
          style={{ background: color, opacity: 0.7 }}
        />
        {/* Body */}
        <div
          className="absolute top-7 left-1/2 -translate-x-1/2 w-6 h-5 rounded-sm"
          style={{ background: color, opacity: 0.6 }}
        />
        {/* Legs */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-3">
          <div className="w-2 h-3 bg-[var(--pixel-bg)]" style={{ opacity: 0.5 }} />
          <div className="w-2 h-3 bg-[var(--pixel-bg)]" style={{ opacity: 0.5 }} />
        </div>
      </div>
    ),
  }

  return (
    <div className="w-16 h-16 pixel-art" style={{ imageRendering: "pixelated" }}>
      {sprites[agentId] || sprites["lil-claw"]}
    </div>
  )
}

export function PixelCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pixel-card p-4 bg-[var(--card)] border border-[var(--border)]"
      style={{ borderRadius: "0.25rem" }}
    >
      {children}
    </div>
  )
}

interface StaminaBarProps {
  value: number // 0-100
  color: string
}

export function StaminaBar({ value, color }: StaminaBarProps) {
  const segments = 10
  const filled = Math.round((value / 100) * segments)

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className="h-3 flex-1"
          style={{
            background: i < filled ? color : "var(--pixel-hp-bg)",
            border: "1px solid var(--pixel-border)",
            boxShadow: i < filled ? `0 0 4px ${color}40` : "none",
          }}
        />
      ))}
    </div>
  )
}

interface GoldCounterProps {
  amount: number
}

export function GoldCounter({ amount }: GoldCounterProps) {
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center"
        style={{ background: "var(--pixel-gold)", boxShadow: "0 0 0 1px var(--pixel-gold-dark)" }}
      >
        <span className="text-[6px] text-[var(--pixel-bg)]">$</span>
      </div>
      <span
        className="text-[8px] text-[var(--pixel-gold)]"
        style={{ fontFamily: "'Press Start 2P', monospace" }}
      >
        {amount}
      </span>
    </div>
  )
}

interface QuestLogProps {
  tasks: Array<{ id: string; label: string; done: boolean }>
}

export function QuestLog({ tasks }: QuestLogProps) {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2">
          <div
            className="w-4 h-4 flex items-center justify-center text-[8px]"
            style={{
              background: task.done ? "var(--pixel-grass)" : "var(--pixel-bg)",
              border: "2px solid var(--pixel-border)",
              color: task.done ? "var(--pixel-bg)" : "var(--muted-foreground)",
            }}
          >
            {task.done ? "✓" : ""}
          </div>
          <span
            className="text-[7px] truncate"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              color: task.done ? "var(--muted-foreground)" : "var(--pixel-white)",
              textDecoration: task.done ? "line-through" : "none",
            }}
          >
            {task.label}
          </span>
        </div>
      ))}
    </div>
  )
}

interface Particle {
  id: number
  from: string
  to: string
}

interface A2AParticlesProps {
  particles: Particle[]
  onComplete: (id: number) => void
}

export function A2AParticles({ particles, onComplete }: A2AParticlesProps) {
  return (
    <>
      {particles.map((p) => (
        <ParticleDot key={p.id} particle={p} onComplete={onComplete} />
      ))}
    </>
  )
}

function ParticleDot({ particle, onComplete }: { particle: Particle; onComplete: (id: number) => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const duration = 1200

    const tick = () => {
      const elapsed = Date.now() - start
      setProgress(Math.min(1, elapsed / duration))
      if (elapsed < duration) {
        requestAnimationFrame(tick)
      } else {
        onComplete(particle.id)
      }
    }

    requestAnimationFrame(tick)
  }, [particle.id, onComplete])

  const agentX: Record<string, number> = {
    "lil-claw": 16,
    goop: 50,
    mason: 83,
  }

  const fromX = agentX[particle.from] ?? 16
  const toX = agentX[particle.to] ?? 50

  return (
    <div
      className="absolute top-32 z-20 pointer-events-none"
      style={{
        left: `${fromX}%`,
        transform: `translateX(${progress * (toX - fromX)}vw)`,
      }}
    >
      <div
        className="w-3 h-3 rounded-full"
        style={{
          background: "var(--pixel-gold)",
          boxShadow: "0 0 8px var(--pixel-gold), 0 0 16px var(--pixel-gold-dark)",
        }}
      />
    </div>
  )
}