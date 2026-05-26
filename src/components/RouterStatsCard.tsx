"use client"

import { Brain, DollarSign, Activity } from "lucide-react"

interface RouterStatsCardProps {
  data: {
    decisions_count: number
    model_breakdown: Record<string, number>
    total_cost_usd: number
  } | null
  isLoading: boolean
}

const MODEL_LABELS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Claude Haiku",
  "claude-sonnet-4-6": "Claude Sonnet",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4o": "GPT-4o",
  "claude-opus-4-5": "Claude Opus",
}

function ModelBreakdownBar({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const colors = ["bg-indigo-500", "bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"]

  return (
    <div className="space-y-1.5">
      {Object.entries(breakdown).map(([model, count], i) => {
        const pct = Math.round((count / total) * 100)
        const label = MODEL_LABELS[model] || model
        return (
          <div key={model} className="flex items-center gap-2 text-xs">
            <span className="w-20 truncate text-[var(--muted-foreground)]">{label}</span>
            <div className="flex-1 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${colors[i % colors.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right text-[var(--muted-foreground)]">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export function RouterStatsCard({ data, isLoading }: RouterStatsCardProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-[var(--muted)] rounded w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-[var(--muted)] rounded w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-4 w-4 text-[var(--primary)]" />
        <span className="font-semibold text-sm">Adaptive Router</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[var(--primary)] mb-1">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-lg font-bold">{data.decisions_count}</span>
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">Decisions</span>
        </div>
        <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[var(--success)] mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="text-lg font-bold">
              {data.total_cost_usd === 0 ? "—" : `$${data.total_cost_usd.toFixed(4)}`}
            </span>
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">Total Cost</span>
        </div>
      </div>

      {Object.keys(data.model_breakdown).length > 0 && (
        <div>
          <span className="text-xs text-[var(--muted-foreground)] mb-1.5 block">Model Breakdown</span>
          <ModelBreakdownBar breakdown={data.model_breakdown} />
        </div>
      )}
    </div>
  )
}