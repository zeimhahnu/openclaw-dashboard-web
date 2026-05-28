"use client"

import { useDashboardApi } from "@/hooks/useDashboardApi"
import { AgentStatusCard, ActivityFeed } from "@/components/AgentStatusCard"
import { RouterStatsCard } from "@/components/RouterStatsCard"
import { RouterUsageCard } from "@/components/RouterUsageCard"
import { TaskActivityCard } from "@/components/TaskActivityCard"
import { GuildWorld } from "@/components/GuildWorld"
import { QuestPanel } from "@/components/QuestPanel"
import { RefreshCw, AlertCircle, Terminal } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

const AGENTS = ["lil-claw", "goop", "mason"] as const

export default function DashboardPage() {
  const { state, error, loading, refetch } = useDashboardApi(7000)

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative">

      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded p-1.5">
              <Terminal className="h-5 w-5 text-[#00ff88]" />
            </div>
            <div>
              <h1 className="font-pixel text-[11px] tracking-tight text-glow">
                OPENCLAW<span className="cursor-blink text-[#00ff88] ml-0.5">_</span>
              </h1>
              <p className="font-code text-xs text-[var(--muted-foreground)] mt-0.5">
                agent world · ops terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {state && (
              <span className="font-code text-xs text-[var(--muted-foreground)] hidden sm:block">
                last_sync: {formatRelativeTime(state.ts)}
              </span>
            )}
            <div className="flex items-center gap-2">
              <span
                className={`font-code text-xs px-2 py-1 rounded border ${
                  loading
                    ? "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"
                    : error
                    ? "bg-[#ff4444]/10 text-[#ff4444] border-[#ff4444]/30"
                    : "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30"
                }`}
              >
                {loading ? "INIT" : error ? "ERR" : "LIVE"}
              </span>
              <button
                onClick={refetch}
                className="p-2 rounded border border-[var(--border)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
                aria-label="Refresh dashboard"
              >
                <RefreshCw
                  className={`h-4 w-4 text-[var(--muted-foreground)] ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-2 relative z-10">
          <div className="flex items-center gap-2 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded px-4 py-2">
            <AlertCircle className="h-4 w-4 text-[#ff4444] shrink-0" />
            <span className="font-code text-sm text-[#ff4444]">
              ERR: api_unreachable · {error} · retrying…
            </span>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 py-4 relative z-10 space-y-3">

        {/* Row 0: The Guild — living world (camp + battlefield) + quest log */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
          <GuildWorld
            agents={state?.agents ?? null}
            taskDetails={state?.task_details ?? null}
          />
          <QuestPanel
            taskDetails={state?.task_details ?? null}
            isLoading={loading}
          />
        </div>

        {/* Row 1: Agent character sheets (stats + drawers) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {AGENTS.map((agent) => (
            <AgentStatusCard
              key={agent}
              agentName={agent}
              data={state?.agents?.[agent] ?? null}
              taskDetails={state?.task_details?.[agent] ?? null}
              isLoading={loading}
            />
          ))}
        </div>

        {/* Row 2: Router telemetry */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RouterStatsCard data={state?.router ?? null} isLoading={loading} />
          <RouterUsageCard usage={state?.router_usage ?? null} isLoading={loading} />
        </div>

        {/* Row 3: Quest pipeline */}
        <TaskActivityCard
          tasks={state?.tasks ?? null}
          taskDetails={state?.task_details ?? null}
          isLoading={loading}
        />

        {/* Row 4: Battle log */}
        <ActivityFeed walTails={state?.wal_tails ?? null} isLoading={loading} />

        {/* Footer */}
        <div className="pt-4 border-t border-[var(--border)] text-center">
          <p className="font-code text-xs text-[var(--muted-foreground)]">
            {">"} polling :8443 · 7s interval
            {"  ·  "}
            {state ? formatRelativeTime(state.ts) : "--"}
            {"  ·  "}
            <span style={{ color: "var(--pixel-gold)" }}>◈</span>
            {" "}{(state?.router?.total_cost_usd ?? 0).toFixed(4)} gold spent
          </p>
        </div>
      </div>
    </main>
  )
}
