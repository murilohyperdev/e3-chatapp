import { api } from './client'

/** The four places a person can pick. Keys match the server's `Square` enum. */
export const SQUARES = [
  { key: 'a', label: 'Square A' },
  { key: 'b', label: 'Square B' },
  { key: 'c', label: 'Square C' },
  { key: 'd', label: 'Square D' },
] as const

export type SquareKey = (typeof SQUARES)[number]['key']

export interface AlertResponse {
  user: { id: number; name: string; avatar_url: string | null }
  square: SquareKey
}

/** The whole state of one alert: the same JSON as the HTTP responses and the live event. */
export interface AlertSnapshot {
  id: number
  status: 'active' | 'ended'
  /** Grows on every change; lets the client ignore an older snapshot that arrives late. */
  revision: number
  started_at: string
  ended_at: string | null
  started_by: { id: number; name: string } | null
  responses: AlertResponse[]
}

/** The latest alert (active or ended), or null when none was ever started. */
export const getCurrentAlert = () => api<{ data: AlertSnapshot | null }>('/alerts/current').then((r) => r.data)

export const startAlert = () => api<{ data: AlertSnapshot }>('/alerts', { method: 'POST' }).then((r) => r.data)

export const endAlert = (alertId: number) =>
  api<{ data: AlertSnapshot }>(`/alerts/${alertId}/end`, { method: 'POST' }).then((r) => r.data)

export const pickSquare = (alertId: number, square: SquareKey) =>
  api<{ data: AlertSnapshot }>(`/alerts/${alertId}/responses`, { method: 'POST', json: { square } }).then(
    (r) => r.data,
  )
