import { CircularProgress, Box } from '@mui/material'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'

function FullPageSpinner() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  )
}

/** Renders child routes only for signed-in users; everyone else goes to /login. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}

/** Renders child routes only for visitors; signed-in users go to the home page. */
export function GuestOnly() {
  const { status } = useAuth()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'authenticated') return <Navigate to="/" replace />

  return <Outlet />
}
