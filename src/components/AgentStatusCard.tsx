"use client"

import { useState } from "react"
import { Activity, Inbox, Send, Zap, ChevronDown, ChevronRight } from "lucide-react"
import type { TaskSummary, AgentTaskDetails, AgentState } from "@/hooks/useDashboardApi"

// ─── Agent metadata ──────────────────────────────────────────────────────────

interface AgentMeta { short: string; display: string; color: string; title: string }

const AGENT_META: Record<string, AgentMeta> = {
  "lil-claw": { short: "LC", display: "lil-claw", color: "#5ec27e", title: "Farm Manager" },
  goop:       { short: "GP", display: "goop",     color: "#52b8d0", title: "Blacksmith & Carpenter" },
  mason:      { short: "MS", display: "mason",     color: "#9b87f0", title: "Scholar of the Vale" },
}

// (stableHash helper removed — was used to fake PID numbers, dropped in cozy pass)

// ─── Pixel art sprites ───────────────────────────────────────────────────────
// 8×12 grid: 0=transparent 1=main-color 2=shadow(#0a0a0a) 3=highlight(color+99)

type PixelGrid = number[][]

const SPRITE_GRIDS: Record<string, PixelGrid> = {
  "lil-claw": [
    [0,1,0,0,0,0,1,0],
    [1,1,1,1,1,1,1,1],
    [1,2,1,1,1,1,2,1],
    [1,1,1,1,1,1,1,1],
    [1,1,0,1,1,0,1,1],
    [0,3,1,1,1,1,3,0],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1],
    [0,1,3,1,1,3,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,0,0,1,0,0],
    [0,1,1,0,0,1,1,0],
  ],
  goop: [
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1],
    [1,1,0,3,3,0,1,1],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1],
    [3,1,1,0,0,1,1,3],
    [0,1,1,1,1,1,1,0],
    [0,1,3,0,0,3,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,1,1,0],
  ],
  mason: [
    [1,1,1,1,1,1,1,1],
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,2,1,1,2,1,0],
    [0,1,1,3,3,1,1,0],
    [0,3,1,1,1,1,3,0],
    [0,0,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,1],
    [0,3,1,0,0,1,3,0],
    [0,1,1,1,1,1,1,0],
    [0,1,0,1,1,0,1,0],
  ],
}

function AgentSprite({ agentId, color, isWorking }: {
  agentId: string; color: string; isWorking: boolean
}) {
  const grid = SPRITE_GRIDS[agentId] ?? SPRITE_GRIDS["lil-claw"]
  const S    = 4
  const cols = grid[0].length
  const rows = grid.length
  const dark = "#2a1808"
  const hi   = color + "99"

  return (
    <div className={isWorking ? "sprite-working" : "sprite-idle"}>
      <svg
        width={cols * S}
        height={rows * S}
        viewBox={`0 0 ${cols * S} ${rows * S}`}
        style={{ imageRendering: "pixelated", shapeRendering: "crispEdges", display: "block" }}
      >
        {grid.flatMap((row, y) =>
          row.map((cell, x) => {
            if (cell === 0) return null
            const fill = cell === 1 ? color : cell === 2 ? dark : hi
            return <rect key={`${x}-${y}`} x={x * S} y={y * S} width={S} height={S} fill={fill} />
          })
        )}
      </svg>
    </div>
  )
}

// ─── Stamina bar ─────────────────────────────────────────────────────────────
// High inbox = drained stamina (agent is maxed). Low inbox = full stamina (resting).

