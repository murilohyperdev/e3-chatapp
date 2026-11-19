import { useState, type SubmitEventHandler } from 'react'
import { Alert, Button, Link, Stack, TextField, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router'
import { requestPasswordReset } from '../api/auth'
import { AuthCard } from '../components/AuthCard'
import { fieldError, generalError } from './errors'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSentMessage(null)
    try {
      const response = await requestPasswordReset(email)
      setSentMessage(response.message)
    } catch (caught) {
      setError(caught)
    } finally {
      setSubmitting(false)
    }
  }

  const general = generalError(error, ['email'])

  return (
    <AuthCard title="Reset your password">
      <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
        <Typography variant="body2" color="text.secondary">
          Enter your email and we will send you a link to choose a new password.
        </Typography>
        {sentMessage && <Alert severity="success">{sentMessage}</Alert>}
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
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link component={RouterLink} to="/login" variant="body2" sx={{ alignSelf: 'center' }}>
          Back to sign in
        </Link>
      </Stack>
    </AuthCard>
  )
}
