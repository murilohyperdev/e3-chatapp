import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import type { ChatMessage } from '../api/messages'
import { useChat } from '../chat/useChat'
import { generalError, fieldError } from '../pages/errors'
import { UserAvatar } from './UserAvatar'

const MAX_LENGTH = 2000
// Within this many pixels of the bottom counts as "reading the latest messages".
const NEAR_BOTTOM = 80

function formatTime(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

function MessageItem({ message, own }: { message: ChatMessage; own: boolean }) {
  return (
    <Stack
      component="li"
      direction={own ? 'row-reverse' : 'row'}
      spacing={1.5}
      sx={{ alignItems: 'flex-start' }}
      data-own={own}
    >
      <UserAvatar name={message.user.name} url={message.user.avatar_url} size={36} />
      <Paper
        elevation={0}
        sx={{
          px: 1.5,
          py: 1,
          maxWidth: '75%',
          bgcolor: own ? 'primary.main' : 'action.hover',
          color: own ? 'primary.contrastText' : 'text.primary',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" component="span">
            {own ? 'You' : message.user.name}
          </Typography>
          <Typography variant="caption" component="time" dateTime={message.created_at} sx={{ opacity: 0.8 }}>
            {formatTime(message.created_at)}
          </Typography>
        </Stack>
        {/* Plain text: React escapes it, and pre-wrap keeps the sender's line breaks. */}
        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.body}</Typography>
      </Paper>
    </Stack>
  )
}

interface ChatPanelProps {
  currentUserId: number
  /** Whether the signed-in user has the `send-messages` ability. */
  canSend: boolean
}

// The shared room: message list (oldest at the top), live connection notice and composer.
export function ChatPanel({ currentUserId, canSend }: ChatPanelProps) {
  const { messages, hasMore, loading, loadFailed, status, loadingOlder, loadOlder, send, retry } = useChat()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<unknown>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const previous = useRef<{ firstId?: number; lastId?: number; height: number }>({ height: 0 })

  // Keep the view where the reader expects it: at the bottom for new messages, and
  // unchanged (not jumping to the top) when older messages are inserted above.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const firstId = messages[0]?.id
    const lastId = messages.at(-1)?.id
    const before = previous.current

    if (before.firstId !== undefined && firstId !== undefined && firstId < before.firstId) {
      list.scrollTop += list.scrollHeight - before.height
    } else if (stickToBottom.current) {
      list.scrollTop = list.scrollHeight
    }
    previous.current = { firstId, lastId, height: list.scrollHeight }
  }, [messages])

  const onScroll = () => {
    const list = listRef.current
    if (list) stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text || sending || !canSend) return
    setSending(true)
    setSendError(null)
    try {
      await send(text)
      setDraft('')
      stickToBottom.current = true // your own message always scrolls into view
    } catch (error) {
      setSendError(error) // keep the draft so nothing typed is lost
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    // Enter sends, Shift+Enter is a new line. Enter while composing (IME) must not send.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }

  const errorText = fieldError(sendError, 'body') ?? generalError(sendError, ['body'])

  return (
    <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '60vh', minHeight: 360 }}>
      {status !== 'connected' && (
        <Alert severity={status === 'offline' ? 'warning' : 'info'} sx={{ borderRadius: 0 }}>
          {status === 'offline'
            ? 'Live updates are offline. Reconnecting…'
            : 'Connecting to live updates…'}
        </Alert>
      )}

      <Box ref={listRef} onScroll={onScroll} sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }} aria-label="Messages">
        {hasMore && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Button size="small" onClick={() => void loadOlder()} disabled={loadingOlder}>
              Load older messages
            </Button>
          </Box>
        )}
        {loadFailed && (
          <Alert severity="error" action={<Button onClick={retry}>Retry</Button>}>
            Could not load the messages.
          </Alert>
        )}
        {!loading && !loadFailed && messages.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            No messages yet. Say hello!
          </Typography>
        )}
        <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} own={message.user.id === currentUserId} />
          ))}
        </Stack>
      </Box>

      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        {errorText && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {errorText}
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={5}
            size="small"
            label={canSend ? 'Message' : 'You cannot send messages'}
            placeholder="Write a message (Enter to send, Shift+Enter for a new line)"
            value={draft}
            disabled={!canSend}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            slotProps={{ htmlInput: { maxLength: MAX_LENGTH } }}
          />
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            onClick={() => void submit()}
            disabled={!canSend || sending || draft.trim() === ''}
          >
            Send
          </Button>
        </Stack>
      </Box>
    </Paper>
  )
}
