import { useState } from 'react'
import { Alert, Box, Button, Stack } from '@mui/material'
import type { User } from '../api/auth'
import { useAlert } from '../alerts/useAlert'
import { generalError } from '../pages/errors'
import { AlertBoard } from './AlertBoard'
import { AlertModal } from './AlertModal'

// Everything about alerts on the main page: the administrator's start/end button, the
// shared board and the modal. The hook lives here (not in the modal) so the live
// subscription stays open whether or not the modal is showing.
export function AlertSection({ user }: { user: User }) {
  const { alert, loadFailed, retry, start, end, pick } = useAlert()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)

  const canReceive = user.abilities['receive-alerts'] && user.abilities['view-locations']
  const isActive = alert?.status === 'active'

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error)
    } finally {
      setBusy(false)
    }
  }

  const showStart = user.abilities['start-alerts'] && !isActive
  const showEnd = user.abilities['end-alerts'] && isActive && alert

  return (
    <Box sx={{ mb: 2 }}>
      {(showStart || showEnd) && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {showStart && (
            <Button variant="contained" color="error" disabled={busy} onClick={() => void run(start)}>
              Start alert
            </Button>
          )}
          {showEnd && (
            <Button variant="outlined" color="error" disabled={busy} onClick={() => void run(() => end(alert.id))}>
              End alert
            </Button>
          )}
        </Stack>
      )}

      {Boolean(actionError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {generalError(actionError, [])}
        </Alert>
      )}

      {canReceive && loadFailed && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={retry}>Retry</Button>}>
          Could not load the current alert.
        </Alert>
      )}

      {canReceive && alert && <AlertBoard alert={alert} currentUserId={user.id} />}

      {canReceive && (
        <AlertModal
          alert={alert}
          currentUserId={user.id}
          canSubmit={user.abilities['submit-locations']}
          onPick={async (alertId, square) => {
            await pick(alertId, square)
          }}
        />
      )}
    </Box>
  )
}
