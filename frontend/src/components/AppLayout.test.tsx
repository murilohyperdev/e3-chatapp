import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '../api/auth'
import { AuthContext } from '../auth/AuthContext'
import { AppLayout } from './AppLayout'

const jane: User = {
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

function renderLayout(signOut = vi.fn().mockResolvedValue(undefined)) {
  render(
    <AuthContext.Provider value={{ status: 'authenticated', user: jane, signIn: vi.fn(), signOut, updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<p>home content</p>} />
            <Route path="/people" element={<p>people content</p>} />
            <Route path="/profile" element={<p>profile content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return signOut
}

describe('AppLayout', () => {
  it('shows the page, the signed-in name and its initial', () => {
    renderLayout()

    expect(screen.getByText('home content')).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('navigates between pages from the toolbar', async () => {
    renderLayout()

    await userEvent.click(screen.getByRole('link', { name: 'People' }))
    expect(screen.getByText('people content')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'My profile' }))
    expect(screen.getByText('profile content')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'E3 Chat' }))
    expect(screen.getByText('home content')).toBeInTheDocument()
  })

  it('signs out when asked', async () => {
    const signOut = renderLayout()

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(signOut).toHaveBeenCalledOnce()
  })
})
