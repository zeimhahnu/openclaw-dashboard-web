"use client"

import { useDashboardApi } from "@/hooks/useDashboardApi"
import { AgentStatusCard, ActivityFeed } from "@/components/AgentStatusCard"
import { RouterStatsCard } from "@/components/RouterStatsCard"
import { RefreshCw, AlertCircle, Terminal } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

export default function DashboardPage() {
  const { state, error, loading, refetch } = useDashboardApi(7000)

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative">
      {/* Scanline overlay */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
        }}
      />

      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded p-1.5">
              <Terminal className="h-5 w-5 text-[#00ff88]" />
            </div>
            <div>
              <h1 className="font-code text-lg font-semibold tracking-tight text-glow">
                OpenClaw Dashboard
              </h1>
              <p className="font-code text-xs text-[var(--muted-foreground)] mt-0.5">
                <span className="text-[#00d4ff]">{"//"}</span> sprint_9 · s7-a_observability
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {state && (
              <div className="text-right">
                <span className="font-code text-xs text-[var(--muted-foreground)]">
                  last_update: {formatRelativeTime(state.ts)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-code text-xs px-2 py-1 rounded bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30">
                {loading ? "LOADING" : "LIVE"}
              </span>
              <button
                onClick={refetch}
                className="p-2 rounded border border-[var(--border)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
                aria-label="Refresh dashboard"
              >
                <RefreshCw className={`h-4 w-4 text-[var(--muted-foreground)] ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-3 relative z-10">
          <div className="flex items-center gap-2 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded px-4 py-2">
            <AlertCircle className="h-4 w-4 text-[#ef4444] shrink-0" />
            <span className="font-code text-sm text-[#ef4444]">
              ERR: api_unreachable · {error} · retrying...
            </span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Agent Status Cards */}
          <AgentStatusCard
            agentName="lil-claw"
            data={state?.agents?.["lil-claw"] ?? null}
            isLoading={loading}
          />
          <AgentStatusCard
            agentName="goop"
            data={state?.agents?.["goop"] ?? null}
            isLoading={loading}
          />
          <AgentStatusCard
            agentName="mason"
            data={state?.agents?.["mason"] ?? null}
            isLoading={loading}
          />

          {/* Router Stats */}
          <RouterStatsCard data={state?.router ?? null} isLoading={loading} />

          {/* Activity Feed */}
          <div className="md:col-span-2 lg:col-span-2">
            <ActivityFeed walTails={state?.wal_tails ?? null} isLoading={loading} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[var(--border)] text-center">
          <p className="font-code text-xs text-[var(--muted-foreground)]">
            <span className="text-[#00ff88]">openclaw</span>
            <span className="text-[var(--muted-foreground)]"> · </span>
            <span>dashboard_v1.0</span>
            <span className="text-[var(--muted-foreground)]"> · </span>
            <span>Adaptive Router + WAL Telemetry</span>
          </p>
        </div>
      </div>
    </main>
  )
}