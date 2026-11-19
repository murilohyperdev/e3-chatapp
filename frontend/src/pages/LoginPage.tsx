import { useState, type SubmitEventHandler } from 'react'
import { Alert, Button, Link, Stack, TextField } from '@mui/material'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router'
import { AuthCard } from '../components/AuthCard'
import { useAuth } from '../auth/useAuth'
import { fieldError, generalError } from './errors'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (caught) {
      setError(caught)
    } finally {
      setSubmitting(false)
    }
  }

  const general = generalError(error, ['email', 'password'])

  return (
    <AuthCard title="Sign in">
      <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
        {notice && <Alert severity="success">{notice}</Alert>}
        {general && <Alert severity="error">{general}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={Boolean(fieldError(error, 'email'))}
          helperText={fieldError(error, 'email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={Boolean(fieldError(error, 'password'))}
          helperText={fieldError(error, 'password')}
        />
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ alignSelf: 'center' }}>
          Forgot your password?
        </Link>
      </Stack>
    </AuthCard>
  )
}
