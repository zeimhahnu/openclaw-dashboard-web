"use client"

import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface DailyCostEntry {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

interface TokenBurnCardProps {
  usage: {
    totals: { input_tokens: number; output_tokens: number; cost_usd: number }
    by_day: Record<string, DailyCostEntry>
  } | null
  isLoading: boolean
}

function formatTokens(n: number): string {
  if (n === 0) return "—"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(n)
}

function fmtCost(v: number): string {
  if (v === 0) return "—"
  return "$" + v.toFixed(4)
}

function burnColor(dailyAvg: number): string {
  if (dailyAvg < 0.50)  return "text-[#00ff88]"   // green — healthy
  if (dailyAvg <= 2.00) return "text-[#f59e0b]"  // amber — moderate
  return "text-[#ff4444]"                         // red — burning
}

function burnBg(dailyAvg: number): string {
  if (dailyAvg < 0.50)  return "bg-[#00ff88]/10 border-[#00ff88]/30"
  if (dailyAvg <= 2.00) return "bg-[#f59e0b]/10 border-[#f59e0b]/30"
  return "bg-[#ff4444]/10 border-[#ff4444]/30"
}

function TrendIcon({ trend }: { trend: "rising" | "falling" | "flat" }) {
  if (trend === "rising")  return <TrendingUp  className="h-3 w-3 text-[#ff4444]" />
  if (trend === "falling") return <TrendingDown className="h-3 w-3 text-[#00ff88]" />
  return                          <Minus         className="h-3 w-3 text-[#f59e0b]" />
}

// Per-agent cost tier (rough estimate based on model family)
const AGENT_TIER: Record<string, { label: string; tier: "cheap" | "moderate" | "expensive"; color: string }> = {
  "lil-claw": { label: "Lil Claw",  tier: "cheap",     color: "#00ff88" },
  "goop":     { label: "Goop",      tier: "cheap",     color: "#00d4ff" },
  "mason":    { label: "Mason",     tier: "expensive", color: "#a78bfa" },
}

export function TokenBurnCard({ usage, isLoading }: TokenBurnCardProps) {
  if (isLoading || !usage) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[#f97316] rounded p-3">
        <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
          <div className="skeleton h-3.5 w-3.5 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[0, 1].map((i) => (
            <div key={i} className="bg-[var(--muted)] rounded p-2 border border-[var(--border)]">
              <div className="skeleton h-3 w-16 rounded mb-1" />
              <div className="skeleton h-6 w-12 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-6 w-full rounded" />)}
        </div>
      </div>
    )
  }

  const { by_day } = usage
  const days = Object.keys(by_day).sort().slice(-7)

// Per-agent cost tier
  const today = new Date().toISOString().slice(0, 10)
  const todayCost = by_day[today]?.cost_usd ?? 0

  // 7-day average
  const validDays = days.filter((d) => by_day[d].cost_usd > 0)
  const avg7d = validDays.length > 0
    ? validDays.reduce((s, d) => s + by_day[d].cost_usd, 0) / validDays.length
    : 0

  // Prior 7-day window for trend
  const allSortedDays = Object.keys(by_day).sort()
  const cutoffIdx = allSortedDays.length - 7
  const priorDays = allSortedDays.slice(Math.max(0, cutoffIdx - 7), cutoffIdx)
  const avgPrior = priorDays.filter((d) => by_day[d].cost_usd > 0).length > 0
    ? priorDays.filter((d) => by_day[d].cost_usd > 0).reduce((s, d) => s + by_day[d].cost_usd, 0)
      / priorDays.filter((d) => by_day[d].cost_usd > 0).length
    : 0

  let trend: "rising" | "falling" | "flat" = "flat"
  if (avgPrior > 0 && avg7d > avgPrior * 1.05)  trend = "rising"
  if (avgPrior > 0 && avg7d < avgPrior * 0.95)    trend = "falling"

  // Peak burn day
  let peakDay = ""
  let peakCost = 0
  for (const [d, v] of Object.entries(by_day)) {
    if (v.cost_usd > peakCost) { peakCost = v.cost_usd; peakDay = d }
  }

  // Per-agent estimate (even if data is sparse, show the model)
  const agentModels = [
    { id: "lil-claw", model: "MiniMax-M2.7", ...AGENT_TIER["lil-claw"] },
    { id: "goop",     model: "MiniMax-M2.7", ...AGENT_TIER["goop"] },
    { id: "mason",    model: "Sonnet 4.6",   ...AGENT_TIER["mason"] },
  ]

  const burnColorClass = burnColor(avg7d)
  const burnBgClass   = burnBg(avg7d)

  return (
    <div className={`bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[#f97316] rounded p-3 ${burnBgClass}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
        <Flame className="h-3.5 w-3.5 text-[#f97316]" />
        <span className="font-code text-xs font-semibold">token_burn</span>
        <span className="ml-auto font-code text-[10px] text-[var(--muted-foreground)]">7d window</span>
      </div>

      {/* Today's cost + 7d avg + trend row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className={`font-code text-sm font-bold ${burnColorClass}`}>
            {todayCost > 0 ? fmtCost(todayCost) : "—"}
          </div>
          <div className="font-code text-[9px] text-[var(--muted-foreground)]">today</div>
        </div>
        <div className="text-center">
          <div className={`font-code text-sm font-bold ${burnColorClass}`}>
            {avg7d > 0 ? fmtCost(avg7d) : "—"}
          </div>
          <div className="font-code text-[9px] text-[var(--muted-foreground)]">avg/day</div>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5">
          <div className="flex items-center gap-1">
            <TrendIcon trend={trend} />
            <span className={`font-code text-sm font-bold ${
              trend === "rising" ? "text-[#ff4444]" : trend === "falling" ? "text-[#00ff88]" : "text-[#f59e0b]"
            }`}>
              {trend}
            </span>
          </div>
          <div className="font-code text-[9px] text-[var(--muted-foreground)]">trend</div>
        </div>
      </div>

      {/* Peak day */}
      {peakDay && peakCost > 0 && (
        <div className="flex items-center justify-between mb-3 px-2 py-1 rounded bg-[var(--muted)] border border-[var(--border)]">
          <span className="font-code text-[10px] text-[var(--muted-foreground)]">peak_day</span>
          <span className="font-code text-[10px] font-bold">{peakDay.slice(5)} — {fmtCost(peakCost)}</span>
        </div>
      )}

      {/* Per-agent breakdown */}
      <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
        <div className="font-code text-[9px] text-[var(--muted-foreground)] mb-1">{"// per-agent (est.)"}</div>
        {agentModels.map((agent) => (
          <div key={agent.id} className="flex items-center gap-2">
            <span className="font-code text-[10px] w-14 shrink-0" style={{ color: agent.color }}>
              {agent.label}
            </span>
            <span className="font-code text-[9px] text-[var(--muted-foreground)] flex-1">{agent.model}</span>
            <span className={`font-code text-[10px] font-bold ${
              agent.tier === "expensive" ? "text-[#ff4444]"
                : agent.tier === "moderate" ? "text-[#f59e0b]"
                : "text-[#00ff88]"
            }`}>
              {agent.tier}
            </span>
          </div>
        ))}
      </div>

      {/* No data state */}
      {Object.keys(by_day).length === 0 && (
        <p className="font-code text-[10px] text-[var(--muted-foreground)] mt-2">
          {"// router usage log empty — no burn data yet"}
        </p>
      )}
    </div>
  )
}