import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AlertSnapshot } from '../api/alerts'
import { AlertBoard } from './AlertBoard'

const person = (id: number, name: string) => ({ id, name, avatar_url: null })

function alert(overrides: Partial<AlertSnapshot> = {}): AlertSnapshot {
  return { id: 1, status: 'active', revision: 1, started_at: '2026-01-01T00:00:00Z', ended_at: null, started_by: null, responses: [], ...overrides }
}

describe('AlertBoard', () => {
  it('shows four labeled squares even when nobody picked', () => {
    render(<AlertBoard alert={alert()} currentUserId={1} />)

    for (const key of ['a', 'b', 'c', 'd']) expect(screen.getByTestId(`square-${key}`)).toBeInTheDocument()
    expect(screen.getByText('Square A')).toBeInTheDocument()
    expect(screen.getByText('Square D')).toBeInTheDocument()
  })

  it('puts each name in the square that was picked, several in one square', () => {
    render(
      <AlertBoard
        currentUserId={1}
        alert={alert({
          responses: [
            { user: person(1, 'Me'), square: 'b' },
            { user: person(2, 'Bob'), square: 'b' },
            { user: person(3, 'Cy'), square: 'd' },
          ],
        })}
      />,
    )

    const b = within(screen.getByTestId('square-b'))
    expect(b.getByText('Me (you)')).toBeInTheDocument()
    expect(b.getByText('Bob')).toBeInTheDocument()
    expect(within(screen.getByTestId('square-d')).getByText('Cy')).toBeInTheDocument()
    expect(within(screen.getByTestId('square-a')).queryByText('Bob')).not.toBeInTheDocument()
  })

  it('says when the alert is active and when it has ended', () => {
    const { rerender } = render(<AlertBoard alert={alert()} currentUserId={1} />)
    expect(screen.getByText(/Alert active/)).toBeInTheDocument()

    rerender(<AlertBoard alert={alert({ status: 'ended' })} currentUserId={1} />)
    expect(screen.getByText(/has ended/)).toBeInTheDocument()
  })
})
