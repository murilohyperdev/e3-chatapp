import { Box, Paper, Typography } from '@mui/material'
import type { ReactNode } from 'react'

// Shared frame for the login / forgot / reset pages.
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {title}
        </Typography>
        {children}
      </Paper>
    </Box>
  )
}
