"use client"

import { useState } from "react"
import { Info, Zap, ChevronDown, ChevronRight, Send, Sprout } from "lucide-react"
import type { TaskSummary, AgentTaskDetails } from "@/hooks/useDashboardApi"

interface TaskActivityCardProps {
  tasks:       Record<string, { active: string[]; inbox: string[] }> | null
  taskDetails: Record<string, AgentTaskDetails> | null
  isLoading:   boolean
}

const AGENT_COLORS: Record<string, string> = {
  "lil-claw": "#5ec27e",
  goop:       "#52b8d0",
  mason:      "#9b87f0",
}

function ChoreRankBadge({ priority, kind }: { priority: string; kind?: "queued" | "tending" | "done" }) {
  // For shipped ("done") rows the priority field is almost always empty
  // (outbox tasks rarely carry one), so the old `priority || "?"` fallback
  // rendered a literal "?" on every shipped row. "?" read as a broken badge
  // rather than as a status — so when we're in done-land we substitute
  // "DONE" and a muted style regardless of any stale priority value.
  if (kind === "done") {
    return (
      <span className="font-pixel text-[7px] px-1 border rounded shrink-0 text-[var(--muted-foreground)] border-[var(--border)] bg-[var(--muted)]">
        DONE
      </span>
    )
  }
  const map: Record<string, { cls: string; label: string }> = {
    high:   { cls: "text-[#c45a3a] border-[#c45a3a]/40 bg-[#c45a3a]/10", label: "URGENT" },
    medium: { cls: "text-[#e8a935] border-[#e8a935]/40 bg-[#e8a935]/10", label: "SOON"  },
    low:    { cls: "text-[#7aad5a] border-[#7aad5a]/40",                  label: "IDLE"  },
  }
  if (priority) {
    const s = map[priority.toLowerCase()] ?? {
      cls: "text-[var(--muted-foreground)] border-[var(--border)]",
      label: priority,
    }
    return (
      <span className={`font-pixel text-[7px] px-1 border rounded shrink-0 ${s.cls}`}>
        {s.label}
      </span>
    )
  }
  // Empty priority on a queued/tending row: fall back to a neutral "WAITING"
  // tag rather than a misleading "?".
  return (
    <span className="font-pixel text-[7px] px-1 border rounded shrink-0 text-[var(--muted-foreground)] border-[var(--border)]">
      WAITING
    </span>
  )
}

function RichChoreList({ items, kind }: { items: TaskSummary[]; kind: "queued" | "tending" | "done" }) {
  if (items.length === 0) {
    return <p className="font-code text-[10px] text-[var(--muted-foreground)] pl-1">{"// empty row"}</p>
  }
  return (
    <div className="space-y-1">
      {items.slice(0, 8).map((t) => (
        <div key={t.id} className="border border-[var(--border)] rounded p-1.5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <ChoreRankBadge priority={t.priority} kind={kind} />
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

function SimpleChoreList({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <p className="font-code text-[10px] text-[var(--muted-foreground)] pl-1">{"// empty row"}</p>
  }
  return (
    <div className="space-y-1">
      {names.slice(0, 8).map((name) => (
        <div key={name} className="flex items-center gap-1.5 py-0.5">
          <Zap className="h-2.5 w-2.5 text-[var(--secondary)] shrink-0" />
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
  // Auto-expand first agent that has tasks (Bug 1 fix: chore board was empty because accordion was collapsed)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(() => {
    if (!taskDetails && !tasks) return null
    const allAgents = [...new Set([...Object.keys(taskDetails ?? {}), ...Object.keys(tasks ?? {})])]
    for (const a of allAgents) {
      const hasTasks = (taskDetails?.[a]?.inbox?.length ?? 0) > 0
        || (taskDetails?.[a]?.outbox?.length ?? 0) > 0
        || (tasks?.[a]?.active?.length ?? 0) > 0
        || (tasks?.[a]?.inbox?.length ?? 0) > 0
      if (hasTasks) return a
    }
    return null
  })

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
          <Sprout className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="font-pixel text-[8px]">CHORE BOARD</span>
        </div>
        <p className="font-code text-xs text-[var(--muted-foreground)]">{"// the board is empty today"}</p>
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
    <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[var(--agent-goop)] rounded p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-3">
        <Sprout className="h-4 w-4 text-[var(--primary)]" />
        <span className="font-pixel text-[8px] text-[var(--primary)]">CHORE BOARD</span>
        <div className="ml-auto flex items-center gap-3">
          {totalActive > 0 && (
            <span className="font-code text-xs text-[#7aad5a]">{totalActive} tending</span>
          )}
          {totalInbox > 0 && (
            <span className="font-code text-xs text-[#e8a935]">{totalInbox} queued</span>
          )}
          {totalOutbox > 0 && (
            <span className="font-code text-xs text-[var(--muted-foreground)]">{totalOutbox} shipped</span>
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
          const color      = AGENT_COLORS[agent] ?? "#7aad5a"
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
                    <span className="font-code text-[10px] text-[#7aad5a]">{active.length} tending</span>
                  )}
                  {inboxCount > 0 && (
                    <span className="font-code text-[10px] text-[#e8a935]">{inboxCount} queued</span>
                  )}
                  {richOutbox.length > 0 && (
                    <span className="font-code text-[10px] text-[var(--muted-foreground)]">
                      {richOutbox.length} shipped
                    </span>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 border-t border-[var(--border)] pt-2 space-y-3">
                  {active.length > 0 && (
                    <div>
                      <div className="font-pixel text-[7px] text-[#7aad5a] mb-1">TENDING</div>
                      <SimpleChoreList names={active} />
                    </div>
                  )}

                  {(richInbox.length > 0 || fallbackInbox.length > 0) && (
                    <div>
                      <div className="font-pixel text-[7px] text-[#e8a935] mb-1">QUEUED</div>
                      {richInbox.length > 0
                        ? <RichChoreList items={richInbox} kind="queued" />
                        : <SimpleChoreList names={fallbackInbox} />
                      }
                    </div>
                  )}

                  {richOutbox.length > 0 && (
                    <div>
                      <div className="font-pixel text-[7px] text-[var(--muted-foreground)] mb-1 flex items-center gap-1">
                        <Send className="h-2.5 w-2.5" />
                        SHIPPED
                      </div>
                      <RichChoreList items={richOutbox} kind="done" />
                    </div>
                  )}

                  {/* Mason local-only note (Bug 4) */}
                  {agent === "mason" && (
                    <div className="flex items-start gap-1.5 px-2 py-1.5 mt-1 rounded border border-[#9b87f0]/30 bg-[#9b87f0]/5">
                      <Info className="h-3 w-3 text-[#9b87f0] shrink-0 mt-0.5" />
                      <p className="font-code text-[8px] text-[#9b87f0] leading-snug">
                        Mason runs locally — VPS shows inbox/outbox only. Full task sync when Mode II daemon ships.
                      </p>
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
