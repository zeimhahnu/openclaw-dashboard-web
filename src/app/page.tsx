"use client"

import { useDashboardApi } from "@/hooks/useDashboardApi"
import { CompactAgentRow, ActivityFeed } from "@/components/AgentStatusCard"
import { RouterStatsCard } from "@/components/RouterStatsCard"
import { TokenBurnCard } from "@/components/TokenBurnCard"
import { TaskActivityCard } from "@/components/TaskActivityCard"
import PixelGuild from "@/components/PixelGuild"
import { CoordinationCard } from "@/components/CoordinationCard"
import { RefreshCw, Sprout, Sun, Moon, CloudRain, AlertCircle } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

const AGENTS = ["lil-claw", "goop", "mason"] as const

const FARM_OPENED_AT = new Date("2026-04-01").getTime()
const FARM_DAY = Math.max(1, Math.floor((Date.now() - FARM_OPENED_AT) / 86400000))
function timeOfDay(): { label: string; Icon: typeof Sun } {
  const h = new Date().getHours()
  if (h < 6)  return { label: "Night",     Icon: Moon }
  if (h < 12) return { label: "Morning",   Icon: Sun }
  if (h < 18) return { label: "Afternoon", Icon: Sun }
  return { label: "Evening", Icon: Moon }
}
const TOD = timeOfDay()

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-2 px-0.5">{children}</div>
}

const AGENT_COLORS: Record<string, string> = {
  "lil-claw": "#1ea84e",
  goop:       "#1490b8",
  mason:      "#5828c8",
}

export default function DashboardPage() {
  const { state, error, loading, refetch } = useDashboardApi(7000)
  const gold = state?.router?.total_cost_usd ?? 0

  const today       = new Date().toISOString().slice(0, 10)
  const todayCost   = state?.router_usage?.by_day?.[today]?.cost_usd ?? 0
  const totalDone   = AGENTS.reduce((s, a) => s + (state?.agents?.[a]?.outbox_count ?? 0), 0)
  const totalActive = AGENTS.reduce((s, a) => s + (state?.agents?.[a]?.working_count ?? 0), 0)
  const totalInbox  = AGENTS.reduce((s, a) => s + (state?.agents?.[a]?.inbox_count ?? 0), 0)

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
            <div className="relative">
              <PixelGuild
                agents={state?.agents ?? null}
                taskDetails={state?.task_details ?? null}
                height={280}
              />
              {/* atmospheric vignette — darkens the green foreground so it reads as night, not empty patch */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#0c0808e6] via-[#0c080866] to-transparent" />
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

              {/* Model roster */}
              <div>
                <div className="font-code text-[9px] text-[var(--muted-foreground)] mb-2">// model roster</div>
                <div className="space-y-2">
                  {([
                    { id: "lil-claw", model: "MiniMax-M3" },
                    { id: "goop",     model: "MiniMax-M3" },
                    { id: "mason",    model: "Sonnet 4.6"  },
                  ] as const).map((a) => (
                    <div key={a.id} className="flex items-center justify-between">
                      <span className="font-code text-[10px] font-bold" style={{ color: AGENT_COLORS[a.id] }}>
                        {a.id}
                      </span>
                      <span className="font-code text-[9px] px-1.5 py-0.5 rounded bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)]">
                        {a.model}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── The Exchange (A2A coordination) ─────────────────────────────── */}
        <section className="fade-rise">
          <Eyebrow>The Exchange</Eyebrow>
          <CoordinationCard taskDetails={state?.task_details ?? null} isLoading={loading} />
        </section>

        {/* ── The Ledger ──────────────────────────────────────────────────── */}
        <section className="fade-rise">
          <Eyebrow>The Ledger</Eyebrow>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RouterStatsCard data={state?.router ?? null} isLoading={loading} />
            <TokenBurnCard usage={state?.router_usage ?? null} isLoading={loading} />
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
