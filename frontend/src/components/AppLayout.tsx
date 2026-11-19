import { AppBar, Button, Container, Stack, Toolbar, Typography } from '@mui/material'
import { Link as RouterLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { UserAvatar } from './UserAvatar'

// Frame for every signed-in page: navigation, the current user and sign out.
export function AppLayout() {
  const { user, signOut } = useAuth()

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/" sx={{ color: 'inherit', textDecoration: 'none', mr: 3 }}>
            E3 Chat
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
            <Button color="inherit" component={RouterLink} to="/people">
              People
            </Button>
            <Button color="inherit" component={RouterLink} to="/profile">
              My profile
            </Button>
          </Stack>
          {user && <UserAvatar name={user.name} url={user.avatar_url} size={32} sx={{ mr: 1 }} />}
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <Button color="inherit" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </>
  )
}
