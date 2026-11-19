import { Box, Chip, Stack, Typography } from '@mui/material'
import { useAuth } from '../auth/useAuth'
import { ChatPanel } from '../components/ChatPanel'

// Text required by the brief: present on the main page, 1px and white.
export const HIDDEN_TEXT =
  'The dark side consumes you. Have you ever heard of the tragedy of Darth Plagueis the wise?'

export default function HomePage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        Welcome, {user.name}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip label={user.role === 'administrator' ? 'Administrator' : 'User'} color="primary" />
        {user.abilities['start-alerts'] && <Chip label="Can start and end alerts" variant="outlined" />}
      </Stack>

      <ChatPanel currentUserId={user.id} canSend={user.abilities['send-messages']} />

      <Box component="p" sx={{ fontSize: '1px', lineHeight: '1px', color: '#fff', m: 0 }}>
        {HIDDEN_TEXT}
      </Box>
    </>
  )
}
