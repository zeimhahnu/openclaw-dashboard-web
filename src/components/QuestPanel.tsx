"use client"

import { Swords, Inbox, CheckCircle2, AlertTriangle, MapPin } from "lucide-react"
import type { AgentTaskDetails, TaskSummary } from "@/hooks/useDashboardApi"

const AGENT_COLOR: Record<string, string> = {
  "lil-claw": "#00ff88",
  goop: "#00d4ff",
  mason: "#a78bfa",
}
const PRIORITY_COLOR: Record<string, string> = {
  high: "#ff4444", medium: "#f59e0b", low: "#6a9a6a",
}

// C4: Flavor text per quest/task type
const FLAVOR_TEXTS: Record<string, string> = {
  watchdog:   "The Watchdog Alarm sounds in the night... the realm's automated guardian stirs.",
  escalation: "A distress signal pierces the veil — urgent aid required from a neighboring agent.",
  task:       "A new bounty materializes upon the board — seek and fulfill before the deadline.",
  research:   "A Knowledge fragment has been located in the Wilderness — investigate and extract.",
  build:      "The Forge crackles with purpose — raw materials await the builder's craft.",
  analysis:   "The air grows thick with data — The Study's scholars sharpen their quills.",
  default:    "The realm stirs with activity — heed the call and press onward.",
}

function getFlavorText(taskType: string): string {
  const key = (taskType ?? "").toLowerCase()
  if (/watchdog|alarm/.test(key))  return FLAVOR_TEXTS.watchdog
  if (/escalation|urgent/.test(key)) return FLAVOR_TEXTS.escalation
  if (/research|intel|knowledge|market|investigate/.test(key)) return FLAVOR_TEXTS.research
  if (/build|implement|feature|deploy|code|develop/.test(key))  return FLAVOR_TEXTS.build
  if (/analysis|study|critique|review/.test(key))               return FLAVOR_TEXTS.analysis
  if (/task|bounty|quest|deliver/.test(key))                    return FLAVOR_TEXTS.task
  return FLAVOR_TEXTS.default
}

// C4: Quest origin badge — derive from task description/id patterns
function getQuestOrigin(task: TaskSummary): string {
  const desc = (task.description ?? "").toLowerCase()
  const id   = (task.id ?? "").toLowerCase()
  if (/alex|user|human|client/.test(desc) || /^task-.*-alex/i.test(id)) return "Alex"
  if (/watchdog|alarm|automated|system/.test(desc) || /watchdog/i.test(id)) return "Watchdog"
  return "LilClaw"
}

const ORIGIN_COLOR: Record<string, string> = {
  Alex:     "#00ff88",
  Watchdog: "#f97316",
  LilClaw:  "#a78bfa",
}

function priColor(p: string) {
  return PRIORITY_COLOR[p?.toLowerCase()] ?? "#6a9a6a"
}

function QuestRow({ task, kind }: { task: TaskSummary; kind: "queued" | "combat" | "done" }) {
  const failed = task.status === "failed"
  const color = failed ? "#ff4444" : AGENT_COLOR[task.assignedBy] ?? "#6a9a6a"
  const origin = getQuestOrigin(task)
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
        <div className="flex items-center gap-1">
          <div className="font-code text-[9px] text-[var(--foreground)] truncate">{task.id}</div>
          {/* C4: Quest origin badge */}
          <span
            className="font-pixel text-[5px] px-0.5 py-0 rounded shrink-0"
            style={{ color: ORIGIN_COLOR[origin] ?? "#6a9a6a", backgroundColor: (ORIGIN_COLOR[origin] ?? "#6a9a6a") + "15" }}
          >
            {origin}
          </span>
        </div>
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

  // C4: Derive quest title from highest-priority active task
  const activeTasks = [...failed, ...combat, ...queued]
  const topTask = activeTasks.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 }
    return (p[a.priority?.toLowerCase() as keyof typeof p] ?? 3) - (p[b.priority?.toLowerCase() as keyof typeof p] ?? 3)
  })[0]
  const questTitle = topTask ? topTask.description?.slice(0, 48) ?? topTask.id : "No active quests"
  const flavorText = topTask ? getFlavorText(topTask.type ?? "") : getFlavorText("default")
  const topOrigin  = topTask ? getQuestOrigin(topTask) : "LilClaw"

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--card)] p-3 space-y-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <Swords className="h-3.5 w-3.5 text-[#00d4ff]" />
        <span className="font-pixel text-[8px] text-[#00d4ff]">QUEST LOG</span>
      </div>

      {/* C4: Quest narrative header */}
      {topTask && (
        <div className="space-y-1 px-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" style={{ color: ORIGIN_COLOR[topOrigin] ?? "#6a9a6a" }} />
            <span className="font-pixel text-[6px] text-[var(--muted-foreground)] uppercase tracking-wider">Current Quest</span>
            <span
              className="font-pixel text-[5px] px-1 py-0 rounded ml-auto"
              style={{ color: ORIGIN_COLOR[topOrigin] ?? "#6a9a6a", backgroundColor: (ORIGIN_COLOR[topOrigin] ?? "#6a9a6a") + "20" }}
            >
              {topOrigin}
            </span>
          </div>
          <div className="font-code text-[9px] text-[var(--foreground)] leading-tight">{questTitle}</div>
          <div className="font-code text-[7px] text-[var(--muted-foreground)] italic leading-snug">{flavorText}</div>
        </div>
      )}
      {failed.length > 0 && (
        <Section icon={<AlertTriangle className="h-3 w-3" />} label="WOUNDED" color="#ff4444" tasks={failed} kind="combat" />
      )}
      <Section icon={<Swords className="h-3 w-3" />} label="IN COMBAT" color="#00ff88" tasks={combat} kind="combat" />
      <Section icon={<Inbox className="h-3 w-3" />} label="QUEUED" color="#f59e0b" tasks={queued} kind="queued" />
      <Section icon={<CheckCircle2 className="h-3 w-3" />} label="DELIVERED" color="#4a7a4a" tasks={done} kind="done" />
    </div>
  )
}
