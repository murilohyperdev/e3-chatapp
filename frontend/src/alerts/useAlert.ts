import { useCallback, useEffect, useRef, useState } from 'react'
import {
  endAlert,
  getCurrentAlert,
  pickSquare,
  startAlert,
  type AlertSnapshot,
  type SquareKey,
} from '../api/alerts'
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

  const accept = useCallback((incoming: AlertSnapshot) => setAlert((current) => applySnapshot(current, incoming)), [])

  useEffect(() => {
    let active = true
    everConnected.current = false

    // `null` means "no alert yet": never let it erase something a live event already gave us.
    const load = () => getCurrentAlert().then((snapshot) => active && snapshot && accept(snapshot))

    load()
      .then(() => active && setLoadFailed(false))
      .catch(() => active && setLoadFailed(true))
      .finally(() => active && setLoading(false))

    const unsubscribe = subscribeToAlerts({
      onAlert: accept,
      onStatus: (next) => {
        setStatus(next)
        if (next !== 'connected') return
        // After a drop we may have missed a start, picks or the end: fetch the true state.
        // (The very first connection needs no catch-up: the load above covers it.)
        if (everConnected.current) load().catch(() => undefined)
        everConnected.current = true
      },
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [accept, reloadKey])

  const retry = useCallback(() => {
    setLoading(true)
    setLoadFailed(false)
    setReloadKey((key) => key + 1)
  }, [])

  // The actions reject with the API error so the caller can show it.
  const start = useCallback(async () => accept(await startAlert()), [accept])
  const end = useCallback(async (alertId: number) => accept(await endAlert(alertId)), [accept])
  const pick = useCallback(async (alertId: number, square: SquareKey) => accept(await pickSquare(alertId, square)), [accept])

  return { alert, loading, loadFailed, status, retry, start, end, pick }
}
