import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { listUsers, type DirectoryUser } from '../api/users'
import { UserAvatar } from '../components/UserAvatar'

export default function PeoplePage() {
  const [people, setPeople] = useState<DirectoryUser[]>([])
  const [page, setPage] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // Fetches one page and merges it; state is only set after the request resolves.
  const fetchPage = async (next: number) => {
    try {
      const result = await listUsers(next)
      setPeople((current) => (next === 1 ? result.data : [...current, ...result.data]))
      setPage(result.meta.current_page)
      setLastPage(result.meta.last_page)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  const loadMore = () => {
    setLoading(true)
    void fetchPage(page + 1)
  }

  return (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        People
      </Typography>
      {failed && <Alert severity="error">Could not load the directory.</Alert>}
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1.5 }}>
        {people.map((person) => (
          <li key={person.id}>
            <Card variant="outlined">
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, '&:last-child': { pb: 2 } }}>
                <UserAvatar name={person.name} url={person.avatar_url} size={48} />
                <Typography sx={{ flexGrow: 1 }}>{person.name}</Typography>
                <Chip
                  size="small"
                  label={person.role === 'administrator' ? 'Administrator' : 'User'}
                  color={person.role === 'administrator' ? 'primary' : 'default'}
                />
              </CardContent>
            </Card>
          </li>
        ))}
      </Box>
      <Stack sx={{ mt: 2, alignItems: 'center' }}>
        {loading && <CircularProgress aria-label="Loading people" />}
        {!loading && page < lastPage && (
          <Button onClick={loadMore}>Load more</Button>
        )}
      </Stack>
    </>
  )
}
