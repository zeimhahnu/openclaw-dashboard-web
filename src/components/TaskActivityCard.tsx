"use client"

import { useState } from "react"
import { Inbox, Zap, Terminal } from "lucide-react"

interface TaskActivityCardProps {
  tasks: Record<string, { active: string[]; inbox: string[] }> | null
  isLoading: boolean
}

function TaskChip({ name, accent }: { name: string; accent: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 font-code text-[10px] px-1.5 py-0.5 rounded border " +
        (accent
          ? "bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]"
          : "bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground]")
      }
    >
      {accent && <Zap className="h-2.5 w-2.5" />}
      {name.length > 28 ? name.substring(0, 28) + "\u2026" : name}
    </span>
  )
}

export function TaskActivityCard({ tasks, isLoading }: TaskActivityCardProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  if (isLoading || !tasks) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4 animate-pulse">
        <div className="h-4 bg-[var(--muted)] rounded w-28 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-[var(--muted)] rounded w-full" />
          ))}
        </div>
      </div>
    )
  }

  const agents = Object.keys(tasks)
  if (agents.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="font-semibold text-sm">Task Activity</span>
        </div>
        <p className="font-code text-xs text-[var(--muted-foreground)]">{"// no active tasks"}</p>
      </div>
    )
  }

  const totalActive = agents.reduce((sum, a) => sum + (tasks[a]?.active.length ?? 0), 0)
  const totalInbox = agents.reduce((sum, a) => sum + (tasks[a]?.inbox.length ?? 0), 0)

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded p-4 border-accent-left">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-3">
        <Inbox className="h-4 w-4 text-[#00d4ff]" />
        <span className="font-code text-sm font-semibold">task_activity</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-code text-xs text-[#00ff88]">{totalActive} active</span>
          <span className="font-code text-xs text-[#f59e0b]">{totalInbox} pending</span>
        </div>
      </div>

      <div className="space-y-2">
        {agents
          .filter((a) => (tasks[a]?.active.length ?? 0) > 0 || (tasks[a]?.inbox.length ?? 0) > 0)
          .map((agent) => {
            const { active, inbox } = tasks[agent] ?? { active: [], inbox: [] }
            const isOpen = expandedAgent === agent
            return (
              <div key={agent} className="border border-[var(--border)] rounded">
                <button
                  onClick={() => setExpandedAgent(isOpen ? null : agent)}
                  className="flex items-center justify-between w-full text-left px-3 py-2 hover:bg-[var(--muted)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <svg className="h-3 w-3 text-[var(--muted-foreground)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M1 4h10M4 1l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3 text-[var(--muted-foreground)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M1 4h10M7 1l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span className="font-code text-xs font-semibold">{agent}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {active.length > 0 && (
                      <span className="font-code text-[10px] text-[#00ff88]">{active.length} active</span>
                    )}
                    {inbox.length > 0 && (
                      <span className="font-code text-[10px] text-[#f59e0b]">{inbox.length} inbox</span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 border-t border-[var(--border)] pt-2">
                    {inbox.length > 0 && (
                      <>
                        <div className="font-code text-[10px] text-[#f59e0b] mb-1.5">pending_inbox</div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {inbox.slice(0, 20).map((t) => (
                            <TaskChip key={t} name={t} accent={true} />
                          ))}
                          {inbox.length > 20 && (
                            <span className="font-code text-[10px] text-[var(--muted-foreground)]">
                              +{inbox.length - 20} more
                            </span>
                          )}
                        </div>
                      </>
                    )}
                    {active.length > 0 && (
                      <>
                        <div className="font-code text-[10px] text-[#00ff88] mb-1.5">working</div>
                        <div className="flex flex-wrap gap-1.5">
                          {active.slice(0, 20).map((t) => (
                            <TaskChip key={t} name={t} accent={false} />
                          ))}
                        </div>
                      </>
                    )}
                    {inbox.length === 0 && active.length === 0 && (
                      <p className="font-code text-xs text-[var(--muted-foreground)]">{"// idle"}</p>
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
