"use client"

import { DollarSign, Activity, Wand2 } from "lucide-react"

interface RouterStatsCardProps {
  data: {
    decisions_count: number
    model_breakdown: Record<string, number>
    total_cost_usd:  number
  } | null
  isLoading: boolean
}

function normalizeModelLabel(model: string): string {
  return model
    .replace(/^claude-/, "")
    .replace(/^(minimax|openrouter|anthropic|openai|google|mistral|cohere)\//, "")
    .replace(/-\d{8}$/, "")
}

function modelAccentColor(model: string): string {
  const m = model.toLowerCase()
  if (m.includes("minimax") || m.includes("m2.7"))   return "#00ff88"
  if (m.includes("owl") || m.includes("openrouter")) return "#f59e0b"
  if (m.includes("haiku"))                            return "#a78bfa"
  if (m.includes("sonnet"))                           return "#00d4ff"
  if (m.includes("opus"))                             return "#f472b6"
  if (m.includes("gpt-4o-mini"))                      return "#4ade80"
  if (m.includes("gpt"))                              return "#fbbf24"
  return "#4a7a4a"
}

function spellIcon(model: string): string {
  // Only U+25xx geometric glyphs — Press Start 2P renders these; emoji-range
  // symbols (⚡ ★) tofu in this font.
  const m = model.toLowerCase()
  if (m.includes("minimax") || m.includes("m2.7"))   return "●"
  if (m.includes("owl") || m.includes("openrouter")) return "◎"
  if (m.includes("haiku"))                            return "◈"
  if (m.includes("sonnet"))                           return "◆"
  if (m.includes("opus"))                             return "◆"
  return "·"
}

function SpellBreakdownBar({ breakdown }: { breakdown: Record<string, number> }) {
  const total  = Object.values(breakdown).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const sorted = Object.entries(breakdown).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-2">
      {sorted.map(([model, count]) => {
        const pct   = Math.round((count / total) * 100)
        const label = normalizeModelLabel(model)
        const color = modelAccentColor(model)
        const icon  = spellIcon(model)
        return (
          <div key={model} className="flex items-center gap-2">
            <span className="font-pixel text-[7px] shrink-0" style={{ color }}>{icon}</span>
            <span
              className="font-code text-[10px] w-24 truncate shrink-0"
              style={{ color }}
              title={model}
            >
              {label}
            </span>
            <div className="flex-1 h-1.5 bg-[var(--muted)] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}60` }}
              />
            </div>
            <span className="font-code text-[10px] text-[var(--muted-foreground)] w-12 text-right shrink-0">
              {pct}% · {count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function RouterStatsCard({ data, isLoading }: RouterStatsCardProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[#00ff88] rounded p-3">
        <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
          <div className="skeleton h-3.5 w-3.5 rounded" />
          <div className="skeleton h-3 w-28 rounded" />
          <div className="ml-auto skeleton h-3 w-12 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] space-y-2">
            <div className="skeleton h-2.5 w-16 rounded" />
            <div className="skeleton h-6 w-12 rounded" />
          </div>
          <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] space-y-2">
            <div className="skeleton h-2.5 w-16 rounded" />
            <div className="skeleton h-6 w-20 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="skeleton h-2 w-2 rounded-full" />
              <div className="skeleton h-2.5 w-24 rounded" />
              <div className="flex-1 skeleton h-1.5 rounded" />
              <div className="skeleton h-2.5 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[#00ff88] rounded p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
        <Wand2 className="h-3.5 w-3.5 text-[#00ff88]" />
        <span className="font-pixel text-[8px] text-glow">SPELL REGISTRY</span>
        <span className="ml-auto font-code text-[10px] text-[#00ff88] text-glow">ONLINE</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)]">
          <div className="flex items-center gap-1 mb-0.5">
            <Activity className="h-3 w-3 text-[#00d4ff]" />
            <span className="font-code text-[10px] text-[var(--muted-foreground)]">casts</span>
          </div>
          <span className="font-code text-xl font-bold text-[#00d4ff] text-glow-cyan block">
            {data.decisions_count}
          </span>
        </div>
        <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)]">
          <div className="flex items-center gap-1 mb-0.5">
            <DollarSign className="h-3 w-3" style={{ color: "var(--pixel-gold)" }} />
            <span className="font-code text-[10px] text-[var(--muted-foreground)]">gold</span>
          </div>
          <span className="font-code text-xl font-bold text-glow-gold block"
            style={{ color: "var(--pixel-gold)" }}>
            {data.total_cost_usd === 0 ? "—" : `$${data.total_cost_usd.toFixed(4)}`}
          </span>
        </div>
      </div>

      {/* Spell breakdown */}
      {Object.keys(data.model_breakdown).length > 0 ? (
        <div>
          <span className="font-pixel text-[7px] text-[var(--muted-foreground)] mb-2 block">
            SPELLS CAST
          </span>
          <SpellBreakdownBar breakdown={data.model_breakdown} />
        </div>
      ) : (
        <p className="font-pixel text-[7px] text-[var(--muted-foreground)]">{/* no casts yet */}</p>
      )}
    </div>
  )
}
