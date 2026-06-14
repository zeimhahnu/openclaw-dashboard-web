"use client"
// eslint-disable react-hooks/set-state-in-effect -- fetchState() pattern: initial data load + polling is the correct React pattern here
import { useState, useEffect, useCallback } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentState {
  inbox_count: number
  working_count: number
  outbox_count: number
}

export interface RouterStats {
  decisions_count: number
  model_breakdown: Record<string, number>
  total_cost_usd: number
}

export interface DailyCostEntry {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface RouterUsage {
  totals: { input_tokens: number; output_tokens: number; cost_usd: number }
  by_day: Record<string, DailyCostEntry>
}

export interface DashboardState {
  ts: string
  agents: Record<string, AgentState>
  router: RouterStats
  wal_tails: Record<string, string[]>
}

export interface TaskActivity {
  active: string[]
  inbox: string[]
}

export interface TaskSummary {
  id: string
  type: string
  status: string
  priority: string
  description: string
  assignedBy: string
  createdAt: string
}

export interface AgentTaskDetails {
  inbox: TaskSummary[]
  outbox: TaskSummary[]
}

export interface FullDashboardState extends DashboardState {
  router_usage: RouterUsage | null
  tasks: Record<string, TaskActivity>
  task_details: Record<string, AgentTaskDetails> | null
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDashboardApi(pollInterval = 7000) {
  const [state, setState] = useState<FullDashboardState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    try {
      const [stateRes, usageRes, detailsRes] = await Promise.all([
        fetch(`${API_BASE}/state`),
        fetch(`${API_BASE}/router/usage`),
        fetch(`${API_BASE}/tasks/details`),
      ])

      if (!stateRes.ok) throw new Error(`state HTTP ${stateRes.status}`)
      const dashState: DashboardState = await stateRes.json()

      let routerUsage: RouterUsage | null = null
      if (usageRes.ok) {
        routerUsage = await usageRes.json()
      }

      let task_details: Record<string, AgentTaskDetails> | null = null
      if (detailsRes.ok) {
        task_details = await detailsRes.json()
      }

      const [activeRes, inboxRes] = await Promise.all([
        fetch(`${API_BASE}/tasks/active`),
        fetch(`${API_BASE}/tasks/inbox`),
      ])

      let tasks: Record<string, TaskActivity> = {}
      if (activeRes.ok && inboxRes.ok) {
        const activeData = await activeRes.json()
        const inboxData = await inboxRes.json()
        const agents = [...new Set([...Object.keys(activeData), ...Object.keys(inboxData)])]
        tasks = Object.fromEntries(
          agents.map((a) => [a, { active: activeData[a] ?? [], inbox: inboxData[a] ?? [] }])
        )
      }

      setState({ ...dashState, router_usage: routerUsage, tasks, task_details })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + polling is the correct React pattern
    fetchState()
    const id = setInterval(fetchState, pollInterval)
    return () => clearInterval(id)
  }, [fetchState, pollInterval])

  return { state, error, loading, refetch: fetchState }
}
