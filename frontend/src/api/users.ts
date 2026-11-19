import { api } from './client'
import type { User, UserRole } from './auth'

interface UserEnvelope {
  data: User
}

export interface ProfileInput {
  name: string
  phone: string | null
  address: string | null
}

export interface DirectoryUser {
  id: number
  name: string
  avatar_url: string | null
  role: UserRole
}

export interface DirectoryPage {
  data: DirectoryUser[]
  meta: { current_page: number; last_page: number; total: number }
}

export const updateProfile = (id: number, input: ProfileInput) =>
  api<UserEnvelope>(`/users/${id}`, { method: 'PATCH', json: input }).then((response) => response.data)

export const uploadAvatar = (id: number, file: File) => {
  const form = new FormData()
  form.append('avatar', file)
  return api<UserEnvelope>(`/users/${id}/avatar`, { method: 'POST', form }).then((response) => response.data)
}

export const deleteAvatar = (id: number) =>
  api<UserEnvelope>(`/users/${id}/avatar`, { method: 'DELETE' }).then((response) => response.data)

export const listUsers = (page = 1) => api<DirectoryPage>(`/users?page=${page}`)
