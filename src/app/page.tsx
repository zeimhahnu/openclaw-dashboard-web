"use client"

import { useEffect, useState } from "react"
import { useDashboardApi } from "@/hooks/useDashboardApi"
import { CompactAgentRow, ActivityFeed } from "@/components/AgentStatusCard"
import { RouterStatsCard } from "@/components/RouterStatsCard"
import { TokenBurnCard } from "@/components/TokenBurnCard"
import { TaskActivityCard } from "@/components/TaskActivityCard"
import PixelGuild, { type WeatherCondition } from "@/components/PixelGuild"
import { CoordinationCard } from "@/components/CoordinationCard"
import { RefreshCw, Sprout, Sun, Moon, CloudRain, AlertCircle } from "lucide-react"
import { QuestPanel } from "@/components/QuestPanel"
import { formatRelativeTime } from "@/lib/utils"

// Kuala Lumpur is UTC+8 year-round (no DST) — the scene's sky always reflects
// MYT, regardless of what timezone the browser viewing the dashboard is in.
function getMytHour(): number {
  const utcMs = Date.now()
  return new Date(utcMs + 8 * 3600_000).getUTCHours()
}

function useMytHour(): number {
  const [hour, setHour] = useState(getMytHour)
  useEffect(() => {
    const id = setInterval(() => setHour(getMytHour()), 60_000)
    return () => clearInterval(id)
  }, [])
  return hour
}

// The Homestead scene is a 4.5:1 panorama (900x200). At desktop widths it nearly
// fills a 280px box; on a phone Scale.FIT collapses it to ~80px tall, leaving a
// big dead band. Shrink the container on mobile so the scene + HUD sit snug.
function useIsMobile(query = "(max-width: 640px)"): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [query])
  return m
}

// wttr.in weather codes -> our 4-bucket condition. No API key needed.
function mapWeatherCode(code: number): WeatherCondition {
  if ([389, 392, 386, 395, 200].includes(code)) return "storm"
  if ([176, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359, 365, 368, 371].includes(code)) return "rain"
  if ([119, 122, 143, 248, 260].includes(code)) return "cloudy"
  return "sunny"
}