function StaminaBar({ inboxCount, color }: { inboxCount: number; color: string }) {
  const SEGS   = 8
  const filled = Math.max(0, SEGS - inboxCount)
  const isCrit = filled <= 1
  const isWarn = filled <= 3 && !isCrit
  const segClr = isCrit ? "var(--pixel-hp-low)" : isWarn ? "var(--pixel-hp-warn)" : color

  return (
    <div className="flex gap-px">
      {Array.from({ length: SEGS }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 flex-1 ${isCrit && i < filled ? "hp-critical" : ""}`}
          style={{
            background: i < filled ? segClr : "var(--pixel-hp-bg)",
            border: "1px solid var(--border)",
            boxShadow: i < filled ? `0 0 3px ${segClr}60` : "none",
          }}
        />
      ))}
    </div>
  )
}

// ─── Gold counter ─────────────────────────────────────────────────────────────

function GoldCounter({ amount }: { amount: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-code text-[9px]" style={{ color: "var(--pixel-gold)" }}>◈</span>
      <span className="font-code text-[10px] font-bold text-glow-gold">
        {amount}
      </span>
      <span className="font-code text-[8px] text-[var(--muted-foreground)]">delivered</span>
    </div>
  )
}

// ─── Quest drawer components ──────────────────────────────────────────────────

function ChoreBadge({ priority }: { priority: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    high:   { cls: "text-[#c45a3a] border-[#c45a3a]/40 bg-[#c45a3a]/10", label: "URGENT" },
    medium: { cls: "text-[#e8a935] border-[#e8a935]/40 bg-[#e8a935]/10", label: "SOON"  },
    low:    { cls: "text-[#7aad5a] border-[#7aad5a]/40",                  label: "IDLE"  },
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

function TaskRow({ task }: { task: TaskSummary }) {
  const isFailed = task.status === "failed"
  return (
    <div
      className="border rounded p-1.5 space-y-0.5"
      style={{
        borderColor: isFailed ? "#c45a3a40" : "var(--border)",
        backgroundColor: isFailed ? "#c45a3a08" : undefined,
      }}
    >
      <div className="flex items-center gap-1.5">
        <ChoreBadge priority={task.priority} />
        <span className="font-code text-[9px] text-[var(--muted-foreground)] truncate flex-1">{task.id}</span>
        {isFailed && (
          <span className="font-pixel text-[6px] px-1 border rounded shrink-0"
            style={{ color: "#c45a3a", borderColor: "#c45a3a40" }}>
            WILTED
          </span>
        )}
      </div>
      {task.description && (
        <p className="font-code text-[10px] leading-tight line-clamp-2"
          style={{ color: isFailed ? "#c45a3a99" : "var(--foreground)", opacity: isFailed ? 1 : 0.6 }}>
          {task.description.length > 90 ? task.description.substring(0, 90) + "…" : task.description}
        </p>
      )}
    </div>
  )
}

function TaskSection({ label, tasks, color }: { label: string; tasks: TaskSummary[]; color: string }) {
  if (tasks.length === 0) return null
  return (
    <div>
      <div className="font-code text-[9px] uppercase tracking-wider mb-1" style={{ color: color + "99" }}>
        {label} ({tasks.length})
      </div>
      <div className="space-y-1">
        {tasks.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} />)}
        {tasks.length > 6 && (
          <p className="font-code text-[9px] text-[var(--muted-foreground)] pl-1">+{tasks.length - 6} more</p>
        )}
      </div>
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface AgentStatusCardProps {
  agentName:    string
  data:         AgentState | null
  taskDetails?: AgentTaskDetails | null
  isLoading:    boolean
}

export function AgentStatusCard({ agentName, data, taskDetails, isLoading }: AgentStatusCardProps) {
  const [expanded, setExpanded] = useState(false)
  const meta   = AGENT_META[agentName] ?? { short: "??", display: agentName, color: "#e8a935", title: "agent" }
  const color  = meta.color

  if (isLoading) {
    return (
      <div
        data-agent-id={agentName}
        className="bg-[var(--card)] border border-[var(--border)] rounded overflow-hidden"
        style={{ borderLeft: `3px solid ${color}40` }}
      >
        {/* Header skeleton */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${color}10` }}>
          <span className="font-code text-[10px] font-bold px-1.5 py-0.5 rounded border"
            style={{ color: color + "40", borderColor: color + "20", backgroundColor: color + "08" }}>
            {meta.short}
          </span>
          <div className="skeleton h-3 w-20 rounded" />
          <div className="ml-auto skeleton h-3 w-12 rounded" />
        </div>
        {/* Sprite + stats skeleton */}
        <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: `1px solid ${color}08` }}>
          <div className="skeleton shrink-0 rounded" style={{ width: 32, height: 48 }} />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-2 w-24 rounded" />
            <div className="skeleton h-2.5 w-full rounded" />
            <div className="skeleton h-2 w-16 rounded" />
          </div>
        </div>
        {/* KPI skeleton */}
        <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center py-2.5 gap-1.5">
              <div className="skeleton h-2 w-3 rounded" />
              <div className="skeleton h-6 w-8 rounded" />
              <div className="skeleton h-2 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div
        data-agent-id={agentName}
        className="bg-[var(--card)] border border-[var(--border)] rounded p-3"
        style={{ borderLeft: `3px solid ${color}40` }}
      >
        <p className="font-code text-xs text-[var(--muted-foreground)]">{/* offline */}</p>
      </div>
    )
  }

  // Phase 1 truth: prefer session_active || working task || working_count
  // (the old `working_count>0` signal is too transient to drive the UI alone)
  const taskInFlight = (taskDetails?.inbox ?? []).some(t => t.status === "working")
  const isWorking    = data.session_active === true || taskInFlight || (data.working_count ?? 0) > 0
  const inboxWarn    = data.inbox_count > 5
  const failedTasks  = (taskDetails?.inbox ?? []).filter(t => t.status === "failed")
  const isWilted     = failedTasks.length > 0 || data.health === "red"
  const health       = data.health ?? "green"
  const currentTask  = data.current_task ?? null
  const completedToday = data.completed_today ?? 0
  const totalTasks   = (taskDetails?.inbox?.length ?? 0) + (taskDetails?.outbox?.length ?? 0)
  const hasDrawer    = totalTasks > 0

  const statusLabel = isWilted ? "WILTED" : isWorking ? "TENDING" : "RESTING"
  const statusColor = isWilted ? "#c45a3a" : isWorking ? color : "#7aad5a"
  const statusGlow  = isWilted ? "0 0 6px #c45a3a60" : isWorking ? `0 0 6px ${color}60` : "none"

  return (
    <div
      data-agent-id={agentName}
      className="bg-[var(--card)] border border-[var(--border)] rounded overflow-hidden"
      style={{ borderLeft: `3px solid ${isWilted ? "#c45a3a" : color}` }}
    >
      {/* Header strip */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          borderBottom: `1px solid ${color}20`,
          backgroundColor: isWilted ? "#c45a3a08" : color + "08",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-code text-[10px] font-bold px-1.5 py-0.5 rounded border"
            style={{ color, borderColor: color + "40", backgroundColor: color + "15" }}
          >
            {meta.short}
          </span>
          <span className="font-code text-xs font-semibold text-[var(--foreground)]">{meta.display}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isWorking && !isWilted && (
            <span className="pulse-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          )}
          {isWilted && (
            <span className="pulse-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#c45a3a" }} />
          )}
          {health === "amber" && !isWilted && (
            <span
              className="font-code text-[7px] px-1 border rounded"
              style={{ color: "#e8a935", borderColor: "#e8a93550", backgroundColor: "#e8a93510" }}
              title="Agent health: needs care"
            >
              AMBER
            </span>
          )}
          <span
            className="font-code text-[10px] font-bold tracking-widest"
            style={{ color: statusColor, textShadow: statusGlow }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Character sprite + cozy stats */}
      <div
        className="flex items-center gap-3 px-3 py-2.5"
        style={{ borderBottom: `1px solid ${color}15` }}
      >
        <div
          className="shrink-0"
          style={{
            filter: isWilted
              ? "drop-shadow(0 0 6px #ff444490)"
              : isWorking
              ? `drop-shadow(0 0 5px ${color}90)`
              : "none",
          }}
        >
          <AgentSprite agentId={agentName} color={isWilted ? "#c45a3a" : color} isWorking={isWorking} />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="font-pixel text-[6px] truncate" style={{ color: color + "bb" }}>
            {meta.title}
          </p>
          {currentTask && (
            <p className="font-code text-[8px] truncate text-[var(--muted-foreground)]" title={currentTask}>
              ◆ {currentTask.length > 36 ? currentTask.slice(0, 36) + "…" : currentTask}
            </p>
          )}
          {completedToday > 0 && (
            <p className="font-code text-[8px] text-[var(--muted-foreground)]/70">
              {completedToday} shipped today
            </p>
          )}

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-pixel text-[6px] text-[var(--muted-foreground)]">Energy</span>
              <span className="font-code text-[8px] text-[var(--muted-foreground)]">
                {Math.max(0, 8 - data.inbox_count)}/8
              </span>
            </div>
            <StaminaBar inboxCount={data.inbox_count} color={color} />
          </div>

          <GoldCounter amount={data.outbox_count} />
        </div>
      </div>

      {/* KPI numbers */}
      <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
        <div className="flex flex-col items-center justify-center py-2.5 px-2 text-center">
          <Inbox className="h-3 w-3 text-[var(--muted-foreground)] mb-1" />
          <span
            className={`font-code text-xl font-bold leading-none ${
              inboxWarn ? "text-[#e8a935]" : data.inbox_count > 0 ? "" : "text-[var(--muted-foreground)]"
            }`}
            style={data.inbox_count > 0 && !inboxWarn ? { color, textShadow: `0 0 8px ${color}50` } : {}}
          >
            {inboxWarn && <Zap className="h-3 w-3 inline mb-0.5 mr-0.5 text-[#e8a935]" />}
            {data.inbox_count}
          </span>
          <span className="font-code text-[8px] text-[var(--muted-foreground)] mt-1">chores</span>
        </div>

        <div className="flex flex-col items-center justify-center py-2.5 px-2 text-center">
          <Activity className="h-3 w-3 text-[var(--muted-foreground)] mb-1" />
          <span
            className="font-code text-xl font-bold leading-none"
            style={{
              color: isWorking ? color : "#7aad5a",
              textShadow: isWorking ? `0 0 8px ${color}50` : "none",
            }}
          >
            {data.working_count}
          </span>
          <span className="font-code text-[8px] text-[var(--muted-foreground)] mt-1">in field</span>
        </div>

        <div className="flex flex-col items-center justify-center py-2.5 px-2 text-center">
          <Send className="h-3 w-3 text-[var(--muted-foreground)] mb-1" />
          <span className="font-code text-xl font-bold leading-none text-[var(--muted-foreground)]">
            {data.outbox_count}
          </span>
          <span className="font-code text-[8px] text-[var(--muted-foreground)] mt-1">shipped</span>
        </div>
      </div>

      {/* Expandable chore drawer */}
      {hasDrawer && (
        <div style={{ borderTop: `1px solid ${isWilted ? "#ff444430" : color + "20"}` }}>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 w-full text-left px-3 py-2 hover:bg-[var(--muted)] transition-colors cursor-pointer"
          >
            {expanded
              ? <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
              : <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />
            }
            <span className="font-pixel text-[7px] text-[var(--muted-foreground)]">
              Chore Board ({totalTasks})
            </span>
            {(taskDetails?.inbox?.length ?? 0) > 0 && (
              <span className="font-code text-[9px] ml-1" style={{ color: color + "99" }}>
                {taskDetails!.inbox.length} to do
              </span>
            )}
            {isWilted && (
              <span className="font-pixel text-[7px] px-1 border rounded ml-auto"
                style={{ color: "#c45a3a", borderColor: "#c45a3a40", backgroundColor: "#c45a3a10" }}>
                {failedTasks.length} NEEDS CARE
              </span>
            )}
          </button>

          {expanded && (
            <div className="px-3 pb-3 space-y-3" style={{ borderTop: `1px solid var(--border)` }}>
              <div className="pt-2">
                <TaskSection label="to do" tasks={taskDetails?.inbox ?? []} color={color} />
              </div>
              {(taskDetails?.outbox?.length ?? 0) > 0 && (
                <TaskSection label="shipped" tasks={taskDetails?.outbox ?? []} color={color} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Activity Feed (Farm Journal) ─────────────────────────────────────────────

interface ActivityFeedProps {
  walTails:  Record<string, string[]> | null
  isLoading: boolean
}

export function ActivityFeed({ walTails, isLoading }: ActivityFeedProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  if (isLoading || !walTails) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[var(--primary)] rounded p-3">
        <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
          <div className="skeleton h-3.5 w-3.5 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
          <div className="ml-auto skeleton h-3 w-12 rounded" />
        </div>
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-8 w-full rounded" />
          ))}
        </div>
      </div>
    )
  }

  const agentNames = Object.keys(walTails).filter((a) => (walTails[a]?.length ?? 0) > 0)

  if (agentNames.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[var(--primary)] rounded p-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <span className="font-pixel text-[8px]">FARM JOURNAL</span>
        </div>
        <p className="font-code text-xs text-[var(--muted-foreground)]">{"// a quiet morning on the farm"}</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[var(--primary)] rounded p-3">
      <div className="flex items-center gap-2 mb-3 border-b border-[var(--border)] pb-2">
        <Activity className="h-3.5 w-3.5 text-[var(--primary)]" />
        <span className="font-pixel text-[8px] text-glow">FARM JOURNAL</span>
        <span className="ml-auto font-code text-[10px] text-[var(--muted-foreground)]">
          {agentNames.length} villagers
        </span>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {agentNames.map((agent) => {
          const entries = walTails[agent] || []
          const isOpen  = expandedAgent === agent
          const color   = AGENT_META[agent]?.color ?? "#4a7a4a"

          return (
            <div key={agent} className="border border-[var(--border)] rounded">
              <button
                onClick={() => setExpandedAgent(isOpen ? null : agent)}
                className="flex items-center justify-between w-full text-left px-2.5 py-1.5 hover:bg-[var(--muted)] rounded transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  {isOpen
                    ? <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
                    : <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />
                  }
                  <span className="font-pixel text-[7px]" style={{ color }}>{agent}</span>
                </div>
                <span className="font-code text-[10px] text-[var(--muted-foreground)]">
                  {entries.length}
                </span>
              </button>

              {isOpen && (
                <div className="px-2.5 pb-2 border-t border-[var(--border)] pt-1.5 space-y-1">
                  {entries.slice(-10).map((entry, i) => (
                    <p key={i} className="font-code text-[10px] text-[var(--muted-foreground)] leading-relaxed">
                      <span className="opacity-50 mr-1">&gt;</span>
                      {entry.substring(0, 160)}{entry.length > 160 ? "…" : ""}
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
