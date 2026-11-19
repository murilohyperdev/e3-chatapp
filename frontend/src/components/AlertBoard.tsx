import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { SQUARES, type AlertSnapshot } from '../api/alerts'

interface AlertBoardProps {
  alert: AlertSnapshot
  currentUserId: number
}

// The shared 2x2 map: every square with the names of the people who picked it.
// Several people can share a square. It updates as new snapshots arrive.
export function AlertBoard({ alert, currentUserId }: AlertBoardProps) {
  const active = alert.status === 'active'

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }} aria-label="Alert board">
      <Alert severity={active ? 'error' : 'info'} sx={{ mb: 2 }}>
        {active ? 'Alert active: everyone picks where they are.' : 'This alert has ended. Locations are closed.'}
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {SQUARES.map(({ key, label }) => {
          const people = alert.responses.filter((response) => response.square === key)
          return (
            <Paper key={key} variant="outlined" sx={{ p: 1.5, minHeight: 110 }} data-testid={`square-${key}`}>
              <Typography variant="subtitle2" gutterBottom>
                {label}
              </Typography>
              <Stack direction="row" useFlexGap spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                {people.map(({ user }) => (
                  <Chip
                    key={user.id}
                    size="small"
                    label={user.id === currentUserId ? `${user.name} (you)` : user.name}
                    color={user.id === currentUserId ? 'primary' : 'default'}
                  />
                ))}
              </Stack>
            </Paper>
          )
        })}
      </Box>
    </Paper>
  )
}
