"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * API calls go to relative URLs (/state, /healthz).
 * Nginx reverse-proxies these to the FastAPI backend on port 8443.
 * No CORS, no cross-origin — same origin by design.
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

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, pollInterval)
    return () => clearInterval(interval)
  }, [fetchState, pollInterval])

  return { state, error, loading, refetch: fetchState }
}
