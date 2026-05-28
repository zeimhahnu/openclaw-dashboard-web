"use client"

import { useState } from "react"
import { Zap, ChevronDown, ChevronRight, Send, Swords } from "lucide-react"
import type { TaskSummary, AgentTaskDetails } from "@/hooks/useDashboardApi"

interface TaskActivityCardProps {
  tasks:       Record<string, { active: string[]; inbox: string[] }> | null
  taskDetails: Record<string, AgentTaskDetails> | null
  isLoading:   boolean
}

const AGENT_COLORS: Record<string, string> = {
  "lil-claw": "#00ff88",
  goop:       "#00d4ff",
  mason:      "#a78bfa",
}

function QuestRankBadge({ priority }: { priority: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    high:   { cls: "text-[#ff4444] border-[#ff4444]/40 bg-[#ff4444]/10", label: "HIGH" },
    medium: { cls: "text-[#f59e0b] border-[#f59e0b]/40 bg-[#f59e0b]/10", label: "MED"  },
    low:    { cls: "text-[#4a7a4a] border-[#4a7a4a]/40",                  label: "LOW"  },
  }
  const s = map[priority?.toLowerCase()] ?? {
    cls: "text-[var(--muted-foreground)] border-[var(--border)]",
    label: priority || "?",
  }
  return (
    <span className={`font-pixel text-[7px] px-1 border rounded shrink-0 ${s.cls}`}>
      {s.label}
    </span>
  )
}

function RichQuestList({ items }: { items: TaskSummary[]; accentColor?: string }) {
  if (items.length === 0) {
    return <p className="font-code text-[10px] text-[var(--muted-foreground)] pl-1">{/* empty */}</p>
  }
  return (
    <div className="space-y-1">
      {items.slice(0, 8).map((t) => (
        <div key={t.id} className="border border-[var(--border)] rounded p-1.5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <QuestRankBadge priority={t.priority} />
            <span className="font-code text-[9px] text-[var(--muted-foreground)] truncate flex-1">
              {t.id}
            </span>
            {t.assignedBy && (
              <span className="font-code text-[8px] text-[var(--muted-foreground)] shrink-0 opacity-60">
                by:{t.assignedBy}
              </span>
            )}
          </div>
          {t.description && (
            <p className="font-code text-[10px] text-[var(--foreground)] opacity-60 leading-tight line-clamp-2">
              {t.description.length > 100 ? t.description.substring(0, 100) + "…" : t.description}
            </p>
          )}
        </div>
      ))}
      {items.length > 8 && (
        <p className="font-code text-[10px] text-[var(--muted-foreground)] pl-1">
          +{items.length - 8} more
        </p>
      )}
    </div>
  )
}

function SimpleQuestList({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <p className="font-code text-[10px] text-[var(--muted-foreground)] pl-1">{/* empty */}</p>
  }
  return (
    <div className="space-y-1">
      {names.slice(0, 8).map((name) => (
        <div key={name} className="flex items-center gap-1.5 py-0.5">
          <Zap className="h-2.5 w-2.5 text-[#00ff88] shrink-0" />
          <span className="font-code text-[10px] text-[var(--foreground)] opacity-70 truncate">
            {name.replace(/\.json$/, "")}
          </span>
        </div>
      ))}
      {names.length > 8 && (
        <p className="font-code text-[10px] text-[var(--muted-foreground)]">+{names.length - 8} more</p>
      )}
    </div>
  )
}

