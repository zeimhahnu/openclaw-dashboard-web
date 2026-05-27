"use client"

import { DollarSign } from "lucide-react"

interface DailyCostEntry {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

interface RouterUsageCardProps {
  usage: {
    totals: { input_tokens: number; output_tokens: number; cost_usd: number }
    by_day: Record<string, DailyCostEntry>
  } | null
  isLoading: boolean
}

function CostBar({ value, max }: { value: number; max: number }) {
  if (max === 0) return <div className="h-1.5 bg-[var(--muted)] rounded-full w-full" />
  const pct = Math.round((value / max) * 100)
  return (
    <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#00ff88] rounded-full transition-all duration-500"
        style={{ width: pct + "%" }}
      />
    </div>
  )
}

function formatDay(dayStr: string): string {
  const d = new Date(dayStr + "T00:00:00Z")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(n)
}

function fmtCost(v: number): string {
  if (v === 0) return "-"
  return "$" + v.toFixed(4)
}

export function RouterUsageCard({ usage, isLoading }: RouterUsageCardProps) {
  if (isLoading || !usage) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4 animate-pulse">
        <div className="h-4 bg-[var(--muted)] rounded w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
           <div key={i} className="h-3 bg-[var(--muted)] rounded w-full" />
          ))}
        </div>
      </div>
    )
  }

  const { totals, by_day } = usage
  const days = Object.keys(by_day).sort().slice(-14)
  const maxCost = Math.max(...days.map((d) => by_day[d].cost_usd), 0)

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4 border-accent-left">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-3">
        <DollarSign className="h-4 w-4 text-[#00ff88]" />
        <span className="font-code text-sm font-semibold">router_usage</span>
        <span className="ml-auto font-code text-xs text-[#00d4ff]">14d window</span>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] text-center">
          <div className="font-code text-xs text-[#00d4ff] font-bold">{formatTokens(totals.input_tokens)}</div>
          <div className="font-code text-[10px] text-[var(--muted-foreground)]">in_tokens</div>
        </div>
        <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] text-center">
          <div className="font-code text-xs text-[#00d4ff] font-bold">{formatTokens(totals.output_tokens)}</div>
          <div className="font-code text-[10px] text-[var(--muted-foreground)]">out_tokens</div>
        </div>
        <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] text-center">
          <div className="font-code text-xs text-[#00ff88] font-bold">${totals.cost_usd.toFixed(4)}</div>
          <div className="font-code text-[10px] text-[var(--muted-foreground)]">cost_usd</div>
        </div>
      </div>

      {/* Cost by day bars */}
      {days.length === 0 ? (
        <p className="font-code text-xs text-[var(--muted-foreground)]">{"// no cost data yet"}</p>
      ) : (
        <div className="space-y-2">
          <div className="font-code text-xs text-[var(--muted-foreground)] mb-2">{"// cost by day"}</div>
          {days.map((day) => {
            const { cost_usd } = by_day[day]
            return (
              <div key={day} className="flex items-center gap-3">
                <span className="font-code text-xs text-[var(--muted-foreground)] w-12 shrink-0">
                  {formatDay(day)}
                </span>
                <div className="flex-1">
                  <CostBar value={cost_usd} max={maxCost} />
                </div>
                <span className="font-code text-xs text-[var(--muted-foreground)] w-16 text-right">
                  {fmtCost(cost_usd)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
