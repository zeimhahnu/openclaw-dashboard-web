"use client"

import { useState } from "react"
import { Activity, AlertCircle, CheckCircle2, Inbox, Send, Zap } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

interface AgentStatusCardProps {
  agentName: string
  data: {
    inbox_count: number
    working_count: number
    outbox_count: number
  } | null
  isLoading: boolean
}

const AGENT_LABELS: Record<string, string> = {
  "lil-claw": "Lil Claw",
  goop: "Goop",
  mason: "Mason",
}

const AGENT_COLORS: Record<string, string> = {
  "lil-claw": "text-indigo-400",
  goop: "text-cyan-400",
  mason: "text-emerald-400",
}

export function AgentStatusCard({ agentName, data, isLoading }: AgentStatusCardProps) {
  const label = AGENT_LABELS[agentName] || agentName
  const colorClass = AGENT_COLORS[agentName] || "text-gray-400"

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-[var(--muted)] rounded w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-[var(--muted)] rounded w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className={`h-4 w-4 ${colorClass}`} />
        <span className="font-semibold text-sm">{label}</span>
        <span className="ml-auto">
          {data.working_count > 0 ? (
            <span className="flex items-center gap-1 text-xs text-[var(--warning)]">
              <Zap className="h-3 w-3" /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
              <CheckCircle2 className="h-3 w-3" /> Idle
            </span>
          )}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
            <Inbox className="h-3 w-3" /> Inbox
          </span>
          <span className={data.inbox_count > 0 ? "text-[var(--warning)] font-medium" : "text-[var(--muted-foreground)]"}>
            {data.inbox_count}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
            <Send className="h-3 w-3" /> Outbox
          </span>
          <span className="text-[var(--muted-foreground)]">{data.outbox_count}</span>
        </div>
      </div>
    </div>
  )
}

interface ActivityFeedProps {
  walTails: Record<string, string[]> | null
  isLoading: boolean
}

export function ActivityFeed({ walTails, isLoading }: ActivityFeedProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  if (isLoading || !walTails) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-[var(--muted)] rounded w-20 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-[var(--muted)] rounded w-full" />
          ))}
        </div>
      </div>
    )
  }

  const agentNames = Object.keys(walTails)
  if (agentNames.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="font-semibold text-sm">Activity Feed</span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-[var(--primary)]" />
        <span className="font-semibold text-sm">Activity Feed</span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {agentNames.map((agent) => {
          const entries = walTails[agent] || []
          const isOpen = expandedAgent === agent
          const label = AGENT_LABELS[agent] || agent
          const colorClass = AGENT_COLORS[agent] || "text-gray-400"

          return (
            <div key={agent} className="border-b border-[var(--border)] last:border-0 pb-2 last:pb-0">
              <button
                onClick={() => setExpandedAgent(isOpen ? null : agent)}
                className="flex items-center justify-between w-full text-left py-1 hover:bg-[var(--muted)] rounded px-1 -mx-1 transition-colors"
              >
                <span className={`text-xs font-medium ${colorClass}`}>{label}</span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </span>
              </button>
              {isOpen && (
                <div className="mt-1 pl-2 border-l-2 border-[var(--primary)] space-y-1">
                  {entries.slice(0, 10).map((entry, i) => (
                    <p key={i} className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                      {entry.substring(0, 120)}
                      {entry.length > 120 ? "…" : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}