import { api } from './client'

export interface User {
  id: number
  name: string
  email: string
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
