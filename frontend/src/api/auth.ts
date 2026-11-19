import { api } from './client'

export type UserRole = 'user' | 'administrator'

// Mirrors the server's abilities. The UI only uses them to show or hide controls;
// the server enforces every one of them on each request.
export type Ability =
  | 'send-messages'
  | 'receive-alerts'
  | 'submit-locations'
  | 'view-locations'
  | 'start-alerts'
  | 'end-alerts'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  abilities: Record<Ability, boolean>
}

interface UserEnvelope {
  data: User
}

interface MessageResponse {
  message: string
}

export const getCurrentUser = () => api<UserEnvelope>('/user').then((response) => response.data)

export const login = (email: string, password: string) =>
  api<UserEnvelope>('/login', { method: 'POST', json: { email, password } }).then((response) => response.data)

export const logout = () => api<void>('/logout', { method: 'POST' })

export const requestPasswordReset = (email: string) =>
  api<MessageResponse>('/forgot-password', { method: 'POST', json: { email } })

export const resetPassword = (payload: {
  token: string
  email: string
  password: string
  password_confirmation: string
}) => api<MessageResponse>('/reset-password', { method: 'POST', json: payload })
