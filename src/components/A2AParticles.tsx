"use client"

import { useEffect, useRef } from "react"

const AGENT_COLORS: Record<string, string> = {
  "lil-claw": "#00ff88",
  goop:       "#00d4ff",
  mason:      "#a78bfa",
}

interface Particle {
  fromAgent: string
  toAgent:   string
  progress:  number
  color:     string
  speed:     number
}

function getAgentCenter(agentId: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-agent-id="${agentId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 3 }
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

export function A2AParticles({ workingAgents }: { workingAgents: string[] }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const particles  = useRef<Particle[]>([])
  const rafRef     = useRef<number | null>(null)
  const workingRef = useRef<string[]>([])

  useEffect(() => {
    workingRef.current = workingAgents
  }, [workingAgents])

  useEffect(() => {
    const ALL_AGENTS = ["lil-claw", "goop", "mason"]


    const spawn = () => {
      const active = workingRef.current
      if (active.length === 0) return

      // 60% chance each tick to keep it ambient, not overwhelming
      if (Math.random() > 0.6) return

      const from   = active[Math.floor(Math.random() * active.length)]
      const others = ALL_AGENTS.filter(a => a !== from)
      const to     = others[Math.floor(Math.random() * others.length)]

      particles.current.push({
        fromAgent: from,
        toAgent:   to,
        progress:  0,
        color:     AGENT_COLORS[from] ?? "#00ff88",
        speed:     0.012 + Math.random() * 0.008,
      })

      // Cap at 8 live particles
      if (particles.current.length > 8) {
        particles.current = particles.current.slice(-8)
      }
    }

    const id = setInterval(spawn, 2200)
    return () => clearInterval(id)
  }, [])

  // Render loop on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.current = particles.current
        .map(p => ({ ...p, progress: p.progress + p.speed }))
        .filter(p => p.progress < 1)

      for (const p of particles.current) {
        const from = getAgentCenter(p.fromAgent)
        const to   = getAgentCenter(p.toAgent)
        if (!from || !to) continue

        const x     = from.x + (to.x - from.x) * p.progress
        const y     = from.y + (to.y - from.y) * p.progress
        const alpha = Math.sin(p.progress * Math.PI)
        const rgb   = hexToRgb(p.color)

        // Outer glow
        ctx.save()
        ctx.globalAlpha = alpha * 0.25
        ctx.fillStyle   = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur  = 16
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fill()

        // Core dot
        ctx.globalAlpha = alpha
        ctx.shadowBlur  = 6
        ctx.fillStyle   = p.color
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Trail
        for (let i = 1; i <= 4; i++) {
          const tp = Math.max(0, p.progress - i * 0.035)
          const tx = from.x + (to.x - from.x) * tp
          const ty = from.y + (to.y - from.y) * tp
          const ta = alpha * (1 - i * 0.22)
          const tr = Math.max(0, 2.5 - i * 0.5)
          ctx.save()
          ctx.globalAlpha = ta
          ctx.fillStyle   = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`
          ctx.beginPath()
          ctx.arc(tx, ty, tr, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 35 }}
    />
  )
}
