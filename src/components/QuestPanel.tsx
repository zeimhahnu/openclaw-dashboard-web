"use client"

import { Inbox, CheckCircle2, AlertTriangle, MapPin, Sprout } from "lucide-react"
import type { AgentTaskDetails, TaskSummary } from "@/hooks/useDashboardApi"

type AgentId = "lil-claw" | "goop" | "mason"

// A chore with the agent who OWNS it (whose inbox it's in). The dashboard
// has no separate `assignee` field — the inbox the task lives in IS the
// owner. We thread that through the panel so the Help-wanted board and the
// Chore board stay aligned on who actually has to pick this up.
type OwnedChore = { task: TaskSummary; owner: AgentId }

const AGENT_COLOR: Record<string, string> = {
  "lil-claw": "#5ec27e",
  goop: "#52b8d0",
  mason: "#9b87f0",
}
const AGENT_LABEL: Record<AgentId, string> = {
  "lil-claw": "LIL CLAW",
  goop: "GOOP",
  mason: "MASON",
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

function ChoreRow({ chore, kind }: { chore: OwnedChore; kind: "queued" | "tending" | "done" }) {
  const { task, owner } = chore
  const failed = task.status === "failed"
  const ownerColor = AGENT_COLOR[owner] ?? "#7aad5a"
  const color = failed ? "#c45a3a" : ownerColor
  const origin = getChoreOrigin(task)
  const isUnowned = !task.assignedBy
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
          {/* OWNER badge — the agent whose inbox this task lives in (i.e. who
              has to pick it up). Always shown so the board never leaves an
              orphaned chore without a clear owner; matches the "by:X" / "for:Y"
              pattern used by the Chore Board below. */}
          <span
            className="font-pixel text-[5px] px-0.5 py-0 rounded shrink-0"
            style={{ color: ownerColor, backgroundColor: ownerColor + "20", border: `1px solid ${ownerColor}40` }}
            title={`Owner: ${AGENT_LABEL[owner]}`}
          >
            {AGENT_LABEL[owner]}
          </span>
          <div className="font-code text-[9px] text-[var(--foreground)] truncate">{task.id}</div>
          {/* SENDER badge — who created/assigned it. Omitted when no real
              assignedBy (bare "?" read as broken, not as "unattributed"). */}
          {!isUnowned && (
            <span
              className="font-pixel text-[5px] px-0.5 py-0 rounded shrink-0"
              style={{ color: ORIGIN_COLOR[origin] ?? "#6a9a6a", backgroundColor: (ORIGIN_COLOR[origin] ?? "#6a9a6a") + "15" }}
              title={`From: ${origin}`}
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

function Section({ icon, label, color, chores, kind }: {
  icon: React.ReactNode; label: string; color: string
  chores: OwnedChore[]; kind: "queued" | "tending" | "done"
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="font-pixel text-[7px]" style={{ color }}>{label}</span>
        <span className="font-code text-[9px] text-[var(--muted-foreground)] ml-auto">{chores.length}</span>
      </div>
      <div className="space-y-1">
        {chores.length === 0
          ? <div className="font-code text-[8px] text-[var(--muted-foreground)] pl-1 opacity-50">{"// a tidy row"}</div>
          : chores.slice(0, 8).map(c => <ChoreRow key={`${c.owner}-${c.task.id}`} chore={c} kind={kind} />)}
        {chores.length > 8 && (
          <div className="font-code text-[8px] text-[var(--muted-foreground)] pl-1">+{chores.length - 8} more</div>
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

  // Flatten all agents' chores into queued / tending / done buckets, KEEPING
  // the owner (which agent's inbox the task lives in) so every row can show
  // who actually has to pick it up — without it the Help-wanted board leaves
  // chores as anonymous, and the Chore Board below shows a different owner.
  const all: OwnedChore[] = []
  for (const id of Object.keys(taskDetails)) {
    const aid = id as AgentId
    for (const t of taskDetails[aid]?.inbox ?? []) all.push({ task: t, owner: aid })
  }
  const failed  = all.filter(c => c.task.status === "failed")
  const tending = all.filter(c => c.task.status === "working")
  // "queued" = work that still needs an agent to pick it up. Specifically:
  //   - "pending"      — waiting for someone to claim it
  //   - "acknowledged" — on someone's radar, not yet done
  //   - "needs_review" — done from the worker's side, awaiting sign-off
  //   - empty/unknown  — unknown status, treat as queued for visibility
  // EXCLUDED from queued:
  //   - "working"    — already in TENDING above
  //   - "failed"     — already in WILTED above
  //   - "complete"/"completed" — already done (would land in SHIPPED below
  //     once the backend flushes it to outbox, but if the inbox still holds
  //     a stray completed copy we hide it from the chore board)
  //   - "informational" — FYI notification, not actionable work
  // The prior logic lumped complete/informational into queued which left
  // phantom rows on the board (visible in the screenshot: stale VORTEX
  // notifications hanging around with nobody able to pick them up).
  const QUEUED_STATUSES = new Set(["pending", "acknowledged", "needs_review", "", "queued"])
  const queued  = all.filter(c => QUEUED_STATUSES.has((c.task.status ?? "").toLowerCase()))
  const done: OwnedChore[] = []
  for (const id of Object.keys(taskDetails)) {
    const aid = id as AgentId
    for (const t of taskDetails[aid]?.outbox ?? []) done.push({ task: t, owner: aid })
  }

  // Derive chore title from highest-priority *current* task. "Current" means:
  //   1. A currently-working task (status === "working") — something actually
  //      in flight right now, OR
  //   2. A pending/high-priority task from the last 48 hours — the freshest
  //      thing on the board.
  //   3. A failed task from the last 48 hours (a wilted crop is still "today").
  // Only then do we fall back to the absolute highest-priority queued task —
  // and only if it's not ancient. The prior logic picked the top-priority
  // queued task by priority alone and surfaced a week-old VORTEX
  // notification ahead of anything actually in flight. (The user-visible
  // symptom was "Today's Chore: [VORTEX] Found + fixed the OpenD config bug"
  // for days, while the agents were actually tending newer things.)
  const RECENT_H = 48
  const isRecent = (c: OwnedChore): boolean => {
    const ageH = c.task.age_h
    return ageH == null || ageH < RECENT_H
  }
  const priWeight = (p?: string): number => {
    const p2 = p?.toLowerCase()
    if (p2 === "high") return 0
    if (p2 === "medium") return 1
    if (p2 === "low" || p2 === "normal") return 2
    return 3
  }
  const sortByPriorityFreshness = (a: OwnedChore, b: OwnedChore): number => {
    const dp = priWeight(a.task.priority) - priWeight(b.task.priority)
    if (dp !== 0) return dp
    return (a.task.age_h ?? Infinity) - (b.task.age_h ?? Infinity)
  }
  const workingTop = tending.sort(sortByPriorityFreshness)[0]
  const recentQueued = queued.filter(isRecent).sort(sortByPriorityFreshness)[0]
  const recentFailed = failed.filter(isRecent).sort(sortByPriorityFreshness)[0]
  // Wilted wins over queued: a recently-failed task is the most urgent thing
  // the farmer needs to look at, even if it's lower priority.
  const topChore: OwnedChore | null = workingTop ?? recentFailed ?? recentQueued
    ?? queued.sort(sortByPriorityFreshness)[0]
    ?? null
  const topTask = topChore?.task ?? null
  const topOwner = topChore?.owner ?? "lil-claw"
  const choreTitle = topTask ? topTask.description?.slice(0, 48) || topTask.id : "No chores for now"
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
            <MapPin className="h-3 w-3 shrink-0" style={{ color: AGENT_COLOR[topOwner] ?? "#6a9a6a" }} />
            <span className="font-pixel text-[6px] text-[var(--muted-foreground)] uppercase tracking-wider">Today&apos;s Chore</span>
            {/* Owner badge — who has to pick this up. Always shown when a top
                task is selected so the header never points at an orphaned
                chore. Sender (topOrigin) follows on the right so the user
                still knows who assigned it. */}
            <span
              className="font-pixel text-[5px] px-1 py-0 rounded ml-auto"
              style={{
                color: AGENT_COLOR[topOwner] ?? "#6a9a6a",
                backgroundColor: (AGENT_COLOR[topOwner] ?? "#6a9a6a") + "20",
                border: `1px solid ${AGENT_COLOR[topOwner] ?? "#6a9a6a"}40`,
              }}
              title={`Owner: ${AGENT_LABEL[topOwner]}`}
            >
              {AGENT_LABEL[topOwner]}
            </span>
            {topOrigin !== AGENT_LABEL[topOwner] && topOrigin !== "?" && (
              <span
                className="font-pixel text-[5px] px-1 py-0 rounded"
                style={{
                  color: ORIGIN_COLOR[topOrigin] ?? "#6a9a6a",
                  backgroundColor: (ORIGIN_COLOR[topOrigin] ?? "#6a9a6a") + "15",
                }}
                title={`From: ${topOrigin}`}
              >
                ← {topOrigin}
              </span>
            )}
          </div>
          <div className="font-code text-[9px] text-[var(--foreground)] leading-tight">{choreTitle}</div>
          <div className="font-code text-[7px] text-[var(--muted-foreground)] italic leading-snug">{flavorText}</div>
        </div>
      )}
      {failed.length > 0 && (
        <Section icon={<AlertTriangle className="h-3 w-3" />} label="WILTED" color="#c45a3a" chores={failed} kind="tending" />
      )}
      <Section icon={<Sprout className="h-3 w-3" />} label="TENDING" color="#7aad5a" chores={tending} kind="tending" />
      <Section icon={<Inbox className="h-3 w-3" />} label="QUEUED" color="#e8a935" chores={queued} kind="queued" />
      <Section icon={<CheckCircle2 className="h-3 w-3" />} label="SHIPPED" color="#5ec27e" chores={done} kind="done" />
    </div>
  )
}
