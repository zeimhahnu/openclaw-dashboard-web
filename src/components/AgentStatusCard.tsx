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

// ─── Villager portraits ───────────────────────────────────────────────────────
// Pixel busts that match the farm scene: a straw-hatted farm manager, a blacksmith,
// and a silver-haired scholar — each holding their tool. Built parametrically.

type ToolKind = "watering" | "hammer" | "quill"
interface Skin {
  hair: string; hairDark: string; skin: string; skinDark: string
  shirt: string; shirtDark: string; tool: ToolKind; hat: boolean; glasses: boolean
}
const SKINS: Record<string, Skin> = {
  "lil-claw": { hair: "#6b431f", hairDark: "#4a2c12", skin: "#f1c89e", skinDark: "#d29a6c", shirt: "#c6502f", shirtDark: "#8f3820", tool: "watering", hat: true,  glasses: false },
  goop:       { hair: "#23262c", hairDark: "#121418", skin: "#e7b588", skinDark: "#bf8a58", shirt: "#3f86a6", shirtDark: "#2b5d76", tool: "hammer",   hat: false, glasses: false },
  mason:      { hair: "#d4cee1", hairDark: "#aaa0c4", skin: "#f1c89e", skinDark: "#d29a6c", shirt: "#6a4f9e", shirtDark: "#4b3775", tool: "quill",    hat: false, glasses: true  },
}

const C_EYE = "#241a12", C_MOUTH = "#a85e44", C_CHEEK = "#e6936f"
const C_METAL = "#cdd3da", C_METAL_D = "#8c929a", C_WOOD = "#7a4a24", C_GOLD = "#ffd24a", C_FEATHER = "#fbf7ec"

function VillagerPortrait({ agentId, color, isWorking, svgSize }: {
  agentId: string; color: string; isWorking: boolean; svgSize?: number
}) {
  const s = SKINS[agentId] ?? SKINS["lil-claw"]
  const P = 4, U = 15
  const r: React.ReactNode[] = []
  let k = 0
  const px = (x: number, y: number, w: number, h: number, fill: string) =>
    r.push(<rect key={k++} x={x * P} y={y * P} width={w * P} height={h * P} fill={fill} shapeRendering="crispEdges" />)

  // Shoulders / shirt
  px(2, 11, 11, 4, s.shirt)
  px(2, 13, 11, 2, s.shirtDark)
  px(6, 11, 3, 1, s.skin)            // collar opening (neck)
  if (agentId === "goop") { px(4, 11, 1, 4, "#5a3a1e"); px(10, 11, 1, 4, "#5a3a1e") } // apron straps
  // Neck
  px(6, 10, 3, 1, s.skinDark)

  // Back hair (scholar's longer silver hair) — drawn behind the head
  if (agentId === "mason") { px(3, 3, 9, 8, s.hairDark) }

  // Head (skin)
  px(4, 4, 7, 6, s.skin)
  px(3, 6, 1, 2, s.skin); px(11, 6, 1, 2, s.skin)   // ears
  px(3, 7, 1, 1, s.skinDark); px(11, 7, 1, 1, s.skinDark)

  // Hair / hat
  if (s.hat) {
    // Straw hat
    px(5, 1, 5, 1, "#e7c067")
    px(4, 2, 7, 1, "#e7c067")
    px(2, 3, 11, 1, "#d8ab50")        // brim
    px(2, 4, 11, 1, "#b88a3c")        // brim shadow
    px(4, 3, 7, 1, "#9c6b2e")         // hat band
    px(4, 4, 2, 1, s.hair)            // hair peeking at temples
    px(9, 4, 2, 1, s.hair)
  } else {
    px(4, 2, 7, 2, s.hair)            // hair top
    px(3, 3, 1, 3, s.hair); px(11, 3, 1, 3, s.hair)  // sideburns
    px(4, 3, 7, 1, s.hairDark)        // hairline shade
    if (agentId === "goop") { px(4, 9, 7, 1, s.hairDark) } // stubble jaw
  }

  // Eyes
  px(5, 6, 1, 1, C_EYE); px(9, 6, 1, 1, C_EYE)
  // Glasses (scholar)
  if (s.glasses) {
    px(4, 6, 3, 1, "#3a3142"); px(8, 6, 3, 1, "#3a3142")
    px(4, 5, 3, 1, "#3a3142"); px(8, 5, 3, 1, "#3a3142")
    px(7, 6, 1, 1, "#3a3142")
    px(5, 6, 1, 1, C_EYE); px(9, 6, 1, 1, C_EYE) // redraw pupils inside frames
  }
  // Cheeks + mouth
  px(4, 8, 1, 1, C_CHEEK); px(10, 8, 1, 1, C_CHEEK)
  px(6, 8, 3, 1, C_MOUTH)

  // Tool, held to the right side
  if (s.tool === "watering") {
    px(11, 9, 3, 3, C_METAL); px(11, 11, 3, 1, C_METAL_D)
    px(10, 9, 1, 1, C_METAL_D)            // handle
    px(13, 8, 1, 1, C_METAL_D); px(14, 7, 1, 1, C_METAL_D) // spout
    px(13, 9, 1, 1, "#bcd6e6")            // little water glint
  } else if (s.tool === "hammer") {
    px(12, 6, 1, 6, C_WOOD)               // handle
    px(11, 5, 3, 2, C_METAL); px(11, 5, 1, 1, "#eef2f6")
  } else {
    px(13, 5, 1, 4, C_FEATHER); px(12, 6, 1, 3, C_FEATHER) // feather
    px(12, 8, 1, 1, C_GOLD)               // gold nib
  }

  const displaySize = svgSize ?? U * P
  return (
    <div className={isWorking ? "sprite-working" : "sprite-idle"}>
      <svg
        width={displaySize} height={displaySize} viewBox={`0 0 ${U * P} ${U * P}`}
        style={{ imageRendering: "pixelated", shapeRendering: "crispEdges", display: "block" }}
      >
        <rect x={0} y={0} width={U * P} height={U * P} rx={9} fill={color + "12"} />
        <rect x={0.5} y={0.5} width={U * P - 1} height={U * P - 1} rx={9} fill="none" stroke={color + "33"} />
        {r}
      </svg>
    </div>
  )
}

