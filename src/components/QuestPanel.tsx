"use client"

import { Inbox, CheckCircle2, AlertTriangle, MapPin, Sprout } from "lucide-react"
import type { AgentTaskDetails, TaskSummary } from "@/hooks/useDashboardApi"

const AGENT_COLOR: Record<string, string> = {
  "lil-claw": "#5ec27e",
  goop: "#52b8d0",
  mason: "#9b87f0",
}
const PRIORITY_COLOR: Record<string, string> = {
  high: "#c45a3a", medium: "#e8a935", low: "#7aad5a",
}

// Cozy flavor text per chore/task type
const FLAVOR_TEXTS: Record<string, string> = {
  watchdog:   "The Watchdog roams the fence at dusk — all is well in the valley.",
  escalation: "A neighbor's barn needs a hand — urgent help requested before sundown.",
  task:       "A new chore appears on the board — the day's work begins.",
  research:   "Old ledgers in the library hold answers — a quiet afternoon of study.",
  build:      "The forge crackles with purpose — the carpenter sets to work.",
  analysis:   "The scholar sharpens a quill — notes pile on the study desk.",
  default:    "A gentle breeze stirs the wheat — it's a good day to be on the farm.",
}

function getFlavorText(taskType: string): string {
  const key = (taskType ?? "").toLowerCase()
  if (/watchdog|alarm/.test(key))  return FLAVOR_TEXTS.watchdog
  if (/escalation|urgent/.test(key)) return FLAVOR_TEXTS.escalation
  if (/research|intel|knowledge|market|investigate/.test(key)) return FLAVOR_TEXTS.research
  if (/build|implement|feature|deploy|code|develop/.test(key))  return FLAVOR_TEXTS.build
  if (/analysis|study|critique|review/.test(key))               return FLAVOR_TEXTS.analysis
  if (/task|bounty|chore|deliver/.test(key))                    return FLAVOR_TEXTS.task
  return FLAVOR_TEXTS.default
}

// Chore origin badge — the real assignedBy field, normalized for display.
// This used to guess from the description/id text (e.g. "alex" anywhere in
// the text -> origin "Alex"), which silently disagreed with the Chore Board's
// "by:X" (the real field) any time a task's wording happened to mention a
// name it wasn't actually assigned by.
function getChoreOrigin(task: TaskSummary): string {
  const by = (task.assignedBy || "").toLowerCase().replace("zeimhahnu", "alex").replace("_bot", "")
  if (by === "lil-claw" || by === "lilclaw") return "LilClaw"
  if (by === "goop") return "Goop"
  if (by === "mason") return "Mason"
  if (by === "alex") return "Alex"
  if (/watchdog/.test(by)) return "Watchdog"
  return task.assignedBy || "?"
}

const ORIGIN_COLOR: Record<string, string> = {
  Alex:     "#e8a935",
  Watchdog: "#e8a935",
  LilClaw:  AGENT_COLOR["lil-claw"],
  Goop:     AGENT_COLOR["goop"],
  Mason:    AGENT_COLOR["mason"],
}

function priColor(p: string) {
  return PRIORITY_COLOR[p?.toLowerCase()] ?? "#6a9a6a"
}

function ChoreRow({ task, kind }: { task: TaskSummary; kind: "queued" | "tending" | "done" }) {
  const failed = task.status === "failed"
  const color = failed ? "#c45a3a" : AGENT_COLOR[task.assignedBy] ?? "#7aad5a"
  const origin = getChoreOrigin(task)
  return (
    <div
      className="flex items-start gap-1.5 px-2 py-1 rounded border"
      style={{
        borderColor: failed ? "#c45a3a40" : "var(--border)",
        backgroundColor: failed ? "#c45a3a08" : kind === "tending" ? color + "08" : "transparent",
      }}
    >
      <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priColor(task.priority) }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <div className="font-code text-[9px] text-[var(--foreground)] truncate">{task.id}</div>
          {/* Omit the badge entirely when the task has no real assignedBy
              (matches Chore Board's "by:X" pattern) - a bare "?" placeholder
              for missing data reads as broken, not as "unattributed". */}
          {task.assignedBy && (
            <span
              className="font-pixel text-[5px] px-0.5 py-0 rounded shrink-0"
              style={{ color: ORIGIN_COLOR[origin] ?? "#6a9a6a", backgroundColor: (ORIGIN_COLOR[origin] ?? "#6a9a6a") + "15" }}
            >
              {origin}
            </span>
          )}
        </div>
        {task.description && (
          <div className="font-code text-[8px] text-[var(--muted-foreground)] truncate">{task.description}</div>
        )}
      </div>
      {failed && <span className="font-pixel text-[6px] text-[#c45a3a] shrink-0">WILTED</span>}
    </div>
  )
}

