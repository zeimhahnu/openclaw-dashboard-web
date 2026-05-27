"use client"

import { useEffect, useState, useCallback } from "react"

const API_BASE = "https://dashboard.vpszeimhahnu.uk"

interface DashboardState {
  ts: string
  agents: Record<string, { inbox_count: number; working_count: number; outbox_count: number }>
  router: { decisions_count: number; total_cost_usd: number; model_breakdown: Record<string, number> }
  wal_tails: Record<string, string[]>
}

export function useDashboardApi(pollIntervalMs = 7000) {
  const [state, setState] = useState<DashboardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/state`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DashboardState = await res.json()
      setState(data)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? "fetch failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
    const id = setInterval(fetchState, pollIntervalMs)
    return () => clearInterval(id)
  }, [fetchState, pollIntervalMs])

  return { state, loading, error, refetch: fetchState }
}