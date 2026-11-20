import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../api/auth'
import { ApiError } from '../api/client'
import { AuthContext } from '../auth/AuthContext'
import ForgotPasswordPage from './ForgotPasswordPage'
import LoginPage from './LoginPage'
import ResetPasswordPage from './ResetPasswordPage'

vi.mock('../api/auth')

const signIn = vi.fn()

function renderLogin() {
  return render(
    <AuthContext.Provider value={{ status: 'unauthenticated', user: null, signIn, signOut: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('LoginPage', () => {
  it('signs in and goes to the home page', async () => {
    signIn.mockResolvedValue(undefined)
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(signIn).toHaveBeenCalledWith('jane@example.com', 'password')
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })

  it('shows the server validation error', async () => {
    signIn.mockRejectedValue(new ApiError(422, 'Invalid', { email: ['These credentials do not match.'] }))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'bad')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('These credentials do not match.')).toBeInTheDocument()
  })
})

describe('ForgotPasswordPage', () => {
  it('shows the confirmation message', async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue({ message: 'We have emailed your link.' })
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('We have emailed your link.')).toBeInTheDocument()
    expect(authApi.requestPasswordReset).toHaveBeenCalledWith('jane@example.com')
  })
})

describe('ForgotPasswordPage failures', () => {
  function renderForgot() {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )
  }

  it('shows the validation error under the email field and no success message', async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValue(
      new ApiError(422, 'Invalid', { email: ['The email field must be a valid email address.'] }),
    )
    renderForgot()

    await userEvent.type(screen.getByLabelText(/email/i), 'nope')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('The email field must be a valid email address.')).toBeInTheDocument()
    expect(screen.queryByText(/emailed/i)).not.toBeInTheDocument()
  })

  it('shows a generic error when the request itself fails', async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValue(new TypeError('network down'))
    renderForgot()

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })
})

describe('ResetPasswordPage', () => {
  function renderReset(search: string) {
    return render(
      <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('submits the token and email from the link, then goes to login', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ message: 'ok' })
    renderReset('?token=tok123&email=jane%40example.com')

    await userEvent.type(screen.getByLabelText(/^new password/i), 'brand-new-pass')
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), 'brand-new-pass')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() =>
      expect(authApi.resetPassword).toHaveBeenCalledWith({
        token: 'tok123',
        email: 'jane@example.com',
        password: 'brand-new-pass',
        password_confirmation: 'brand-new-pass',
      }),
    )
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('shows the server error for an invalid token', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new ApiError(422, 'Invalid', { email: ['This password reset token is invalid.'] }),
    )
    renderReset('?token=bad&email=jane%40example.com')

    await userEvent.type(screen.getByLabelText(/^new password/i), 'brand-new-pass')
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), 'brand-new-pass')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('This password reset token is invalid.')).toBeInTheDocument()
  })

  it('explains an incomplete link', () => {
    renderReset('')
    expect(screen.getByText(/link is incomplete/i)).toBeInTheDocument()
  })
})
