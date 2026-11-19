import { Chip, Stack, Typography } from '@mui/material'
import { useAuth } from '../auth/useAuth'

// Placeholder: chat and alerts will be added here later.
export default function HomePage() {
  const { user } = useAuth()

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Welcome, {user?.name}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip label={user?.role === 'administrator' ? 'Administrator' : 'User'} color="primary" />
        {user?.abilities['start-alerts'] && <Chip label="Can start and end alerts" variant="outlined" />}
      </Stack>
      <Typography color="text.secondary">You are signed in. Chat and alerts are coming next.</Typography>
    </>
  )
}