export function TaskActivityCard({ tasks, taskDetails, isLoading }: TaskActivityCardProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4">
        <p className="font-code text-xs text-[var(--muted-foreground)]">{/* loading... */}</p>
      </div>
    )
  }

  if (!tasks && !taskDetails) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="font-pixel text-[8px]">QUEST PIPELINE</span>
        </div>
        <p className="font-code text-xs text-[var(--muted-foreground)]">{/* no active quests */}</p>
      </div>
    )
  }

  const allAgents = [
    ...new Set([
      ...Object.keys(tasks ?? {}),
      ...Object.keys(taskDetails ?? {}),
    ]),
  ]

  const totalActive  = allAgents.reduce((s, a) => s + (tasks?.[a]?.active?.length ?? 0), 0)
  const totalInbox   = allAgents.reduce(
    (s, a) => s + (taskDetails?.[a]?.inbox?.length ?? tasks?.[a]?.inbox?.length ?? 0), 0
  )
  const totalOutbox  = allAgents.reduce((s, a) => s + (taskDetails?.[a]?.outbox?.length ?? 0), 0)

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[#00d4ff] rounded p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-3">
        <Swords className="h-4 w-4 text-[#00d4ff]" />
        <span className="font-pixel text-[8px]" style={{ color: "#00d4ff" }}>QUEST PIPELINE</span>
        <div className="ml-auto flex items-center gap-3">
          {totalActive > 0 && (
            <span className="font-code text-xs text-[#00ff88]">{totalActive} in battle</span>
          )}
          {totalInbox > 0 && (
            <span className="font-code text-xs text-[#f59e0b]">{totalInbox} queued</span>
          )}
          {totalOutbox > 0 && (
            <span className="font-code text-xs text-[var(--muted-foreground)]">{totalOutbox} complete</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {allAgents.map((agent) => {
          const active      = tasks?.[agent]?.active ?? []
          const richInbox   = taskDetails?.[agent]?.inbox ?? []
          const richOutbox  = taskDetails?.[agent]?.outbox ?? []
          const fallbackInbox = tasks?.[agent]?.inbox ?? []
          const hasAnything = active.length > 0 || richInbox.length > 0 || richOutbox.length > 0 || fallbackInbox.length > 0
          if (!hasAnything) return null

          const isOpen     = expandedAgent === agent
          const color      = AGENT_COLORS[agent] ?? "#4a7a4a"
          const inboxCount = richInbox.length || fallbackInbox.length

          return (
            <div key={agent} className="border border-[var(--border)] rounded">
              <button
                onClick={() => setExpandedAgent(isOpen ? null : agent)}
                className="flex items-center justify-between w-full text-left px-3 py-2 hover:bg-[var(--muted)] transition-colors cursor-pointer rounded"
              >
                <div className="flex items-center gap-2">
                  {isOpen
                    ? <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
                    : <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />
                  }
                  <span className="font-pixel text-[7px]" style={{ color }}>{agent}</span>
                </div>
                <div className="flex items-center gap-2">
                  {active.length > 0 && (
                    <span className="font-code text-[10px] text-[#00ff88]">{active.length} active</span>
                  )}
                  {inboxCount > 0 && (
                    <span className="font-code text-[10px] text-[#f59e0b]">{inboxCount} queued</span>
                  )}
                  {richOutbox.length > 0 && (
                    <span className="font-code text-[10px] text-[var(--muted-foreground)]">
                      {richOutbox.length} done
                    </span>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 border-t border-[var(--border)] pt-2 space-y-3">
                  {active.length > 0 && (
                    <div>
                      <div className="font-pixel text-[7px] text-[#00ff88] mb-1">IN BATTLE</div>
                      <SimpleQuestList names={active} />
                    </div>
                  )}

                  {(richInbox.length > 0 || fallbackInbox.length > 0) && (
                    <div>
                      <div className="font-pixel text-[7px] text-[#f59e0b] mb-1">QUEUED</div>
                      {richInbox.length > 0
                        ? <RichQuestList items={richInbox} accentColor={color} />
                        : <SimpleQuestList names={fallbackInbox} />
                      }
                    </div>
                  )}

                  {richOutbox.length > 0 && (
                    <div>
                      <div className="font-pixel text-[7px] text-[var(--muted-foreground)] mb-1 flex items-center gap-1">
                        <Send className="h-2.5 w-2.5" />
                        DELIVERED
                      </div>
                      <RichQuestList items={richOutbox} accentColor={color} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
