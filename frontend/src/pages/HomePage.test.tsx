import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '../api/auth'
import { AuthContext } from '../auth/AuthContext'
import HomePage from './HomePage'

const baseAbilities = {
  'send-messages': true,
  'receive-alerts': true,
  'submit-locations': true,
  'view-locations': true,
  'start-alerts': false,
  'end-alerts': false,
}

function renderHome(user: User) {
  return render(
    <AuthContext.Provider value={{ status: 'authenticated', user, signIn: vi.fn(), signOut: vi.fn(), updateUser: vi.fn() }}>
      <HomePage />
    </AuthContext.Provider>,
  )
}

describe('HomePage', () => {
  it('shows a regular user without administrator controls', () => {
    renderHome({ id: 1, name: 'Jane', email: 'j@example.com', role: 'user', phone: null, address: null, avatar_url: null, abilities: baseAbilities })

    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.queryByText(/start and end alerts/i)).not.toBeInTheDocument()
  })

  it('shows the administrator role and alert ability', () => {
    renderHome({
      id: 2,
      name: 'Ada',
      email: 'a@example.com',
      role: 'administrator',
      phone: null,
      address: null,
      avatar_url: null,
      abilities: { ...baseAbilities, 'start-alerts': true, 'end-alerts': true },
    })

    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText(/start and end alerts/i)).toBeInTheDocument()
  })
})
