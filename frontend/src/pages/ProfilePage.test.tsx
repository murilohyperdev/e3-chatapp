import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../api/auth'
import { ApiError } from '../api/client'
import * as usersApi from '../api/users'
import { AuthContext } from '../auth/AuthContext'
import ProfilePage from './ProfilePage'

vi.mock('../api/users')

const user: User = {
  id: 7,
  name: 'Jane',
  email: 'jane@example.com',
  phone: null,
  address: null,
  avatar_url: null,
  role: 'user',
  abilities: {
    'send-messages': true,
    'receive-alerts': true,
    'submit-locations': true,
    'view-locations': true,
    'start-alerts': false,
    'end-alerts': false,
  },
}

const updateUser = vi.fn()

function renderProfile(current: User = user) {
  return render(
    <AuthContext.Provider
      value={{ status: 'authenticated', user: current, signIn: vi.fn(), signOut: vi.fn(), updateUser }}
    >
      <ProfilePage />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ProfilePage', () => {
  it('saves the profile and updates the signed-in user', async () => {
    const saved = { ...user, name: 'Jane Doe', phone: '+55 11 91234-5678' }
    vi.mocked(usersApi.updateProfile).mockResolvedValue(saved)
    renderProfile()

    await userEvent.clear(screen.getByLabelText(/^name/i))
    await userEvent.type(screen.getByLabelText(/^name/i), 'Jane Doe')
    await userEvent.type(screen.getByLabelText(/^phone/i), '+55 11 91234-5678')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(usersApi.updateProfile).toHaveBeenCalledWith(7, {
        name: 'Jane Doe',
        phone: '+55 11 91234-5678',
        address: null,
      }),
    )
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
    expect(updateUser).toHaveBeenCalledWith(saved)
  })

  it('shows server validation errors under the field', async () => {
    vi.mocked(usersApi.updateProfile).mockRejectedValue(
      new ApiError(422, 'Invalid', { phone: ['The phone may only contain digits.'] }),
    )
    renderProfile()

    await userEvent.type(screen.getByLabelText(/^phone/i), 'abc')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('The phone may only contain digits.')).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('uploads a picture', async () => {
    const withPicture = { ...user, avatar_url: '/storage/avatars/a.png' }
    vi.mocked(usersApi.uploadAvatar).mockResolvedValue(withPicture)
    renderProfile()
    const file = new File(['x'], 'me.png', { type: 'image/png' })

    await userEvent.upload(screen.getByLabelText('Picture file'), file)

    await waitFor(() => expect(usersApi.uploadAvatar).toHaveBeenCalledWith(7, file))
    expect(updateUser).toHaveBeenCalledWith(withPicture)
  })

  it('shows the upload error from the server', async () => {
    vi.mocked(usersApi.uploadAvatar).mockRejectedValue(
      new ApiError(422, 'Invalid', { avatar: ['The avatar must not be greater than 2048 kilobytes.'] }),
    )
    renderProfile()

    await userEvent.upload(
      screen.getByLabelText('Picture file'),
      new File(['x'], 'big.png', { type: 'image/png' }),
    )

    expect(await screen.findByText(/must not be greater than 2048/i)).toBeInTheDocument()
  })

  it('removes the picture when there is one', async () => {
    const withPicture = { ...user, avatar_url: '/storage/avatars/a.png' }
    vi.mocked(usersApi.deleteAvatar).mockResolvedValue(user)
    renderProfile(withPicture)

    await userEvent.click(screen.getByRole('button', { name: /remove picture/i }))

    await waitFor(() => expect(usersApi.deleteAvatar).toHaveBeenCalledWith(7))
    expect(updateUser).toHaveBeenCalledWith(user)
  })

  it('does not offer to remove a picture that does not exist', () => {
    renderProfile()
    expect(screen.queryByRole('button', { name: /remove picture/i })).not.toBeInTheDocument()
  })
})