// Back-compat alias (call sites use AgentSprite)
const AgentSprite = VillagerPortrait

// ─── Compact horizontal agent row ─────────────────────────────────────────────

export function CompactAgentRow({ agentName, data, taskDetails, isLoading }: AgentStatusCardProps) {
  const meta  = AGENT_META[agentName] ?? { short: "??", display: agentName, color: "#e8a935", title: "agent" }
  const color = meta.color

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden flex items-center gap-3 px-3 py-2.5"
           style={{ borderLeft: `3px solid ${color}40` }}>
        <div className="skeleton rounded shrink-0" style={{ width: 42, height: 42 }} />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-2.5 w-48 rounded" />
        </div>
        <div className="flex gap-4 shrink-0">
          {[0,1,2].map(i => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="skeleton h-5 w-7 rounded" />
              <div className="skeleton h-2 w-8 rounded" />
            </div>
          ))}
        </div>
        <div className="skeleton h-3 w-16 rounded shrink-0 ml-2" />
      </div>
    )
  }

  const taskInFlight  = (taskDetails?.inbox ?? []).some(t => t.status === "working")
  const isWorking     = data.session_active === true || taskInFlight || (data.working_count ?? 0) > 0
  const failedTasks   = (taskDetails?.inbox ?? []).filter(t => t.status === "failed")
  const isWilted      = failedTasks.length > 0 || data.health === "red"
  const statusLabel   = isWilted ? "WILTED" : isWorking ? "TENDING" : "RESTING"
  const statusColor   = isWilted ? "#c45a3a" : isWorking ? color : "#3a7c18"
  const currentTask   = data.current_task ?? null
  const inboxWarn     = data.inbox_count > 5

  const kpis = [
    { label: "chores",  value: data.inbox_count,   warn: inboxWarn,                  active: false },
    { label: "active",  value: data.working_count,  warn: false,                      active: isWorking && !isWilted },
    { label: "done",    value: data.outbox_count,   warn: false,                      active: false },
  ]

  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden flex items-center"
      style={{ borderLeft: `3px solid ${isWilted ? "#c45a3a" : color}` }}
    >
      {/* Portrait */}
      <div
        className="shrink-0 px-3 py-2.5"
        style={{
          filter: isWilted
            ? "drop-shadow(0 0 4px #c45a3a80)"
            : isWorking ? `drop-shadow(0 0 3px ${color}80)` : "none",
        }}
      >
        <AgentSprite
          agentId={agentName}
          color={isWilted ? "#c45a3a" : color}
          isWorking={isWorking}
          svgSize={42}
        />
      </div>

      {/* Name + title + current task */}
      <div className="flex-1 min-w-0 py-2.5 pr-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-code text-[13px] font-bold text-[var(--foreground)] leading-none">
            {meta.display}
          </span>
          <span className="font-pixel text-[6px]" style={{ color: color + "99" }}>
            {meta.title}
          </span>
        </div>
        <p className="font-code text-[10px] text-[var(--muted-foreground)] truncate mt-1">
          {currentTask
            ? `◆ ${currentTask.length > 52 ? currentTask.slice(0, 52) + "…" : currentTask}`
            : isWilted ? "⚠ needs care"
            : isWorking ? "in the field…"
            : "taking a rest"}
        </p>
      </div>

      {/* KPIs */}
      <div className="flex items-stretch divide-x divide-[var(--border)] border-l border-[var(--border)] shrink-0">
        {kpis.map(({ label, value, warn, active }) => (
          <div key={label} className="flex flex-col items-center justify-center px-3.5 py-2.5 min-w-[56px]">
            <span
              className="font-code text-lg font-bold leading-none tnum"
              style={{
                color: warn ? "#c47808"
                  : active && value > 0 ? color
                  : "var(--foreground)",
              }}
            >
              {value}
            </span>
            <span className="font-code text-[8px] text-[var(--muted-foreground)] mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Status pill */}
      <div className="px-3 py-2.5 shrink-0 flex items-center gap-1.5">
        {(isWorking || isWilted) && (
          <span className="pulse-dot w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
        )}
        <span className="font-code text-[10px] font-bold tracking-wider whitespace-nowrap"
              style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </div>
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

  // Only show the skeleton during the very first load. A missing/empty walTails
  // after load must fall through to the empty state — otherwise the Journal
  // gets stuck on the skeleton forever (the bug Alex hit).
  if (isLoading && !walTails) {
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

  const agentNames = Object.keys(walTails ?? {}).filter((a) => (walTails?.[a]?.length ?? 0) > 0)

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
          const entries = walTails?.[agent] ?? []
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
