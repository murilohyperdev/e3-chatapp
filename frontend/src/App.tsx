import { useEffect, useState } from 'react'
import { Alert, AppBar, Box, Chip, CircularProgress, Container, Stack, Toolbar, Typography } from '@mui/material'
import { getHealth, type HealthResponse } from './api/health'

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error' }

// Skeleton screen: proves the React -> Laravel -> PostgreSQL chain works.
// Real features (auth, chat, alerts) will replace this one feature at a time.
export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    getHealth()
      .then((data) => setState({ kind: 'ok', data }))
      .catch(() => setState({ kind: 'error' }))
  }, [])

  return (
    <Box sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">E3 Chat</Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h5" gutterBottom>
          System status
        </Typography>

        {state.kind === 'loading' && <CircularProgress aria-label="Checking API" />}

        {state.kind === 'error' && (
          <Alert severity="error">Could not reach the API. Is the backend running?</Alert>
        )}

        {state.kind === 'ok' && (
          <Stack spacing={2}>
            <Alert severity="success">Frontend, API and database are connected.</Alert>
            <Stack direction="row" spacing={1}>
              <Chip label={`API: ${state.data.app}`} />
              <Chip label={`Database: ${state.data.database}`} />
            </Stack>
          </Stack>
        )}
      </Container>
    </Box>
  )
}
