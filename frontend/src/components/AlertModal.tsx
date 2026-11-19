import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { SQUARES, type AlertSnapshot, type SquareKey } from '../api/alerts'
import { generalError } from '../pages/errors'

interface AlertModalProps {
  alert: AlertSnapshot | null
  currentUserId: number
  /** Whether the signed-in user has the `submit-locations` ability. */
  canSubmit: boolean
  onPick: (alertId: number, square: SquareKey) => Promise<void>
}

// Asks the person where they are. It opens by itself while an alert is active and the
// person has not picked yet, and it cannot be dismissed: the only way out is to pick
// (or for the alert to end). Once they pick, the shared board shows their name.
export function AlertModal({ alert, currentUserId, canSubmit, onPick }: AlertModalProps) {
  const [pendingSquare, setPendingSquare] = useState<SquareKey | null>(null)
  const [error, setError] = useState<unknown>(null)

  const alreadyPicked = alert?.responses.some((response) => response.user.id === currentUserId) ?? false
  const open = Boolean(alert && alert.status === 'active' && canSubmit && !alreadyPicked)

  const choose = async (square: SquareKey) => {
    if (!alert || pendingSquare) return
    setPendingSquare(square)
    setError(null)
    try {
      await onPick(alert.id, square)
    } catch (caught) {
      setError(caught) // stay open so the person can try again
    } finally {
      setPendingSquare(null)
    }
  }

  return (
    <Dialog
      open={open}
      // No onClose handler: Escape and a click outside do nothing, so a location must be chosen.
      aria-labelledby="alert-modal-title"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="alert-modal-title">Alert: where are you?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          An administrator started an alert. Pick the square you are in. Your first choice is final.
        </DialogContentText>
        {generalError(error, []) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {generalError(error, [])}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          {SQUARES.map(({ key, label }) => (
            <Button
              key={key}
              variant="outlined"
              onClick={() => void choose(key)}
              disabled={pendingSquare !== null}
              sx={{ aspectRatio: '1 / 1', fontSize: '1.1rem' }}
            >
              {label}
            </Button>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
