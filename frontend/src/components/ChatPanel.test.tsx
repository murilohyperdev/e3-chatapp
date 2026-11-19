import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as messagesApi from '../api/messages'
import type { ChatMessage } from '../api/messages'
import * as echo from '../lib/echo'
import { ChatPanel } from './ChatPanel'

vi.mock('../api/messages')
vi.mock('../lib/echo')

const ME = 1

function message(id: number, body: string, userId = 2, name = 'Bob'): ChatMessage {
  return { id, body, created_at: '2026-01-02T10:30:00Z', user: { id: userId, name, avatar_url: null } }
}

// The fake real-time layer: tests push live messages / status changes by hand.
let live: Parameters<typeof echo.subscribeToChat>[0]
const unsubscribe = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(echo.subscribeToChat).mockImplementation((handlers) => {
    live = handlers
    return unsubscribe
  })
  vi.mocked(messagesApi.listMessages).mockResolvedValue({ data: [], meta: { has_more: false } })
})

function renderChat(canSend = true) {
  return render(<ChatPanel currentUserId={ME} canSend={canSend} />)
}

describe('ChatPanel', () => {
  it('lists messages with sender and time, and marks my own', async () => {
    vi.mocked(messagesApi.listMessages).mockResolvedValue({
      data: [message(1, 'Hi there'), message(2, 'Hello back', ME, 'Me')],
      meta: { has_more: false },
    })
    renderChat()

    expect(await screen.findByText('Hi there')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getAllByRole('time')).toHaveLength(2)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveAttribute('data-own', 'false')
    expect(items[1]).toHaveAttribute('data-own', 'true')
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('shows a friendly note when the room is empty', async () => {
    renderChat()
    expect(await screen.findByText(/no messages yet/i)).toBeInTheDocument()
  })

  it('shows a message pushed live by another user, without a reload', async () => {
    renderChat()
    await screen.findByText(/no messages yet/i)

    act(() => live.onMessage(message(5, 'Live hello')))

    expect(await screen.findByText('Live hello')).toBeInTheDocument()
  })

  it('does not show the same message twice when it arrives live and from history', async () => {
    vi.mocked(messagesApi.listMessages).mockResolvedValue({ data: [message(5, 'Once')], meta: { has_more: false } })
    renderChat()
    await screen.findByText('Once')

    act(() => live.onMessage(message(5, 'Once')))

    expect(screen.getAllByText('Once')).toHaveLength(1)
  })

  it('sends with the button, shows the message once and clears the box', async () => {
    vi.mocked(messagesApi.sendMessage).mockResolvedValue(message(9, 'My text', ME, 'Me'))
    renderChat()
    await userEvent.type(await screen.findByRole('textbox'), 'My text')

    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(messagesApi.sendMessage).toHaveBeenCalledWith('My text')
    expect(await screen.findByText('My text')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
    // The server skips the sender when broadcasting; even if it did not, ids are merged.
    act(() => live.onMessage(message(9, 'My text', ME, 'Me')))
    expect(screen.getAllByText('My text')).toHaveLength(1)
  })

  it('sends on Enter and adds a new line on Shift+Enter', async () => {
    vi.mocked(messagesApi.sendMessage).mockResolvedValue(message(9, 'a', ME, 'Me'))
    renderChat()
    const box = await screen.findByRole('textbox')

    await userEvent.type(box, 'line one{Shift>}{Enter}{/Shift}line two')
    expect(messagesApi.sendMessage).not.toHaveBeenCalled()
    expect(box).toHaveValue('line one\nline two')

    await userEvent.type(box, '{Enter}')
    expect(messagesApi.sendMessage).toHaveBeenCalledWith('line one\nline two')
  })

  it('does not send an empty or blank message', async () => {
    renderChat()
    const box = await screen.findByRole('textbox')

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    await userEvent.type(box, '   {Enter}')

    expect(messagesApi.sendMessage).not.toHaveBeenCalled()
  })

  it('shows the server error and keeps what was typed', async () => {
    vi.mocked(messagesApi.sendMessage).mockRejectedValue(
      new ApiError(422, 'The body field is required.', { body: ['The message is too long.'] }),
    )
    renderChat()
    await userEvent.type(await screen.findByRole('textbox'), 'keep me')

    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText('The message is too long.')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('keep me')
  })

  it('shows a generic error for a failure that is not about the text', async () => {
    vi.mocked(messagesApi.sendMessage).mockRejectedValue(new Error('network'))
    renderChat()
    await userEvent.type(await screen.findByRole('textbox'), 'hi')

    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('hi')
  })

  it('disables the composer but keeps messages readable without the send ability', async () => {
    vi.mocked(messagesApi.listMessages).mockResolvedValue({ data: [message(1, 'Readable')], meta: { has_more: false } })
    renderChat(false)

    expect(await screen.findByText('Readable')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('loads older messages above the current ones', async () => {
    vi.mocked(messagesApi.listMessages)
      .mockResolvedValueOnce({ data: [message(10, 'Newer')], meta: { has_more: true } })
      .mockResolvedValueOnce({ data: [message(3, 'Older')], meta: { has_more: false } })
    renderChat()

    await userEvent.click(await screen.findByRole('button', { name: /load older/i }))

    expect(await screen.findByText('Older')).toBeInTheDocument()
    expect(messagesApi.listMessages).toHaveBeenLastCalledWith(10)
    const bodies = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(bodies[0]).toContain('Older')
    expect(bodies[1]).toContain('Newer')
    expect(screen.queryByRole('button', { name: /load older/i })).not.toBeInTheDocument()
  })

  it('tells the user when live updates are offline, and hides the notice once connected', async () => {
    renderChat()
    await screen.findByText(/no messages yet/i)

    act(() => live.onStatus('offline'))
    expect(screen.getByText(/live updates are offline/i)).toBeInTheDocument()

    act(() => live.onStatus('connected'))
    expect(screen.queryByText(/live updates are offline/i)).not.toBeInTheDocument()
  })

  it('fetches what it missed after the connection comes back', async () => {
    renderChat()
    await screen.findByText(/no messages yet/i)
    act(() => live.onStatus('connected')) // first connection: nothing to catch up
    expect(messagesApi.listMessages).toHaveBeenCalledTimes(1)

    act(() => live.onStatus('offline'))
    vi.mocked(messagesApi.listMessages).mockResolvedValueOnce({
      data: [message(7, 'Posted while offline')],
      meta: { has_more: false },
    })
    act(() => live.onStatus('connected'))

    expect(await screen.findByText('Posted while offline')).toBeInTheDocument()
  })

  it('offers a retry when the history cannot be loaded', async () => {
    vi.mocked(messagesApi.listMessages).mockRejectedValueOnce(new Error('boom'))
    renderChat()
    expect(await screen.findByText(/could not load the messages/i)).toBeInTheDocument()

    vi.mocked(messagesApi.listMessages).mockResolvedValueOnce({ data: [message(1, 'Back')], meta: { has_more: false } })
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByText('Back')).toBeInTheDocument()
  })

  it('renders message text as plain text, never as HTML', async () => {
    vi.mocked(messagesApi.listMessages).mockResolvedValue({
      data: [message(1, '<img src=x onerror=alert(1)> <b>bold</b>')],
      meta: { has_more: false },
    })
    const { container } = renderChat()

    expect(await screen.findByText(/<img src=x/)).toBeInTheDocument()
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('stops listening when it unmounts', async () => {
    const { unmount } = renderChat()
    await waitFor(() => expect(echo.subscribeToChat).toHaveBeenCalled())

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
