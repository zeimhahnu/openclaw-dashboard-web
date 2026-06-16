"use client"

import { ArrowRight, Network } from "lucide-react"
import type { AgentTaskDetails, TaskSummary } from "@/hooks/useDashboardApi"

// A2A coordination view — the dashboard half of "reflect A2A in Telegram + dashboard".
// Every task carries assignedBy; its owning queue is assignedTo. So each task is a
// directed edge (by -> to). We surface the recent flow across all agents.

const AGENT = {
  "lil-claw": { name: "Lil Claw", color: "#6ccb8a", short: "LC" },
  goop:       { name: "Goop",     color: "#57c2da", short: "GP" },
  mason:      { name: "Mason",    color: "#a594f5", short: "MS" },
  alex:       { name: "Alex",     color: "#f0b429", short: "AX" },
} as const

function who(id: string): { name: string; color: string; short: string } {
  const k = (id || "").toLowerCase().replace("zeimhahnu", "alex").replace("_bot", "")
  return (AGENT as Record<string, { name: string; color: string; short: string }>)[k]
    ?? { name: id || "?", color: "#9a8358", short: (id || "?").slice(0, 2).toUpperCase() }
}

type Edge = {
  by: string; to: string; desc: string; id: string
  kind: "tending" | "queued" | "wilted" | "delivered"; ts: number
}

function Chip({ id }: { id: string }) {
  const w = who(id)
  return (
    <span className="inline-flex items-center gap-1 font-code text-[10px] px-1.5 py-0.5 rounded shrink-0"
      style={{ color: w.color, backgroundColor: w.color + "14", border: `1px solid ${w.color}33` }}>
      {w.name}
    </span>
  )
}

const KIND_META: Record<Edge["kind"], { label: string; color: string }> = {
  tending:   { label: "tending",   color: "#86b84e" },
  queued:    { label: "queued",    color: "#f0b429" },
  wilted:    { label: "wilted",    color: "#d2683f" },
  delivered: { label: "delivered", color: "#9a8358" },
}

export function CoordinationCard({ taskDetails, isLoading }: {
  taskDetails: Record<string, AgentTaskDetails> | null
  isLoading: boolean
}) {
  if (isLoading && !taskDetails) {
    return (
      <div className="surface p-4">
        <div className="skeleton h-3 w-28 rounded mb-3" />
        {[0, 1, 2].map(i => <div key={i} className="skeleton h-6 w-full rounded mb-1.5" />)}
      </div>
    )
  }

  const edges: Edge[] = []
  const td = taskDetails ?? {}
  for (const owner of Object.keys(td)) {
    const push = (t: TaskSummary, kind: Edge["kind"]) => {
      const by = (t.assignedBy || "").toLowerCase().replace("zeimhahnu", "alex").replace("_bot", "")
      // Skip self-owned bookkeeping; keep genuine handoffs (incl. Alex -> agent).
      if (!by || by === owner) return
      edges.push({
        by, to: owner, desc: t.description || t.id, id: t.id, kind,
        ts: Date.parse(t.createdAt || "") || 0,
      })
    }
    for (const t of td[owner]?.inbox ?? [])
      push(t, t.status === "working" ? "tending" : t.status === "failed" ? "wilted" : "queued")
    for (const t of td[owner]?.outbox ?? []) push(t, "delivered")
  }
  edges.sort((a, b) => b.ts - a.ts)
  const recent = edges.slice(0, 14)

  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 mb-3">
        <Network className="h-3.5 w-3.5 text-[var(--primary)]" />
        <span className="font-pixel text-[8px] text-[var(--primary)]">THE EXCHANGE</span>
        <span className="ml-auto font-code text-[10px] text-[var(--muted-foreground)]">
          {edges.length} handoffs
        </span>
      </div>

      {recent.length === 0 ? (
        <p className="font-code text-[11px] text-[var(--muted-foreground)]">{"// no handoffs between villagers yet"}</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {recent.map((e, i) => {
            const k = KIND_META[e.kind]
            return (
              <div key={`${e.id}-${i}`} className="flex items-center gap-2 py-0.5">
                <Chip id={e.by} />
                <ArrowRight className="h-3 w-3 text-[var(--faint)] shrink-0" />
                <Chip id={e.to} />
                <span className="font-code text-[10px] text-[var(--muted-foreground)] truncate flex-1 min-w-0">
                  {e.desc.length > 64 ? e.desc.slice(0, 63) + "…" : e.desc}
                </span>
                <span className="font-code text-[9px] shrink-0" style={{ color: k.color }}>
                  {k.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
