import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UserAvatar } from './UserAvatar'

describe('UserAvatar', () => {
  it('shows the picture when there is one', () => {
    render(<UserAvatar name="Jane" url="/storage/a.png" />)

    expect(screen.getByRole('img', { name: 'Jane' })).toHaveAttribute('src', '/storage/a.png')
  })

  it('falls back to the uppercase initial without a picture', () => {
    render(<UserAvatar name="jane" url={null} />)

    expect(screen.getByText('J')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
