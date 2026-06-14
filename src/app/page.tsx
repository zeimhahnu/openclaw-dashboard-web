"use client"

import { useDashboardApi } from "@/hooks/useDashboardApi"
import { AgentStatusCard, ActivityFeed } from "@/components/AgentStatusCard"
import { RouterStatsCard } from "@/components/RouterStatsCard"
import { TokenBurnCard } from "@/components/TokenBurnCard"
import { TaskActivityCard } from "@/components/TaskActivityCard"
import PixelGuild from "@/components/PixelGuild"
import { QuestPanel } from "@/components/QuestPanel"
import { RefreshCw, AlertCircle, Terminal } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

const AGENTS = ["lil-claw", "goop", "mason"] as const

export default function DashboardPage() {
  const { state, error, loading, refetch } = useDashboardApi(7000)

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">

      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded p-1.5">
              <Terminal className="h-4 w-4 text-[#00ff88]" />
            </div>
            <div>
              <h1 className="font-pixel text-[10px] tracking-tight text-glow">
                OPENCLAW<span className="cursor-blink text-[#00ff88] ml-0.5">_</span>
              </h1>
              <p className="font-code text-[10px] text-[var(--muted-foreground)] mt-0.5">
                fortress of persistent memory · ops terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {state && (
              <span className="font-code text-[10px] text-[var(--muted-foreground)] hidden sm:block">
                {formatRelativeTime(state.ts)}
              </span>
            )}
            <span className={`font-code text-[10px] px-2 py-1 rounded border ${
              loading ? "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"
              : error  ? "bg-[#ff4444]/10 text-[#ff4444] border-[#ff4444]/30"
              : "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30"
            }`}>
              {loading ? "INIT" : error ? "ERR" : "LIVE"}
            </span>
            <button onClick={refetch}
              className="p-1.5 rounded border border-[var(--border)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
              aria-label="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 text-[var(--muted-foreground)] ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-[1400px] mx-auto px-4 pt-2">
          <div className="flex items-center gap-2 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded px-3 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-[#ff4444] shrink-0" />
            <span className="font-code text-xs text-[#ff4444]">ERR: api_unreachable · {error} · retrying…</span>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 py-3 space-y-3">

        {/* Row 0: The Guild — full-width pixel scene */}
        <PixelGuild
          agents={state?.agents ?? null}
          taskDetails={state?.task_details ?? null}
          height={240}
        />

        {/* Row 1: Agent character sheets + quest log — 4 equal columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {AGENTS.map((agent) => (
            <AgentStatusCard
              key={agent}
              agentName={agent}
              data={state?.agents?.[agent] ?? null}
              taskDetails={state?.task_details?.[agent] ?? null}
              isLoading={loading}
            />
          ))}
          <QuestPanel
            taskDetails={state?.task_details ?? null}
            isLoading={loading}
          />
        </div>

        {/* Row 2: Infrastructure + pipeline — 3 columns, no orphan rows */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RouterStatsCard data={state?.router ?? null} isLoading={loading} />
          <TokenBurnCard usage={state?.router_usage ?? null} isLoading={loading} />
          <TaskActivityCard
            tasks={state?.tasks ?? null}
            taskDetails={state?.task_details ?? null}
            isLoading={loading}
          />
        </div>

        {/* Row 3: Battle log — full width, compact */}
        <ActivityFeed walTails={state?.wal_tails ?? null} isLoading={loading} />

        {/* Footer */}
        <div className="border-t border-[var(--border)] pt-2 pb-1 flex items-center justify-between">
          <p className="font-code text-[9px] text-[var(--muted-foreground)]/60">
            polling :8443 · 7s · {state ? formatRelativeTime(state.ts) : "--"}
          </p>
          <p className="font-code text-[9px] text-[var(--muted-foreground)]/60">
            <span style={{ color: "var(--pixel-gold)" }}>◈</span>
            {" "}{(state?.router?.total_cost_usd ?? 0).toFixed(4)} gold spent
          </p>
        </div>

      </div>
    </main>
  )
}
