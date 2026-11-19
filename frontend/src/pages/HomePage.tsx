import { AppBar, Button, Chip, Container, Stack, Toolbar, Typography } from '@mui/material'
import { useAuth } from '../auth/useAuth'

// Placeholder shell: chat, alerts and profiles will be added here later.
export default function HomePage() {
  const { user, signOut } = useAuth()

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            E3 Chat
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <Button color="inherit" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h5" gutterBottom>
          Welcome, {user?.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip label={user?.role === 'administrator' ? 'Administrator' : 'User'} color="primary" />
          {user?.abilities['start-alerts'] && <Chip label="Can start and end alerts" variant="outlined" />}
        </Stack>
        <Typography color="text.secondary">You are signed in. Chat and alerts are coming next.</Typography>
      </Container>
    </>
  )
}
