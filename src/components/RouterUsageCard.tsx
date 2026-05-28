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
  if (v === 0) return "—"
  return "$" + v.toFixed(4)
}

export function RouterUsageCard({ usage, isLoading }: RouterUsageCardProps) {
  if (isLoading || !usage) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[#00d4ff] rounded p-3">
        <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
          <div className="skeleton h-3.5 w-3.5 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
          <div className="ml-auto skeleton h-3 w-16 rounded" />
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] text-center space-y-1.5">
              <div className="skeleton h-4 w-12 mx-auto rounded" />
              <div className="skeleton h-2 w-8 mx-auto rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="skeleton h-2 w-10 rounded" />
              <div className="flex-1 skeleton h-1.5 rounded" />
              <div className="skeleton h-2 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { totals, by_day } = usage
  const days = Object.keys(by_day).sort().slice(-14)
  const maxCost = Math.max(...days.map((d) => by_day[d].cost_usd), 0.0001)

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[#00d4ff] rounded p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
        <DollarSign className="h-3.5 w-3.5 text-[#00d4ff]" />
        <span className="font-code text-xs font-semibold">router_usage</span>
        <span className="ml-auto font-code text-[10px] text-[var(--muted-foreground)]">14d window</span>
      </div>

      {/* Totals KPI row */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] text-center">
          <div className="font-code text-xs text-[#00d4ff] font-bold text-glow-cyan">
            {formatTokens(totals.input_tokens)}
          </div>
          <div className="font-code text-[9px] text-[var(--muted-foreground)]">in_tok</div>
        </div>
        <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] text-center">
          <div className="font-code text-xs text-[#00d4ff] font-bold text-glow-cyan">
            {formatTokens(totals.output_tokens)}
          </div>
          <div className="font-code text-[9px] text-[var(--muted-foreground)]">out_tok</div>
        </div>
        <div className="bg-[var(--muted)] rounded p-2 border border-[var(--border)] text-center">
          <div className="font-code text-xs text-[#00ff88] font-bold text-glow">
            {fmtCost(totals.cost_usd)}
          </div>
          <div className="font-code text-[9px] text-[var(--muted-foreground)]">cost</div>
        </div>
      </div>

      {/* Cost by day — compact bar chart */}
      {days.length === 0 ? (
        <p className="font-code text-[10px] text-[var(--muted-foreground)]">{"// no cost data yet"}</p>
      ) : (
        <div className="space-y-1.5">
          <div className="font-code text-[10px] text-[var(--muted-foreground)] mb-1">{"// cost by day"}</div>
          {days.map((day) => {
            const { cost_usd, input_tokens, output_tokens } = by_day[day]
            const pct = Math.round((cost_usd / maxCost) * 100)
            return (
              <div key={day} className="flex items-center gap-2 group">
                <span className="font-code text-[9px] text-[var(--muted-foreground)] w-10 shrink-0">
                  {formatDay(day)}
                </span>
                <div className="flex-1 h-1.5 bg-[var(--muted)] rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                      width: pct + "%",
                      backgroundColor: "#00d4ff",
                      boxShadow: pct > 0 ? "0 0 4px #00d4ff60" : "none",
                    }}
                  />
                </div>
                <span className="font-code text-[9px] text-[var(--muted-foreground)] w-14 text-right shrink-0">
                  {fmtCost(cost_usd)}
                </span>
                {/* Tooltip on hover */}
                <div className="hidden group-hover:block absolute right-8 bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 z-10 text-[9px] font-code text-[var(--muted-foreground)] whitespace-nowrap">
                  in:{formatTokens(input_tokens)} out:{formatTokens(output_tokens)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
