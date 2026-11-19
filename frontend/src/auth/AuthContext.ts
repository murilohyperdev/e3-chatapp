import { createContext } from 'react'
import type { User } from '../api/auth'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Replace the signed-in user after the server returned a fresh copy (e.g. profile saved). */
  updateUser: (user: User) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
