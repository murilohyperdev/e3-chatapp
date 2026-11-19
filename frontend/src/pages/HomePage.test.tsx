import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '../api/auth'
import { AuthContext } from '../auth/AuthContext'
import HomePage, { HIDDEN_TEXT } from './HomePage'

// The chat has its own tests; here it is replaced by a stub.
vi.mock('../components/ChatPanel', () => ({
  ChatPanel: ({ canSend }: { canSend: boolean }) => <div data-testid="chat" data-can-send={canSend} />,
}))

vi.mock('../components/AlertSection', () => ({
  AlertSection: () => <div data-testid="alerts" />,
}))

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

  it('shows the alerts section above the chat', () => {
    renderHome({ id: 1, name: 'Jane', email: 'j@example.com', role: 'user', phone: null, address: null, avatar_url: null, abilities: baseAbilities })
    expect(screen.getByTestId('alerts').compareDocumentPosition(screen.getByTestId('chat'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows the chat and tells it whether the user may send', () => {
    renderHome({ id: 1, name: 'Jane', email: 'j@example.com', role: 'user', phone: null, address: null, avatar_url: null, abilities: baseAbilities })
    expect(screen.getByTestId('chat')).toHaveAttribute('data-can-send', 'true')
  })

  it('contains the required text, exactly, in a 1px white element', () => {
    renderHome({ id: 1, name: 'Jane', email: 'j@example.com', role: 'user', phone: null, address: null, avatar_url: null, abilities: baseAbilities })

    expect(HIDDEN_TEXT).toBe(
      'The dark side consumes you. Have you ever heard of the tragedy of Darth Plagueis the wise?',
    )
    const element = screen.getByText(HIDDEN_TEXT)
    expect(element).toBeInTheDocument()
    const style = getComputedStyle(element)
    expect(style.fontSize).toBe('1px')
    expect(style.color).toBe('rgb(255, 255, 255)')
  })
})
