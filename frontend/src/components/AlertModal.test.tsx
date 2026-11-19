import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AlertSnapshot } from '../api/alerts'
import { ApiError } from '../api/client'
import { AlertModal } from './AlertModal'

const ME = 1

function alert(overrides: Partial<AlertSnapshot> = {}): AlertSnapshot {
  return {
    id: 7, status: 'active', revision: 1, started_at: '2026-01-01T00:00:00Z', ended_at: null,
    started_by: { id: 9, name: 'Ada' }, responses: [], ...overrides,
  }
}

const render_ = (snapshot: AlertSnapshot | null, canSubmit = true, onPick = vi.fn().mockResolvedValue(undefined)) => {
  render(<AlertModal alert={snapshot} currentUserId={ME} canSubmit={canSubmit} onPick={onPick} />)
  return onPick
}

describe('AlertModal', () => {
  it('opens with four labeled squares for an active alert', () => {
    render_(alert())

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    for (const label of ['Square A', 'Square B', 'Square C', 'Square D']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('sends the chosen square', async () => {
    const onPick = render_(alert())

    await userEvent.click(screen.getByRole('button', { name: 'Square C' }))

    expect(onPick).toHaveBeenCalledWith(7, 'c')
  })

  it('cannot be dismissed with Escape', async () => {
    render_(alert())

    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows the error and stays open when the server refuses the pick', async () => {
    render_(alert(), true, vi.fn().mockRejectedValue(new ApiError(409, 'You have already picked a location for this alert.')))

    await userEvent.click(screen.getByRole('button', { name: 'Square A' }))

    expect(await screen.findByText(/already picked/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Square A' })).toBeEnabled())
  })

  it('is closed once the user has picked', () => {
    render_(alert({ responses: [{ user: { id: ME, name: 'Me', avatar_url: null }, square: 'a' }] }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stays open when only somebody else has picked', () => {
    render_(alert({ responses: [{ user: { id: 2, name: 'Bob', avatar_url: null }, square: 'a' }] }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('is closed for an ended alert, no alert, or a user who may not submit', () => {
    const { unmount } = render(<AlertModal alert={alert({ status: 'ended' })} currentUserId={ME} canSubmit onPick={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render_(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is closed without the submit-locations ability', () => {
    render_(alert(), false)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
