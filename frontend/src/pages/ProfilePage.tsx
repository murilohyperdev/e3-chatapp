import { useRef, useState, type ChangeEvent, type SubmitEventHandler } from 'react'
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { deleteAvatar, updateProfile, uploadAvatar } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { UserAvatar } from '../components/UserAvatar'
import { fieldError, generalError } from './errors'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [address, setAddress] = useState(user?.address ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [pictureError, setPictureError] = useState<unknown>(null)

  if (!user) return null

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      // Empty strings become null so the server clears the optional fields.
      const updated = await updateProfile(user.id, { name, phone: phone || null, address: address || null })
      updateUser(updated)
      setSaved(true)
    } catch (caught) {
      setError(caught)
    } finally {
      setSaving(false)
    }
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow choosing the same file again
    if (!file) return
    setPictureError(null)
    try {
      updateUser(await uploadAvatar(user.id, file))
    } catch (caught) {
      setPictureError(caught)
    }
  }

  const handleRemove = async () => {
    setPictureError(null)
    try {
      updateUser(await deleteAvatar(user.id))
    } catch (caught) {
      setPictureError(caught)
    }
  }

  const general = generalError(error, ['name', 'phone', 'address'])
  const pictureMessage = fieldError(pictureError, 'avatar') ?? generalError(pictureError, ['avatar'])

  return (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        My profile
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
          <UserAvatar name={user.name} url={user.avatar_url} size={80} />
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => fileInput.current?.click()}>
                Upload picture
              </Button>
              {user.avatar_url && (
                <Button color="error" onClick={() => void handleRemove()}>
                  Remove picture
                </Button>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              JPG, PNG or WebP, up to 2 MB.
            </Typography>
          </Stack>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            aria-label="Picture file"
            onChange={(event) => void handleFile(event)}
          />
        </Stack>
        {pictureMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {pictureMessage}
          </Alert>
        )}

        <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
          {saved && <Alert severity="success">Profile saved.</Alert>}
          {general && <Alert severity="error">{general}</Alert>}
          <TextField label="Email" value={user.email} disabled helperText="Email cannot be changed." />
          <TextField
            label="Name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={Boolean(fieldError(error, 'name'))}
            helperText={fieldError(error, 'name')}
          />
          <TextField
            label="Phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={Boolean(fieldError(error, 'phone'))}
            helperText={fieldError(error, 'phone')}
          />
          <TextField
            label="Address"
            autoComplete="street-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            error={Boolean(fieldError(error, 'address'))}
            helperText={fieldError(error, 'address')}
          />
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      </Paper>
    </>
  )
}
