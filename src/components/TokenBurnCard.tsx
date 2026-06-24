"use client"

import { useState } from "react"
import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react"

type DailyCostEntry = {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

type ModelUsageEntry = {
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

interface UpkeepSnapshot {
  date: string
  ts: string
  agents: Record<string, { inbox: number; outbox: number }>
  system: { load: number; mem_pct: number; disk_pct: number; uptime_h: number }
}

interface MetricsHistory {
  days: number
  series: UpkeepSnapshot[]
}

interface TokenBurnCardProps {
  usage: {
    totals: { input_tokens: number; output_tokens: number; cost_usd: number }
    by_day: Record<string, DailyCostEntry>
    by_model: Record<string, ModelUsageEntry>
    by_day_model?: Record<string, Record<string, ModelUsageEntry>>
  } | null
  metricsHistory: MetricsHistory | null
  isLoading: boolean
}

function fmtCost(v: number): string {
  if (v === 0) return "—"
  return "$" + v.toFixed(1)
}

function fmtTokens(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K"
  return String(v)
}

function burnColor(dailyAvg: number): string {
  if (dailyAvg < 0.50)  return "text-[#7aad5a]"
  if (dailyAvg <= 2.00) return "text-[#e8a935]"
  return "text-[#c45a3a]"
}

function burnBg(dailyAvg: number): string {
  if (dailyAvg < 0.50)  return "bg-[#7aad5a]/10 border-[#7aad5a]/30"
  if (dailyAvg <= 2.00) return "bg-[#e8a935]/10 border-[#e8a935]/30"
  return "bg-[#c45a3a]/10 border-[#c45a3a]/30"
}

function TrendIcon({ trend }: { trend: "rising" | "falling" | "flat" }) {
  if (trend === "rising")  return <TrendingUp  className="h-3 w-3 text-[#c45a3a]" />
  if (trend === "falling") return <TrendingDown className="h-3 w-3 text-[#7aad5a]" />
  return                          <Minus         className="h-3 w-3 text-[#e8a935]" />
}

export function TokenBurnCard({ usage, metricsHistory, isLoading }: TokenBurnCardProps) {
  // Hooks run unconditionally (before the early-return below) per React rules.
  const [hoverDay, setHoverDay] = useState<string | null>(null)

  if (isLoading || !usage) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[var(--warning)] rounded p-3">
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

  const { by_day, by_model, by_day_model } = usage
  // by_day is VPS-only; by_day_model is VPS+Mason merged (per calendar day,
  // exact - not an approximation). Prefer the merged total wherever a day has
  // one, so the chart's line/peak/avg and the hover panel's total always
  // agree - a day with real Mason spend showing near-$0 on the line while the
  // hover panel lists $85 underneath it would be a self-contradicting chart.
  const dayTotal = (d: string): number => {
    const dm = by_day_model?.[d]
    if (dm) return Object.values(dm).reduce((s, m) => s + m.cost_usd, 0)
    return by_day[d]?.cost_usd ?? 0
  }
  const days = [...new Set([...Object.keys(by_day), ...Object.keys(by_day_model ?? {})])].sort()

  const today = new Date().toISOString().slice(0, 10)
  const todayCost = dayTotal(today)

  // 7-day average
  const validDays = days.filter((d) => dayTotal(d) > 0)
  const avg7d = validDays.length > 0
    ? validDays.reduce((s, d) => s + dayTotal(d), 0) / validDays.length
    : 0

  // Prior 7-day window for trend
  const cutoffIdx = days.length - 7
  const priorDays = days.slice(Math.max(0, cutoffIdx - 7), cutoffIdx)
  const priorValid = priorDays.filter((d) => dayTotal(d) > 0)
  const avgPrior = priorValid.length > 0
    ? priorValid.reduce((s, d) => s + dayTotal(d), 0) / priorValid.length
    : 0

  let trend: "rising" | "falling" | "flat" = "flat"
  if (avgPrior > 0 && avg7d > avgPrior * 1.05)  trend = "rising"
  if (avgPrior > 0 && avg7d < avgPrior * 0.95)    trend = "falling"

  // Peak burn day
  let peakDay = ""
  let peakCost = 0
  for (const d of days) {
    const c = dayTotal(d)
    if (c > peakCost) { peakCost = c; peakDay = d }
  }

  // sparkline (all available days)
  const maxDayCost = days.reduce((m, d) => Math.max(m, dayTotal(d)), 0.001)

  const burnColorClass = burnColor(avg7d)
  const burnBgClass   = burnBg(avg7d)

  return (
    <div className={`bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[var(--warning)] rounded p-3 ${burnBgClass}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
        <Flame className="h-3.5 w-3.5 text-[var(--warning)]" />
        <span className="font-code text-xs font-semibold">Upkeep</span>
        <span className="ml-auto font-code text-[10px] text-[var(--muted-foreground)]">7d ↔ 14d</span>
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
              trend === "rising" ? "text-[#c45a3a]" : trend === "falling" ? "text-[#7aad5a]" : "text-[#e8a935]"
            }`}>
              {trend === "rising" ? "up" : trend === "falling" ? "down" : "steady"}
            </span>
          </div>
          <div className="font-code text-[9px] text-[var(--muted-foreground)]">trend</div>
        </div>
      </div>

      {/* $ spend trend — primary chart. A baseline + Y-axis labels + filled
          area replace the old bare bars: without a fixed 0-line and a scale
          label, a thin line/bar set has no reference point to read values
          from ("floating in the middle" — there was nothing to float above). */}
      {days.length > 0 && (() => {
        const W = 300, H = 64, padL = 28, padB = 12, padT = 10
        const plotW = W - padL, plotH = H - padB - padT
        const yMax = maxDayCost * 1.15 || 1
        const x = (i: number) => padL + (days.length <= 1 ? plotW / 2 : (i / (days.length - 1)) * plotW)
        const y = (v: number) => padT + plotH - (v / yMax) * plotH
        const pts = days.map((d, i) => [x(i), y(dayTotal(d))] as const)
        const linePts = pts.map(([px, py]) => `${px},${py}`).join(" ")
        const areaPts = `${padL},${y(0)} ${linePts} ${x(days.length - 1)},${y(0)}`
        const todayIdx = days.indexOf(today)
        const avgY = y(avg7d)
        const hoverIdx = hoverDay ? days.indexOf(hoverDay) : -1
        const hitW = days.length > 1 ? plotW / (days.length - 1) : plotW
        const activeDay = hoverDay && days.includes(hoverDay) ? hoverDay : null
        const activeModels = activeDay ? Object.entries(by_day_model?.[activeDay] ?? {}) : []
        const activeTotal = activeDay ? dayTotal(activeDay) : 0
        return (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-code text-[8px] text-[var(--muted-foreground)]">{`// $ spend (${days.length}d) — hover/tap a point for the model breakdown`}</span>
              <span className="font-code text-[8px] text-[var(--muted-foreground)]">max {fmtCost(maxDayCost)}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none"
              onMouseLeave={() => setHoverDay(null)}>
              <defs>
                <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--warning)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--warning)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* gridlines: 0 (baseline) and max, with $ labels */}
              <line x1={padL} y1={y(0)} x2={W} y2={y(0)} stroke="var(--border)" strokeWidth="1" />
              <line x1={padL} y1={padT} x2={W} y2={padT} stroke="var(--border)" strokeWidth="1" strokeDasharray="2,2" />
              <text x="2" y={y(0) + 3} className="font-code" fontSize="7" fill="var(--muted-foreground)">$0</text>
              <text x="2" y={padT + 3} className="font-code" fontSize="7" fill="var(--muted-foreground)">{fmtCost(maxDayCost)}</text>
              {/* avg/day reference line */}
              {avg7d > 0 && (
                <line x1={padL} y1={avgY} x2={W} y2={avgY} stroke="var(--secondary)" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
              )}
              {/* filled area + line */}
              <polygon points={areaPts} fill="url(#spend-fill)" />
              <polyline points={linePts} fill="none" stroke="var(--warning)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" />
              {/* hover guide line */}
              {hoverIdx >= 0 && (
                <line x1={x(hoverIdx)} y1={padT} x2={x(hoverIdx)} y2={y(0)} stroke="var(--foreground)" strokeWidth="1" opacity="0.25" />
              )}
              {pts.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={i === hoverIdx ? 3.5 : i === todayIdx ? 3 : 1.5}
                  fill="var(--warning)" opacity={i === hoverIdx ? 1 : i === todayIdx ? 1 : 0.6} />
              ))}
              {/* today's $ value, labeled directly on the chart */}
              {todayIdx >= 0 && todayCost > 0 && hoverIdx < 0 && (
                <text x={Math.min(x(todayIdx) + 4, W - 36)} y={Math.max(y(todayCost) - 6, 9)}
                  className="font-code" fontSize="8" fontWeight="bold" fill="var(--warning)">
                  {fmtCost(todayCost)}
                </text>
              )}
              {/* invisible per-day hit targets, full chart height, centered on each point */}
              {days.map((d, i) => (
                <rect key={d} x={x(i) - hitW / 2} y="0" width={hitW} height={H}
                  fill="transparent"
                  onMouseEnter={() => setHoverDay(d)}
                  onClick={() => setHoverDay(hoverDay === d ? null : d)}
                  style={{ cursor: "pointer" }} />
              ))}
            </svg>
            {/* breakdown panel — shows the hovered/tapped day, or the date range when idle */}
            {activeDay ? (
              <div className="mt-1 px-2 py-1.5 rounded bg-[var(--muted)] border border-[var(--border)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-code text-[9px] font-bold">{activeDay}</span>
                  <span className="font-code text-[9px] font-bold" style={{ color: "var(--warning)" }}>{fmtCost(activeTotal)}</span>
                </div>
                {activeModels.length > 0 ? (
                  <div className="space-y-0.5">
                    {activeModels.sort(([, a], [, b]) => b.cost_usd - a.cost_usd).map(([model, m]) => (
                      <div key={model} className="flex items-center justify-between">
                        <span className="font-code text-[8px] text-[var(--muted-foreground)] truncate">{model}</span>
                        <span className="font-code text-[8px] text-[var(--muted-foreground)] shrink-0 ml-2">
                          {fmtCost(m.cost_usd)} · {m.calls}c
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="font-code text-[8px] text-[var(--muted-foreground)]">{"// no per-model breakdown for this day"}</span>
                )}
              </div>
            ) : (
              <div className="flex justify-between mt-0.5">
                <span className="font-code text-[6px] text-[var(--faint)]">{days[0]?.slice(5)}</span>
                {avg7d > 0 && (
                  <span className="font-code text-[6px] text-[var(--secondary)]">avg {fmtCost(avg7d)}</span>
                )}
                <span className="font-code text-[6px] text-[var(--faint)]">{days[days.length - 1]?.slice(5)}</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* System load — secondary/infra context, NOT a spend metric (kept small
          and clearly labeled so it's never mistaken for the $ chart above). */}
      {metricsHistory && metricsHistory.series.length > 1 && (() => {
        // metrics_history snapshots multiple times a day (~12/day observed) —
        // plotting every raw point both mislabels "Nd" with the snapshot count
        // and crams a dense, illegible squiggle into a few hundred px. Bucket
        // to one point per calendar day (peak load) for a clean, true trend.
        const byDate = new Map<string, number>()
        for (const s of metricsHistory.series) {
          const d = s.date
          if (!d) continue
          byDate.set(d, Math.max(byDate.get(d) ?? 0, s.system?.load ?? 0))
        }
        const dates = [...byDate.keys()].sort()
        const loads = dates.map((d) => byDate.get(d) ?? 0)
        const maxLoad = Math.max(...loads, 0.01)
        const W = Math.max(dates.length * 8, 16), H = 28, base = H - 4
        return (
          <div className="mb-3 opacity-80">
            <div className="font-code text-[7px] text-[var(--muted-foreground)] mb-1">{`// server CPU load (not $) — ${dates.length}d`}</div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-6" preserveAspectRatio="none">
              <line x1="0" y1={base} x2={W} y2={base} stroke="var(--border)" strokeWidth="1" />
              <polyline
                fill="none"
                stroke="var(--secondary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={loads.map((l, i) => `${i * 8 + 4},${base - (l / maxLoad) * (base - 4)}`).join(" ")}
              />
            </svg>
            <div className="flex justify-between">
              <span className="font-code text-[6px] text-[var(--faint)]">{dates[0]?.slice(5)}</span>
              <span className="font-code text-[6px] text-[var(--muted-foreground)]">peak {maxLoad.toFixed(1)}</span>
              <span className="font-code text-[6px] text-[var(--faint)]">{dates[dates.length - 1]?.slice(5)}</span>
            </div>
          </div>
        )
      })()}

      {/* Peak day */}
      {peakDay && peakCost > 0 && (
        <div className="flex items-center justify-between mb-3 px-2 py-1 rounded bg-[var(--muted)] border border-[var(--border)]">
          <span className="font-code text-[10px] text-[var(--muted-foreground)]">biggest spend</span>
          <span className="font-code text-[10px] font-bold">{peakDay.slice(5)} — {fmtCost(peakCost)}</span>
        </div>
      )}

      {/* By-model breakdown (real data from API) */}
      {by_model && Object.keys(by_model).length > 0 && (
        <div className="border-t border-[var(--border)] pt-2">
          <div className="font-code text-[9px] text-[var(--muted-foreground)] mb-1.5">{"// by-model (14d)"}</div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="font-code text-[8px] text-[var(--muted-foreground)] text-left pb-1 font-normal">model</th>
                <th className="font-code text-[8px] text-[var(--muted-foreground)] text-right pb-1 font-normal">calls</th>
                <th className="font-code text-[8px] text-[var(--muted-foreground)] text-right pb-1 font-normal">in</th>
                <th className="font-code text-[8px] text-[var(--muted-foreground)] text-right pb-1 font-normal">out</th>
                <th className="font-code text-[8px] text-[var(--muted-foreground)] text-right pb-1 font-normal">cost</th>
                <th className="font-code text-[8px] text-[var(--muted-foreground)] text-right pb-1 font-normal w-16">share</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(by_model)
                .sort(([, a], [, b]) => b.cost_usd - a.cost_usd)
                .map(([model, m]) => {
                  const totalCost = Object.values(by_model).reduce((s, v) => s + v.cost_usd, 0)
                  const sharePct = totalCost > 0 ? (m.cost_usd / totalCost) * 100 : 0
                  const barColor = m.cost_usd > 1 ? "#c45a3a" : m.cost_usd > 0.10 ? "#e8a935" : "#7aad5a"
                  return (
                    <tr key={model} className="border-b border-[var(--border)]/50 last:border-b-0">
                      <td className="font-code text-[9px] text-[var(--foreground)] py-1 pr-2 truncate max-w-[120px]" title={model}>
                        {model}
                      </td>
                      <td className="font-code text-[9px] text-[var(--muted-foreground)] text-right py-1 pr-2">
                        {m.calls}
                      </td>
                      <td className="font-code text-[9px] text-[var(--muted-foreground)] text-right py-1 pr-2">
                        {fmtTokens(m.input_tokens)}
                      </td>
                      <td className="font-code text-[9px] text-[var(--muted-foreground)] text-right py-1 pr-2">
                        {fmtTokens(m.output_tokens)}
                      </td>
                      <td className="font-code text-[9px] text-right py-1 pr-2" style={{ color: barColor }}>
                        {fmtCost(m.cost_usd)}
                      </td>
                      <td className="py-1 w-16">
                        <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(4, sharePct)}%`, background: barColor }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* No data state */}
      {Object.keys(by_day).length === 0 && (
        <p className="font-code text-[10px] text-[var(--muted-foreground)] mt-2">
          {"// the ledger is empty — no spending yet"}
        </p>
      )}
    </div>
  )
}