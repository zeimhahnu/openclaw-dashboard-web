"use client"

import { useId, useState } from "react"
import { Activity, Inbox, Send, Zap, ChevronDown, ChevronRight } from "lucide-react"

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
  "lil-claw": "lil-claw",
  goop: "goop",
  mason: "mason",
}

const AGENT_COLORS: Record<string, string> = {
  "lil-claw": "text-[#00ff88]",
  goop: "text-[#00d4ff]",
  mason: "text-[#a78bfa]",
}

const AGENT_ACCENTS: Record<string, string> = {
  "lil-claw": "border-l-[4px] border-l-[#00ff88]",
  goop: "border-l-[4px] border-l-[#00d4ff]",
  mason: "border-l-[4px] border-l-[#a78bfa]",
}

function AgentPIDHeader({ agentName, working }: { agentName: string; working: boolean }) {
  // Stable ID derived from React's useId — deterministic per component instance.
  const pid = useId().replace(/:/g, "").slice(0, 5)
  const pidNum = parseInt(pid, 16) % 90000 + 10000
  const status = working ? "ACTIVE" : "IDLE"
  const color = working ? "text-[#00ff88]" : "text-[#64748b]"

  return (
    <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-3">
      <span className="font-code text-xs text-[var(--muted-foreground)]">[</span>
      <span className="font-code text-sm font-semibold text-[var(--foreground)]">{AGENT_LABELS[agentName] || agentName}</span>
      <span className="font-code text-xs text-[var(--muted-foreground)]">]</span>
      <span className="font-code text-xs text-[var(--muted-foreground)]">PID:{pidNum}</span>
      <span className={`ml-auto font-code text-xs font-semibold ${color} ${working ? "text-glow" : ""}`}>
        {status}
      </span>
    </div>
  )
}

function StatRow({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </span>
      <span className={`font-code text-sm ${accent && value > 0 ? "text-[#00ff88] text-glow" : "text-[var(--muted-foreground)]"}`}>
        {value}
      </span>
    </div>
  )
}

export function AgentStatusCard({ agentName, data, isLoading }: AgentStatusCardProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4 animate-pulse">
        <div className="h-4 bg-[var(--muted)] rounded w-32 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-[var(--muted)] rounded w-full" />
          ))}
        </div>
      </div>
    )
  }

  const isWorking = data.working_count > 0
  const accentClass = AGENT_ACCENTS[agentName] ?? "border-l-[4px] border-l-[#00ff88]"

  return (
    <div className={`bg-[var(--card)] border border-[var(--border)] rounded p-4 ${accentClass}`}>
      <AgentPIDHeader agentName={agentName} working={isWorking} />

      <div className="space-y-0">
        <StatRow icon={Inbox} label="inbox" value={data.inbox_count} accent={data.inbox_count > 0} />
        <StatRow icon={Send} label="outbox" value={data.outbox_count} />
      </div>

      {data.inbox_count > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-[#f59e0b]" />
          <span className="font-code text-xs text-[#f59e0b]">{data.inbox_count} pending</span>
        </div>
      )}
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
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4 animate-pulse">
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
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="font-semibold text-sm">WAL Activity</span>
        </div>
        <p className="text-xs font-code text-[var(--muted-foreground)]">{"// no recent entries"}</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4">
      <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-3">
        <Activity className="h-4 w-4 text-[#00ff88]" />
        <span className="font-code text-sm font-semibold">WAL Activity</span>
        <span className="ml-auto font-code text-xs text-[var(--muted-foreground)]">
          {agentNames.length} agents
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {agentNames.map((agent) => {
          const entries = walTails[agent] || []
          const isOpen = expandedAgent === agent
          const label = AGENT_LABELS[agent] || agent
          const agentColor = AGENT_COLORS[agent] || "text-gray-400"

          return (
            <div key={agent} className="border border-[var(--border)] rounded p-2">
              <button
                onClick={() => setExpandedAgent(isOpen ? null : agent)}
                className="flex items-center justify-between w-full text-left hover:bg-[var(--muted)] rounded px-1 -mx-1 py-1 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {isOpen
                    ? <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
                    : <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />
                  }
                  <span className={`font-code text-xs font-semibold ${agentColor}`}>{label}</span>
                </div>
                <span className="font-code text-xs text-[var(--muted-foreground)]">
                  {entries.length} entries
                </span>
              </button>
              {isOpen && (
                <div className="mt-2 pl-4 border-l border-[var(--border)] space-y-1.5">
                  {entries.slice(0, 12).map((entry, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="font-code text-xs text-[var(--muted-foreground)] shrink-0">
                        {String(i + 1).padStart(2, "0")}&gt;
                      </span>
                      <p className="font-code text-xs text-[var(--muted-foreground)] leading-relaxed">
                        {entry.substring(0, 140)}
                        {entry.length > 140 ? "\u2026" : ""}
                      </p>
                    </div>
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