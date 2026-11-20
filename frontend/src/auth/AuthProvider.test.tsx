import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../api/auth'
import { ApiError, setUnauthorizedHandler } from '../api/client'
import * as echo from '../lib/echo'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

vi.mock('../api/auth')
vi.mock('../lib/echo')

const jane: authApi.User = {
  id: 1,
  name: 'Jane',
  email: 'jane@example.com',
  role: 'user',
  phone: null,
  address: null,
  avatar_url: null,
  abilities: {
    'send-messages': true,
    'receive-alerts': true,
    'submit-locations': true,
    'view-locations': true,
    'start-alerts': false,
    'end-alerts': false,
  },
}

// Small consumer that exposes the context as text and buttons.
function Probe() {
  const { status, user, signIn, signOut } = useAuth()
  return (
    <>
      <p>status: {status}</p>
      <p>user: {user?.name ?? 'nobody'}</p>
      <button onClick={() => void signIn('jane@example.com', 'password').catch(() => {})}>sign in</button>
      <button onClick={() => void signOut()}>sign out</button>
    </>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

let unauthorized: (() => void) | null = null

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, setUnauthorizedHandler: vi.fn((handler) => (unauthorized = handler)) }
})

beforeEach(() => {
  vi.resetAllMocks()
  unauthorized = null
  vi.mocked(setUnauthorizedHandler).mockImplementation((handler) => {
    unauthorized = handler
  })
})

describe('AuthProvider', () => {
  it('starts loading, then is authenticated when the server knows the session', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(jane)
    renderProvider()

    expect(screen.getByText('status: loading')).toBeInTheDocument()
    expect(await screen.findByText('status: authenticated')).toBeInTheDocument()
    expect(screen.getByText('user: Jane')).toBeInTheDocument()
  })

  it('is unauthenticated when the session check fails', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401, 'Unauthenticated.', {}))
    renderProvider()

    expect(await screen.findByText('status: unauthenticated')).toBeInTheDocument()
    expect(screen.getByText('user: nobody')).toBeInTheDocument()
  })

  it('signs in and exposes the returned user', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401, 'Unauthenticated.', {}))
    vi.mocked(authApi.login).mockResolvedValue(jane)
    renderProvider()
    await screen.findByText('status: unauthenticated')

    await userEvent.click(screen.getByRole('button', { name: 'sign in' }))

    expect(await screen.findByText('user: Jane')).toBeInTheDocument()
    expect(authApi.login).toHaveBeenCalledWith('jane@example.com', 'password')
  })

  it('stays signed out when sign in is refused', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401, 'Unauthenticated.', {}))
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(422, 'Invalid', { email: ['bad'] }))
    renderProvider()
    await screen.findByText('status: unauthenticated')

    await userEvent.click(screen.getByRole('button', { name: 'sign in' }))

    await waitFor(() => expect(authApi.login).toHaveBeenCalled())
    expect(screen.getByText('status: unauthenticated')).toBeInTheDocument()
    expect(screen.getByText('user: nobody')).toBeInTheDocument()
  })

  it('signs out, clears the user and closes the WebSocket', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(jane)
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
    renderProvider()
    await screen.findByText('user: Jane')

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }))

    expect(await screen.findByText('status: unauthenticated')).toBeInTheDocument()
    expect(echo.disconnectEcho).toHaveBeenCalled()
  })

  it('drops the user when any later request answers 401', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(jane)
    renderProvider()
    await screen.findByText('user: Jane')

    act(() => unauthorized?.())

    expect(await screen.findByText('status: unauthenticated')).toBeInTheDocument()
    expect(echo.disconnectEcho).toHaveBeenCalled()
  })

  it('removes its 401 handler on unmount', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(jane)
    const { unmount } = renderProvider()
    await screen.findByText('user: Jane')

    unmount()

    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null)
  })
})
