"use client"

import { Brain, DollarSign, Activity, Terminal } from "lucide-react"

interface RouterStatsCardProps {
  data: {
    decisions_count: number
    model_breakdown: Record<string, number>
    total_cost_usd: number
  } | null
  isLoading: boolean
}

const MODEL_LABELS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "haiku-4",
  "claude-sonnet-4-6": "sonnet-4-6",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4o": "gpt-4o",
  "claude-opus-4-5": "opus-4-5",
}

const MODEL_ACCENTS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "text-[#a78bfa]",
  "claude-sonnet-4-6": "text-[#00d4ff]",
  "gpt-4o-mini": "text-[#00ff88]",
  "gpt-4o": "text-[#fbbf24]",
  "claude-opus-4-5": "text-[#f472b6]",
}

function ModelBreakdownBar({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div className="space-y-1.5">
      {Object.entries(breakdown).map(([model, count]) => {
        const pct = Math.round((count / total) * 100)
        const label = MODEL_LABELS[model] || model
        const colorClass = MODEL_ACCENTS[model] || "text-[#64748b]"
        return (
          <div key={model} className="flex items-center gap-3">
            <span className={`font-code text-xs w-20 truncate ${colorClass}`}>{label}</span>
            <div className="flex-1 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${colorClass.replace("text-", "bg-")}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-code text-xs text-[var(--muted-foreground)] w-6 text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export function RouterStatsCard({ data, isLoading }: RouterStatsCardProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4 animate-pulse">
        <div className="h-4 bg-[var(--muted)] rounded w-28 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-[var(--muted)] rounded w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4 border-accent-left">
      {/* Terminal-style header */}
      <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-3">
        <Terminal className="h-4 w-4 text-[#00ff88]" />
        <span className="font-code text-sm font-semibold">adaptive_router</span>
        <span className="ml-auto font-code text-xs text-[#00ff88] text-glow">ONLINE</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--muted)] rounded p-3 border border-[var(--border)]">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Activity className="h-3.5 w-3.5 text-[#00d4ff]" />
            <span className="font-code text-lg font-bold text-[#00d4ff]">{data.decisions_count}</span>
          </div>
          <span className="font-code text-xs text-[var(--muted-foreground)] block text-center">decisions</span>
        </div>
        <div className="bg-[var(--muted)] rounded p-3 border border-[var(--border)]">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-[#00ff88]" />
            <span className="font-code text-lg font-bold text-[#00ff88]">
              {data.total_cost_usd === 0 ? "0.00" : `$${data.total_cost_usd.toFixed(4)}`}
            </span>
          </div>
          <span className="font-code text-xs text-[var(--muted-foreground)] block text-center">total_cost</span>
        </div>
      </div>

      {/* Model breakdown */}
      {Object.keys(data.model_breakdown).length > 0 && (
        <div>
          <span className="font-code text-xs text-[var(--muted-foreground)] mb-2 block">// model breakdown</span>
          <ModelBreakdownBar breakdown={data.model_breakdown} />
        </div>
      )}
    </div>
  )
}