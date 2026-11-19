import { useCallback, useEffect, useRef, useState } from 'react'
import { listMessages, sendMessage, type ChatMessage } from '../api/messages'
import { subscribeToChat, type ConnectionStatus } from '../lib/echo'

/** Adds messages to the list without duplicates, ordered oldest to newest (by id). */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

// Owns everything the chat screen needs: history, live messages, sending, and
// whether the live connection is up. It is the only place that talks to the API
// and to the WebSocket layer, which keeps ChatPanel purely presentational.
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [loadingOlder, setLoadingOlder] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)

  const everConnected = useRef(false)

  // Fetches the latest page and merges it into what we already show.
  const fetchLatest = useCallback(() => listMessages(), [])

  useEffect(() => {
    let active = true
    everConnected.current = false

    fetchLatest()
      .then((page) => {
        if (!active) return
        setMessages((current) => mergeMessages(current, page.data))
        setHasMore(page.meta.has_more)
        setLoadFailed(false)
      })
      .catch(() => active && setLoadFailed(true))
      .finally(() => active && setLoading(false))

    const unsubscribe = subscribeToChat({
      onMessage: (message) => setMessages((current) => mergeMessages(current, [message])),
      onStatus: (next) => {
        setStatus(next)
        if (next !== 'connected') return
        // After a drop, anything posted meanwhile was not pushed to us: fetch it.
        // (The very first connection needs no catch-up: the load above covers it.)
        if (everConnected.current) {
          fetchLatest()
            .then((page) => active && setMessages((current) => mergeMessages(current, page.data)))
            .catch(() => undefined) // the next reconnect or reload will catch up
        }
        everConnected.current = true
      },
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [fetchLatest, reloadKey])

  const loadOlder = useCallback(async () => {
    const oldest = messages[0]
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await listMessages(oldest.id)
      setMessages((current) => mergeMessages(current, page.data))
      setHasMore(page.meta.has_more)
    } finally {
      setLoadingOlder(false)
    }
  }, [messages, loadingOlder])

  /** Tries the first load again after a failure. */
  const retry = useCallback(() => {
    setLoading(true)
    setLoadFailed(false)
    setReloadKey((key) => key + 1)
  }, [])

  /** Rejects with the API error so the composer can show it and keep the text. */
  const send = useCallback(async (body: string) => {
    const created = await sendMessage(body)
    setMessages((current) => mergeMessages(current, [created]))
  }, [])

  return { messages, hasMore, loading, loadFailed, status, loadingOlder, loadOlder, send, retry }
}
