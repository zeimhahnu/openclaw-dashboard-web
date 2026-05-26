"use client"

import { useDashboardApi } from "@/hooks/useDashboardApi"
import { AgentStatusCard, ActivityFeed } from "@/components/AgentStatusCard"
import { RouterStatsCard } from "@/components/RouterStatsCard"
import { RefreshCw, AlertCircle } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

export default function DashboardPage() {
  const { state, error, loading, refetch } = useDashboardApi(7000)

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">OpenClaw Dashboard</h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Sprint 9 &mdash; S7-A Observability
            </p>
          </div>
          <div className="flex items-center gap-3">
            {state && (
              <span className="text-xs text-[var(--muted-foreground)]">
                Updated {formatRelativeTime(state.ts)}
              </span>
            )}
            <button
              onClick={refetch}
              className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-2 bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-lg px-4 py-2 text-sm text-[var(--destructive)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>API unreachable: {error}. Retrying…</span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
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

        {/* Footer note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[var(--muted-foreground)]">
            Polling every 7s &bull; Source: Dashboard API (port 8443)
          </p>
        </div>
      </div>
    </main>
  )
}