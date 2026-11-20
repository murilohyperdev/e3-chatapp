import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as alertsApi from '../api/alerts'
import type { AlertSnapshot } from '../api/alerts'
import type { User } from '../api/auth'
import { ApiError } from '../api/client'
import * as echo from '../lib/echo'
import { AlertSection } from './AlertSection'

vi.mock('../api/alerts', async (importOriginal) => ({ ...(await importOriginal<typeof alertsApi>()), getCurrentAlert: vi.fn(), startAlert: vi.fn(), endAlert: vi.fn(), pickSquare: vi.fn() }))
vi.mock('../lib/echo')

const abilities = { 'send-messages': true, 'receive-alerts': true, 'submit-locations': true, 'view-locations': true, 'start-alerts': false, 'end-alerts': false }
const jane: User = { id: 1, name: 'Jane', email: 'j@example.com', role: 'user', phone: null, address: null, avatar_url: null, abilities }
const ada: User = { ...jane, id: 9, name: 'Ada', role: 'administrator', abilities: { ...abilities, 'start-alerts': true, 'end-alerts': true } }

function snapshot(overrides: Partial<AlertSnapshot> = {}): AlertSnapshot {
  return { id: 5, status: 'active', revision: 1, started_at: '2026-01-01T00:00:00Z', ended_at: null, started_by: null, responses: [], ...overrides }
}

let live: Parameters<typeof echo.subscribeToAlerts>[0]

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(echo.subscribeToAlerts).mockImplementation((handlers) => {
    live = handlers
    return vi.fn()
  })
  vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(null)
})

describe('AlertSection', () => {
  it('shows nothing but chat-neutral space when there is no alert and the user is not an administrator', async () => {
    render(<AlertSection user={jane} />)

    await waitFor(() => expect(alertsApi.getCurrentAlert).toHaveBeenCalled())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the modal by itself when an alert starts live, then shows the name in the board after picking', async () => {
    vi.mocked(alertsApi.pickSquare).mockResolvedValue(
      snapshot({ revision: 2, responses: [{ user: { id: 1, name: 'Jane', avatar_url: null }, square: 'c' }] }),
    )
    render(<AlertSection user={jane} />)
    await waitFor(() => expect(alertsApi.getCurrentAlert).toHaveBeenCalled())

    act(() => live.onAlert(snapshot()))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Square C' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('square-c')).toHaveTextContent('Jane (you)')
  })

  it("shows someone else's pick live", async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(snapshot())
    render(<AlertSection user={jane} />)
    await screen.findByRole('dialog')

    act(() => live.onAlert(snapshot({ revision: 2, responses: [{ user: { id: 2, name: 'Bob', avatar_url: null }, square: 'a' }] })))

    expect(screen.getByTestId('square-a')).toHaveTextContent('Bob')
  })

  it('restores an active alert on reload: the modal opens again until the user picks', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(snapshot())
    render(<AlertSection user={jane} />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('closes the modal and shows the ended notice when the alert ends', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(snapshot())
    render(<AlertSection user={jane} />)
    await screen.findByRole('dialog')

    act(() => live.onAlert(snapshot({ status: 'ended', revision: 2, ended_at: '2026-01-01T00:05:00Z' })))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText(/has ended/)).toBeInTheDocument()
  })

  it('closes the modal when a pick is refused because the alert already ended', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot())
    vi.mocked(alertsApi.pickSquare).mockRejectedValue(new ApiError(409, 'This alert has ended: locations are closed.'))
    render(<AlertSection user={jane} />)
    await screen.findByRole('dialog')
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot({ status: 'ended', revision: 3, ended_at: '2026-01-01T00:05:00Z' }))

    await userEvent.click(screen.getByRole('button', { name: 'Square A' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText(/has ended/)).toBeInTheDocument()
  })

  it('shows the ended board when an administrator ends an alert somebody else already ended', async () => {
    // Ada already picked, so her modal is closed and the buttons are reachable.
    const both = [{ user: { id: 1, name: 'Jane', avatar_url: null }, square: 'b' as const }, { user: { id: 9, name: 'Ada', avatar_url: null }, square: 'a' as const }]
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot({ responses: both }))
    vi.mocked(alertsApi.endAlert).mockRejectedValue(new ApiError(409, 'This alert has already ended.'))
    render(<AlertSection user={ada} />)
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot({ status: 'ended', revision: 3, ended_at: '2026-01-01T00:05:00Z', responses: both }))

    await userEvent.click(await screen.findByRole('button', { name: 'End alert' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'End alert' })).not.toBeInTheDocument())
    expect(screen.getByText(/has ended/)).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()
  })

  it('shows the board but no modal to a user who may not submit', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(snapshot())
    render(<AlertSection user={{ ...jane, abilities: { ...abilities, 'submit-locations': false } }} />)

    expect(await screen.findByLabelText('Alert board')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows nothing about alerts to a user who may not receive them', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(snapshot())
    render(<AlertSection user={{ ...jane, abilities: { ...abilities, 'receive-alerts': false } }} />)

    await waitFor(() => expect(alertsApi.getCurrentAlert).toHaveBeenCalled())
    expect(screen.queryByLabelText('Alert board')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lets an administrator start an alert, then end it', async () => {
    vi.mocked(alertsApi.startAlert).mockResolvedValue(snapshot({ responses: [{ user: { id: 9, name: 'Ada', avatar_url: null }, square: 'a' }] }))
    vi.mocked(alertsApi.endAlert).mockResolvedValue(snapshot({ status: 'ended', revision: 2 }))
    render(<AlertSection user={ada} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Start alert' }))
    expect(alertsApi.startAlert).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Start alert' })).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'End alert' }))
    expect(alertsApi.endAlert).toHaveBeenCalledWith(5)
    expect(await screen.findByRole('button', { name: 'Start alert' })).toBeInTheDocument() // a new one may start
  })

  it('shows the server error when starting is refused', async () => {
    vi.mocked(alertsApi.startAlert).mockRejectedValue(new ApiError(409, 'An alert is already active.'))
    render(<AlertSection user={ada} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Start alert' }))

    expect(await screen.findByText('An alert is already active.')).toBeInTheDocument()
  })

  it('shows no start or end button to a regular user', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(snapshot({ responses: [{ user: { id: 1, name: 'Jane', avatar_url: null }, square: 'a' }] }))
    render(<AlertSection user={jane} />)

    await screen.findByLabelText('Alert board')
    expect(screen.queryByRole('button', { name: /start alert|end alert/i })).not.toBeInTheDocument()
  })
})