function Section({ icon, label, color, tasks, kind }: {
  icon: React.ReactNode; label: string; color: string
  tasks: TaskSummary[]; kind: "queued" | "tending" | "done"
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
          ? <div className="font-code text-[8px] text-[var(--muted-foreground)] pl-1 opacity-50">{"// a tidy row"}</div>
          : tasks.slice(0, 8).map(t => <ChoreRow key={t.id} task={t} kind={kind} />)}
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

  // Flatten all agents' chores into queued / tending / done buckets.
  const all: TaskSummary[] = []
  for (const id of Object.keys(taskDetails)) {
    for (const t of taskDetails[id]?.inbox ?? []) all.push(t)
  }
  const failed  = all.filter(t => t.status === "failed")
  const tending = all.filter(t => t.status === "working")
  const queued  = all.filter(t => t.status !== "working" && t.status !== "failed")
  const done: TaskSummary[] = []
  for (const id of Object.keys(taskDetails)) {
    for (const t of taskDetails[id]?.outbox ?? []) done.push(t)
  }

  // Derive chore title from highest-priority active task
  const activeTasks = [...failed, ...tending, ...queued]
  const topTask = activeTasks.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 }
    return (p[a.priority?.toLowerCase() as keyof typeof p] ?? 3) - (p[b.priority?.toLowerCase() as keyof typeof p] ?? 3)
  })[0]
  const choreTitle = topTask ? topTask.description?.slice(0, 48) ?? topTask.id : "No chores for now"
  const flavorText = topTask ? getFlavorText(topTask.type ?? "") : getFlavorText("default")
  const topOrigin  = topTask ? getChoreOrigin(topTask) : "LilClaw"

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--card)] p-3 space-y-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <Sprout className="h-3.5 w-3.5 text-[var(--primary)]" />
        <span className="font-pixel text-[8px] text-[var(--primary)]">HELP-WANTED BOARD</span>
      </div>

      {/* Cozy narrative header */}
      {topTask && (
        <div className="space-y-1 px-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" style={{ color: ORIGIN_COLOR[topOrigin] ?? "#6a9a6a" }} />
            <span className="font-pixel text-[6px] text-[var(--muted-foreground)] uppercase tracking-wider">Today&apos;s Chore</span>
            <span
              className="font-pixel text-[5px] px-1 py-0 rounded ml-auto"
              style={{ color: ORIGIN_COLOR[topOrigin] ?? "#6a9a6a", backgroundColor: (ORIGIN_COLOR[topOrigin] ?? "#6a9a6a") + "20" }}
            >
              {topOrigin}
            </span>
          </div>
          <div className="font-code text-[9px] text-[var(--foreground)] leading-tight">{choreTitle}</div>
          <div className="font-code text-[7px] text-[var(--muted-foreground)] italic leading-snug">{flavorText}</div>
        </div>
      )}
      {failed.length > 0 && (
        <Section icon={<AlertTriangle className="h-3 w-3" />} label="WILTED" color="#c45a3a" tasks={failed} kind="tending" />
      )}
      <Section icon={<Sprout className="h-3 w-3" />} label="TENDING" color="#7aad5a" tasks={tending} kind="tending" />
      <Section icon={<Inbox className="h-3 w-3" />} label="QUEUED" color="#e8a935" tasks={queued} kind="queued" />
      <Section icon={<CheckCircle2 className="h-3 w-3" />} label="SHIPPED" color="#5ec27e" tasks={done} kind="done" />
    </div>
  )
}
