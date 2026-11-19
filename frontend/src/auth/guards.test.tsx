import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { GuestOnly, RequireAuth } from './guards'

function renderAt(path: string, value: Partial<AuthContextValue>) {
  const context: AuthContextValue = {
    status: 'unauthenticated',
    user: null,
    signIn: async () => {},
    signOut: async () => {},
    ...value,
  }

  return render(
    <AuthContext.Provider value={context}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<p>login page</p>} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>home page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const user = { id: 1, name: 'Jane', email: 'jane@example.com' }

describe('route guards', () => {
  it('sends visitors from a protected page to the login page', () => {
    renderAt('/', { status: 'unauthenticated' })
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('lets signed-in users see protected pages', () => {
    renderAt('/', { status: 'authenticated', user })
    expect(screen.getByText('home page')).toBeInTheDocument()
  })

  it('sends signed-in users away from the login page', () => {
    renderAt('/login', { status: 'authenticated', user })
    expect(screen.getByText('home page')).toBeInTheDocument()
  })

  it('shows a spinner while the session is being checked', () => {
    renderAt('/', { status: 'loading' })
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.queryByText('home page')).not.toBeInTheDocument()
  })
})
