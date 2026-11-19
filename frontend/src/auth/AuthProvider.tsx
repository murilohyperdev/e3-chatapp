import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, login, logout, type User } from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext'

// Single source of truth for "who is signed in". The server owns the session;
// on load we only ask it who we are (GET /api/user) instead of storing anything
// in the browser.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let cancelled = false

    getCurrentUser()
      .then((current) => {
        if (cancelled) return
        setUser(current)
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
        setStatus('unauthenticated')
      })

    // Any later 401 means the session expired: drop the user, guards redirect to /login.
    setUnauthorizedHandler(() => {
      setUser(null)
      setStatus('unauthenticated')
    })

    return () => {
      cancelled = true
      setUnauthorizedHandler(null)
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const signedIn = await login(email, password)
    setUser(signedIn)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    await logout()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signOut, updateUser: setUser }),
    [status, user, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