function useKlWeather(): WeatherCondition {
  const [weather, setWeather] = useState<WeatherCondition>("sunny")
  useEffect(() => {
    let cancelled = false
    const fetchWeather = async () => {
      try {
        const res = await fetch("https://wttr.in/Kuala+Lumpur?format=j1")
        if (!res.ok) return
        const data = await res.json()
        const code = parseInt(data?.current_condition?.[0]?.weatherCode ?? "", 10)
        if (!cancelled && Number.isFinite(code)) setWeather(mapWeatherCode(code))
      } catch {
        // keep last known condition — don't flip the scene on a flaky fetch
      }
    }
    fetchWeather()
    const id = setInterval(fetchWeather, 15 * 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  return weather
}

const AGENTS = ["lil-claw", "goop", "mason"] as const

const FARM_OPENED_AT = new Date("2026-04-01").getTime()
const FARM_DAY = Math.max(1, Math.floor((Date.now() - FARM_OPENED_AT) / 86400000))
function timeOfDay(h: number): { label: string; Icon: typeof Sun } {
  if (h < 6)  return { label: "Night",     Icon: Moon }
  if (h < 12) return { label: "Morning",   Icon: Sun }
  if (h < 18) return { label: "Afternoon", Icon: Sun }
  return { label: "Evening", Icon: Moon }
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-2 px-0.5">{children}</div>
}

const AGENT_COLORS: Record<string, string> = {
  "lil-claw": "#1ea84e",
  goop:       "#1490b8",
  mason:      "#5828c8",
}

export default function DashboardPage() {
  const { state, error, loading, refetch } = useDashboardApi(30000)
  const gold = state?.router?.total_cost_usd ?? 0
  const mytHour = useMytHour()
  const weather = useKlWeather()
  const isMobile = useIsMobile()
  const TOD = timeOfDay(mytHour)

  const today       = new Date().toISOString().slice(0, 10)
  const todayCost   = state?.router_usage?.by_day?.[today]?.cost_usd ?? 0
  const totalDone   = AGENTS.reduce((s, a) => s + (state?.agents?.[a]?.outbox_count ?? 0), 0)
  const totalActive = AGENTS.reduce((s, a) => s + (state?.agents?.[a]?.working_count ?? 0), 0)
  const totalInbox  = AGENTS.reduce((s, a) => s + (state?.agents?.[a]?.inbox_count ?? 0), 0)

  // The legacy `state.router` field is dead — decisions_count is never set and
  // model_breakdown is always {} (RouterStatsCard was falling back to a
  // hardcoded fake roster). router_usage.by_model is real and, since the
  // gateway now merges Mason's Claude usage into it, already includes
  // Sonnet/Opus/Haiku/Fable alongside the VPS models - derive the card from it.
  const byModel = state?.router_usage?.by_model ?? {}
  const modelCallCounts = Object.fromEntries(Object.entries(byModel).map(([m, v]) => [m, v.calls]))
  const totalModelCalls = Object.values(modelCallCounts).reduce((s, c) => s + c, 0)
  const modelMixData = state?.router_usage ? {
    decisions_count: totalModelCalls,
    model_breakdown: modelCallCounts,
    total_cost_usd: state.router_usage.totals.cost_usd,
  } : null
  const topModels = Object.entries(byModel)
    .map(([m, v]) => [m, v.cost_usd] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <main className="min-h-screen text-[var(--foreground)]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="max-w-[1320px] mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-[var(--primary)]/12 border border-[var(--primary)]/25 shadow-[0_0_20px_-6px_var(--primary)]">
              <Sprout className="h-[18px] w-[18px] text-[var(--primary)]" />
            </div>
            <div className="leading-none">
              <h1 className="font-display text-[19px] font-semibold tracking-tight text-glow">
                OpenClaw
              </h1>
              <p className="font-code text-[10.5px] text-[var(--muted-foreground)] mt-1">
                a small farm that never sleeps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:flex items-center gap-1.5 font-code text-[11px] text-[var(--muted-foreground)] px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)]/60">
              <TOD.Icon className="h-3.5 w-3.5 text-[var(--primary)]" />
              Day {FARM_DAY} · {TOD.label}
            </span>
            <span className={`flex items-center gap-1.5 font-code text-[11px] px-2.5 py-1.5 rounded-md border ${
              loading ? "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"
              : error  ? "bg-[var(--destructive)]/12 text-[var(--destructive)] border-[var(--destructive)]/30"
              : "bg-[var(--secondary)]/12 text-[var(--secondary)] border-[var(--secondary)]/30"
            }`}>
              {error ? <CloudRain className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {loading ? "Waking" : error ? "Stormy" : "Sunny"}
            </span>
            <button onClick={refetch}
              className="grid place-items-center h-8 w-8 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
              aria-label="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 text-[var(--muted-foreground)] ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-7">

        {error && (
          <div className="flex items-center gap-2 bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-lg px-3.5 py-2">
            <AlertCircle className="h-4 w-4 text-[var(--destructive)] shrink-0" />
            <span className="font-code text-xs text-[var(--destructive)]">a storm rolled in — can&apos;t reach the farmhouse · {error} · retrying…</span>
          </div>
        )}

        {/* ── The Farm (hero) ─────────────────────────────────────────────── */}
        <section className="fade-rise">
          <Eyebrow>The Homestead</Eyebrow>
          <div className="surface overflow-hidden">
            {/* flex column, not the default block flow: a bare <canvas> defaults to
                display:inline, and an inline replaced element reserves baseline/
                line-height space around itself even with zero margin/padding on
                every ancestor - that's the ~48px gap above the scene on mobile. */}
            <div className="relative flex flex-col">
              <PixelGuild
                agents={state?.agents ?? null}
                taskDetails={state?.task_details ?? null}
                height={isMobile ? 170 : 280}
                mytHour={mytHour}
                weather={weather}
              />

              {/* Subtle ground fade — anchors the HUD panels */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#0a060340] to-transparent" />

              {/* In-scene agent HUD — utilises the green foreground as live status panels */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-2 px-4 pb-3">
                {(["lil-claw", "goop", "mason"] as const).map((a) => {
                  const d = state?.agents?.[a]
                  const color = AGENT_COLORS[a]
                  const isWorking = (d?.working_count ?? 0) > 0 || d?.session_active
                  const isRed = d?.health === "red"
                  const statusColor = isRed ? "#c45a3a" : isWorking ? color : "#4e8f58"
                  const statusLabel = isRed ? "STUCK" : isWorking ? "WORKING" : "IDLE"
                  const task = d?.current_task

                  return (
                    <div
                      key={a}
                      className="flex-1 min-w-0 rounded px-2.5 py-2"
                      style={{
                        background: "rgba(10,6,3,0.78)",
                        border: `1px solid ${color}22`,
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {/* Name + status */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${isWorking && !isRed ? "pulse-dot" : ""}`}
                          style={{ background: statusColor }}
                        />
                        <span className="font-pixel text-[7px] leading-none truncate" style={{ color }}>
                          {a === "lil-claw" ? "LIL CLAW" : a.toUpperCase()}
                        </span>
                        <span
                          className="ml-auto font-code text-[7px] font-bold shrink-0 tracking-wide"
                          style={{ color: statusColor }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      {/* Metrics */}
                      <div className="flex items-center gap-2.5">
                        <span className="font-code text-[8px]">
                          <span style={{ color }}>{d?.inbox_count ?? 0}</span>
                          <span className="text-white/25"> queued</span>
                        </span>
                        <span className="font-code text-[8px]">
                          <span style={{ color }}>{d?.outbox_count ?? 0}</span>
                          <span className="text-white/25"> done</span>
                        </span>
                      </div>
                      {/* Current task (truncated) */}
                      {task && (
                        <p
                          className="font-code text-[7px] mt-0.5 truncate"
                          style={{ color: "rgba(255,255,255,0.26)" }}
                        >
                          {task.length > 34 ? task.slice(0, 34) + "…" : task}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats ribbon — fills the empty space below the scene */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--border)] flex-wrap">
              {/* Agent health pings */}
              <div className="flex items-center gap-3">
                {AGENTS.map((a) => {
                  const d     = state?.agents?.[a]
                  const color = AGENT_COLORS[a]
                  const on    = (d?.working_count ?? 0) > 0 || d?.session_active
                  const bad   = d?.health === "red"
                  return (
                    <div key={a} className="flex items-center gap-1.5">
                      <span
                        className={on && !bad ? "pulse-dot w-2 h-2 rounded-full" : "w-2 h-2 rounded-full"}
                        style={{ backgroundColor: bad ? "#c45a3a" : on ? color : color + "44" }}
                      />
                      <span className="font-code text-[10px] font-semibold" style={{ color: color }}>
                        {a === "lil-claw" ? "LC" : a === "goop" ? "GP" : "MS"}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="w-px h-4 bg-[var(--border)] shrink-0" />

              {/* Farm metrics */}
              <div className="flex items-center gap-5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="font-code text-[11px] font-bold" style={{ color: "var(--pixel-gold)" }}>
                    {todayCost > 0 ? `$${todayCost.toFixed(4)}` : "—"}
                  </span>
                  <span className="font-code text-[9px] text-[var(--muted-foreground)]">gold today</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-code text-[11px] font-bold text-[var(--secondary)]">{totalDone}</span>
                  <span className="font-code text-[9px] text-[var(--muted-foreground)]">tasks done</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-code text-[11px] font-bold text-[var(--foreground)]">{totalActive}</span>
                  <span className="font-code text-[9px] text-[var(--muted-foreground)]">in field</span>
                </div>
                {totalInbox > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-code text-[11px] font-bold" style={{ color: "var(--warning)" }}>
                      {totalInbox}
                    </span>
                    <span className="font-code text-[9px] text-[var(--muted-foreground)]">queued</span>
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <TOD.Icon className="h-3 w-3 text-[var(--muted-foreground)]" />
                <span className="font-code text-[10px] text-[var(--muted-foreground)]">
                  Day {FARM_DAY} · {TOD.label}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Villagers ───────────────────────────────────────────────────── */}
        <section className="fade-rise">
          <Eyebrow>The Villagers</Eyebrow>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            {/* Compact agent rows */}
            <div className="space-y-2">
              {AGENTS.map((agent) => (
                <CompactAgentRow
                  key={agent}
                  agentName={agent}
                  data={state?.agents?.[agent] ?? null}
                  taskDetails={state?.task_details?.[agent] ?? null}
                  walTails={state?.wal_tails ?? null}
                  isLoading={loading}
                />
              ))}
            </div>

            {/* Roster summary panel */}
            <div className="surface p-4 space-y-4">
              <div className="eyebrow">Roster Overview</div>

              {/* Task counts */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "queued", value: totalInbox,  color: "var(--warning)" },
                  { label: "active", value: totalActive, color: "var(--secondary)" },
                  { label: "done",   value: totalDone,   color: "var(--foreground)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[var(--muted)] rounded p-2.5 text-center border border-[var(--border)]">
                    <div className="font-code text-2xl font-bold tnum leading-none" style={{ color }}>{value}</div>
                    <div className="font-code text-[8px] text-[var(--muted-foreground)] mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Cost highlight */}
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)] border border-[var(--border)] rounded">
                <span className="font-code text-[10px] text-[var(--muted-foreground)]">gold today</span>
                <span className="font-code text-sm font-bold" style={{ color: "var(--pixel-gold)" }}>
                  {todayCost > 0 ? `$${todayCost.toFixed(4)}` : "—"}
                </span>
              </div>

              {/* Top models by spend — real data, not a per-agent guess. The
                  gateway can't attribute a VPS model call to one specific
                  agent, and a static "lil-claw: X / mason: Y" list here used
                  to claim it could (mason's was hardcoded to "Sonnet 4.6" and
                  never changed even though he runs Opus/Sonnet/Haiku/Fable). */}
              {topModels.length > 0 && (
                <div>
                  <div className="font-code text-[9px] text-[var(--muted-foreground)] mb-2">// top models (by spend)</div>
                  <div className="space-y-2">
                    {topModels.map(([model, cost]) => (
                      <div key={model} className="flex items-center justify-between">
                        <span className="font-code text-[10px] truncate" title={model}>
                          {model}
                        </span>
                        <span className="font-code text-[9px] px-1.5 py-0.5 rounded bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)] shrink-0">
                          {cost === 0 ? "—" : `$${cost.toFixed(4)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── The Exchange (A2A coordination) ─────────────────────────────── */}
        <section className="fade-rise">
          <Eyebrow>The Exchange</Eyebrow>
          <CoordinationCard taskDetails={state?.task_details ?? null} isLoading={loading} />
        </section>

        {/* ── Chore Board (QuestPanel) ────────────────────────────────────── */}
        <section className="fade-rise">
          <Eyebrow>The Chore Board</Eyebrow>
          <QuestPanel taskDetails={state?.task_details ?? null} isLoading={loading} />
        </section>

        {/* ── The Ledger ──────────────────────────────────────────────────── */}
        <section className="fade-rise">
          <Eyebrow>The Ledger</Eyebrow>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RouterStatsCard data={modelMixData} isLoading={loading} />
            <TokenBurnCard usage={state?.router_usage ?? null} metricsHistory={state?.metrics_history ?? null} isLoading={loading} />
            <TaskActivityCard
              tasks={state?.tasks ?? null}
              taskDetails={state?.task_details ?? null}
              isLoading={loading}
            />
          </div>
        </section>

        {/* ── Farm journal ────────────────────────────────────────────────── */}
        <section className="fade-rise">
          <Eyebrow>The Journal</Eyebrow>
          <ActivityFeed walTails={state?.wal_tails ?? null} isLoading={loading} />
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-[var(--border)] pt-4 pb-2 flex items-center justify-between">
          <p className="font-code text-[10px] text-[var(--faint)]">
            {state ? `tended ${formatRelativeTime(state.ts)}` : "—"} · harvest in full swing
          </p>
          <p className="font-code text-[10px] text-[var(--faint)] tnum">
            <span style={{ color: "var(--pixel-gold)" }}>◈</span>{" "}
            {gold.toFixed(4)} gold spent
          </p>
        </footer>

      </div>
    </main>
  )
}
