import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { csrfHeaders, setSocketIdProvider } from '../api/client'
import type { ChatMessage } from '../api/messages'

// Real-time layer. Everything that knows about WebSockets lives in this file, so
// the rest of the app (and its tests) only deal with plain callbacks.

export type ConnectionStatus = 'connecting' | 'connected' | 'offline'

/** Options for Echo, separated from the instance so a test can check them. */
export function echoOptions() {
  const { protocol, hostname, port } = window.location
  const secure = protocol === 'https:'
  const wsPort = Number(port) || (secure ? 443 : 80)

  return {
    broadcaster: 'reverb' as const,
    key: import.meta.env.VITE_REVERB_APP_KEY as string,
    // The page's own origin: Vite (dev) or the web server (prod) forwards /app to Reverb.
    wsHost: hostname,
    wsPort,
    wssPort: wsPort,
    forceTLS: secure,
    enabledTransports: ['ws', 'wss'] as Array<'ws' | 'wss'>,
    // Private channels are authorised by the API with the session cookie. The CSRF
    // header is read on every attempt so a rotated token is never stale.
    channelAuthorization: {
      endpoint: '/api/broadcasting/auth',
      transport: 'ajax' as const,
      headersProvider: () => csrfHeaders(),
    },
  }
}

let echo: Echo<'reverb'> | null = null

function getEcho(): Echo<'reverb'> {
  if (!echo) {
    // Echo's Pusher client is looked up on `window` by the connector.
    ;(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher
    echo = new Echo(echoOptions())
    setSocketIdProvider(() => echo?.socketId())
  }
  return echo
}

/** Closes the connection (used on sign-out so the next user starts clean). */
export function disconnectEcho() {
  echo?.disconnect()
  echo = null
  setSocketIdProvider(null)
}

const STATE_TO_STATUS: Record<string, ConnectionStatus> = {
  connected: 'connected',
  connecting: 'connecting',
  initialized: 'connecting',
  unavailable: 'offline',
  failed: 'offline',
  disconnected: 'offline',
}

interface ChatSubscription {
  onMessage: (message: ChatMessage) => void
  onStatus: (status: ConnectionStatus) => void
}

/** Listens to the private `chat` channel; returns a function that stops listening. */
export function subscribeToChat({ onMessage, onStatus }: ChatSubscription): () => void {
  const instance = getEcho()
  const connection = instance.connector.pusher.connection

  const onStateChange = ({ current }: { current: string }) => onStatus(STATE_TO_STATUS[current] ?? 'connecting')
  connection.bind('state_change', onStateChange)
  onStatus(STATE_TO_STATUS[connection.state] ?? 'connecting')

  // The leading dot means "use this exact event name" (broadcastAs on the server).
  instance.private('chat').listen('.message.created', onMessage)

  return () => {
    connection.unbind('state_change', onStateChange)
    instance.leave('chat')
  }
}
