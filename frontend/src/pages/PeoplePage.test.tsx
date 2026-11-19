import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as usersApi from '../api/users'
import PeoplePage from './PeoplePage'

vi.mock('../api/users')

const page1 = {
  data: [
    { id: 1, name: 'Ada Admin', avatar_url: '/storage/avatars/ada.png', role: 'administrator' as const },
    { id: 2, name: 'Bob', avatar_url: null, role: 'user' as const },
  ],
  meta: { current_page: 1, last_page: 2, total: 3 },
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('PeoplePage', () => {
  it('lists people with their type and an initial when there is no picture', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue({ ...page1, meta: { ...page1.meta, last_page: 1 } })
    render(<PeoplePage />)

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument() // Bob has no picture
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('loads the next page on demand', async () => {
    vi.mocked(usersApi.listUsers)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce({
        data: [{ id: 3, name: 'Cleo', avatar_url: null, role: 'user' }],
        meta: { current_page: 2, last_page: 2, total: 3 },
      })
    render(<PeoplePage />)

    await userEvent.click(await screen.findByRole('button', { name: /load more/i }))

    expect(await screen.findByText('Cleo')).toBeInTheDocument()
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
    expect(usersApi.listUsers).toHaveBeenLastCalledWith(2)
  })

  it('shows an error when the directory cannot be loaded', async () => {
    vi.mocked(usersApi.listUsers).mockRejectedValue(new Error('boom'))
    render(<PeoplePage />)

    expect(await screen.findByText(/could not load the directory/i)).toBeInTheDocument()
  })
})
