"use client"

import { Swords, Inbox, CheckCircle2, AlertTriangle } from "lucide-react"
import type { AgentTaskDetails, TaskSummary } from "@/hooks/useDashboardApi"

const AGENT_COLOR: Record<string, string> = {
  "lil-claw": "#00ff88",
  goop: "#00d4ff",
  mason: "#a78bfa",
}
const PRIORITY_COLOR: Record<string, string> = {
  high: "#ff4444", medium: "#f59e0b", low: "#6a9a6a",
}

function priColor(p: string) {
  return PRIORITY_COLOR[p?.toLowerCase()] ?? "#6a9a6a"
}

function QuestRow({ task, kind }: { task: TaskSummary; kind: "queued" | "combat" | "done" }) {
  const failed = task.status === "failed"
  const color = failed ? "#ff4444" : AGENT_COLOR[task.assignedBy] ?? "#6a9a6a"
  return (
    <div
      className="flex items-start gap-1.5 px-2 py-1 rounded border"
      style={{
        borderColor: failed ? "#ff444440" : "var(--border)",
        backgroundColor: failed ? "#ff444408" : kind === "combat" ? color + "08" : "transparent",
      }}
    >
      <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priColor(task.priority) }} />
      <div className="min-w-0 flex-1">
        <div className="font-code text-[9px] text-[var(--foreground)] truncate">{task.id}</div>
        {task.description && (
          <div className="font-code text-[8px] text-[var(--muted-foreground)] truncate">{task.description}</div>
        )}
      </div>
      {failed && <span className="font-pixel text-[6px] text-[#ff4444] shrink-0">ERR</span>}
    </div>
  )
}

function Section({ icon, label, color, tasks, kind }: {
  icon: React.ReactNode; label: string; color: string
  tasks: TaskSummary[]; kind: "queued" | "combat" | "done"
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="font-pixel text-[7px]" style={{ color }}>{label}</span>
        <span className="font-code text-[9px] text-[var(--muted-foreground)] ml-auto">{tasks.length}</span>
      </div>
      <div className="space-y-1">
        {tasks.length === 0
          ? <div className="font-code text-[8px] text-[var(--muted-foreground)] pl-1 opacity-50">{/* none */}</div>
          : tasks.slice(0, 8).map(t => <QuestRow key={t.id} task={t} kind={kind} />)}
        {tasks.length > 8 && (
          <div className="font-code text-[8px] text-[var(--muted-foreground)] pl-1">+{tasks.length - 8} more</div>
        )}
      </div>
    </div>
  )
}

export function QuestPanel({ taskDetails, isLoading }: {
  taskDetails: Record<string, AgentTaskDetails> | null
  isLoading: boolean
}) {
  if (isLoading || !taskDetails) {
    return (
      <div className="rounded border border-[var(--border)] bg-[var(--card)] p-3 space-y-2">
        <div className="skeleton h-3 w-20 rounded" />
        {[0,1,2,3].map(i => <div key={i} className="skeleton h-6 w-full rounded" />)}
      </div>
    )
  }

  // Flatten all agents' tasks into queued / in-combat / done buckets.
  const all: TaskSummary[] = []
  for (const id of Object.keys(taskDetails)) {
    for (const t of taskDetails[id]?.inbox ?? []) all.push(t)
  }
  const failed = all.filter(t => t.status === "failed")
  const combat = all.filter(t => t.status === "working")
  const queued = all.filter(t => t.status !== "working" && t.status !== "failed")
  const done: TaskSummary[] = []
  for (const id of Object.keys(taskDetails)) {
    for (const t of taskDetails[id]?.outbox ?? []) done.push(t)
  }

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--card)] p-3 space-y-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <Swords className="h-3.5 w-3.5 text-[#00d4ff]" />
        <span className="font-pixel text-[8px] text-[#00d4ff]">QUEST LOG</span>
      </div>
      {failed.length > 0 && (
        <Section icon={<AlertTriangle className="h-3 w-3" />} label="WOUNDED" color="#ff4444" tasks={failed} kind="combat" />
      )}
      <Section icon={<Swords className="h-3 w-3" />} label="IN COMBAT" color="#00ff88" tasks={combat} kind="combat" />
      <Section icon={<Inbox className="h-3 w-3" />} label="QUEUED" color="#f59e0b" tasks={queued} kind="queued" />
      <Section icon={<CheckCircle2 className="h-3 w-3" />} label="DELIVERED" color="#4a7a4a" tasks={done} kind="done" />
    </div>
  )
}
