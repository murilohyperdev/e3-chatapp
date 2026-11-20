import { useCallback, useEffect, useRef, useState } from 'react'
import {
  endAlert,
  getCurrentAlert,
  pickSquare,
  startAlert,
  type AlertSnapshot,
  type SquareKey,
} from '../api/alerts'
import { ApiError } from '../api/client'
import { subscribeToAlerts, type ConnectionStatus } from '../lib/echo'
import { applySnapshot } from './applySnapshot'

// Owns everything the alert UI needs: the current alert, live updates, catch-up after a
// lost connection, and the three actions. Like useChat, it is the only place that talks
// to the API and to the WebSocket layer, so the components stay purely presentational.
export function useAlert() {
  const [alert, setAlert] = useState<AlertSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [reloadKey, setReloadKey] = useState(0)

  const everConnected = useRef(false)
  const resyncRef = useRef<() => void>(() => undefined)

  const accept = useCallback((incoming: AlertSnapshot) => setAlert((current) => applySnapshot(current, incoming)), [])

  useEffect(() => {
    let active = true
    everConnected.current = false

    // `null` means "no alert yet": never let it erase something a live event already gave us.
    const load = () => getCurrentAlert().then((snapshot) => active && snapshot && accept(snapshot))
    // Used whenever our state may be stale; a failure keeps what is shown (the next trigger retries).
    const resync = () => void load().catch(() => undefined)
    resyncRef.current = resync

    load()
      .then(() => active && setLoadFailed(false))
      .catch(() => active && setLoadFailed(true))
      .finally(() => active && setLoading(false))

    // A tab that was hidden or offline may hold a socket that looks alive but missed events.
    const onVisible = () => document.visibilityState === 'visible' && resync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', resync)

    const unsubscribe = subscribeToAlerts({
      onAlert: accept,
      onStatus: (next) => {
        setStatus(next)
        if (next !== 'connected') return
        // After a drop we may have missed a start, picks or the end: fetch the true state.
        // (The very first connection needs no catch-up: the load above covers it.)
        if (everConnected.current) resync()
        everConnected.current = true
      },
    })

    return () => {
      active = false
      resyncRef.current = () => undefined
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', resync)
      unsubscribe()
    }
  }, [accept, reloadKey])

  const retry = useCallback(() => {
    setLoading(true)
    setLoadFailed(false)
    setReloadKey((key) => key + 1)
  }, [])

  // The actions reject with the API error so the caller can show it. A 409 means the server
  // moved on without us (the alert already ended, or we already picked): fetch the truth too.
  const withResync = useCallback(async (action: () => Promise<AlertSnapshot>) => {
    try {
      accept(await action())
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) resyncRef.current()
      throw error
    }
  }, [accept])
  const start = useCallback(() => withResync(startAlert), [withResync])
  const end = useCallback((alertId: number) => withResync(() => endAlert(alertId)), [withResync])
  const pick = useCallback((alertId: number, square: SquareKey) => withResync(() => pickSquare(alertId, square)), [withResync])

  return { alert, loading, loadFailed, status, retry, start, end, pick }
}
