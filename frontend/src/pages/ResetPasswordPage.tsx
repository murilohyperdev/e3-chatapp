import { useState, type SubmitEventHandler } from 'react'
import { Alert, Button, Link, Stack, TextField } from '@mui/material'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router'
import { resetPassword } from '../api/auth'
import { AuthCard } from '../components/AuthCard'
import { fieldError, generalError } from './errors'

// Opened from the link in the reset email: /reset-password?token=…&email=…
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await resetPassword({ token, email, password, password_confirmation: confirmation })
      navigate('/login', { replace: true, state: { notice: 'Password updated. You can sign in now.' } })
    } catch (caught) {
      setError(caught)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token || !email) {
    return (
      <AuthCard title="Choose a new password">
        <Alert severity="error" sx={{ mb: 2 }}>
          This reset link is incomplete. Request a new one.
        </Alert>
        <Link component={RouterLink} to="/forgot-password" variant="body2">
          Request a new link
        </Link>
      </AuthCard>
    )
  }

  const general = generalError(error, ['password'])

  return (
    <AuthCard title="Choose a new password">
      <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
        {general && <Alert severity="error">{general}</Alert>}
        {fieldError(error, 'email') && <Alert severity="error">{fieldError(error, 'email')}</Alert>}
        <TextField label="Email" type="email" value={email} disabled />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={Boolean(fieldError(error, 'password'))}
          helperText={fieldError(error, 'password') ?? 'At least 8 characters'}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? 'Saving…' : 'Reset password'}
        </Button>
      </Stack>
    </AuthCard>
  )
}
