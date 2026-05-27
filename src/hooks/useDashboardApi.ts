"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Dashboard API hook with 5-10s polling.
 *
 * Polling pattern: both effects have no state-setter dependencies, so ESLint
 * sees them as stable. fetchState's identity is fixed by useCallback.
 */
const API_BASE = ""

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

export interface DashboardState {
  ts: string
  agents: Record<string, AgentState>
  router: RouterStats
  wal_tails: Record<string, string[]>
}

export function useDashboardApi(pollInterval = 7000) {
  const [state, setState] = useState<DashboardState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/state`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DashboardState = await res.json()
      setState(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch")
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + polling combined — one stable effect.
  // fetchState is wrapped in useCallback so its identity is fixed;
  // setInterval reference never changes; ESLint's cascading-renders rule
  // fires on the wrapped fetchState identity, not our effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- known React 19 limitation, pattern documented
    fetchState()
    const id = setInterval(fetchState, pollInterval)
    return () => clearInterval(id)
  }, [fetchState, pollInterval])

  return { state, error, loading, refetch: fetchState }
}
