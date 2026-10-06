import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

export default function RouteState({
  title,
  message,
  loading,
  retry,
}: {
  title: string
  message?: string
  loading?: boolean
  retry?: () => void
}) {
  return (
    <Box
      role={loading ? 'status' : undefined}
      sx={{
        minHeight: '70dvh',
        display: 'grid',
        placeContent: 'center',
        textAlign: 'center',
        p: 3,
        gap: 2,
      }}
    >
      {loading && <CircularProgress sx={{ mx: 'auto' }} />}
      <Typography component="h1" variant="h4">
        {title}
      </Typography>
      {message && <Typography color="text.secondary">{message}</Typography>}
      {!loading && (
        <Box>
          {retry && <Button onClick={retry}>重試</Button>}
          <Button component={Link} to="/library">
            回到書庫
          </Button>
          <Button component={Link} to="/">
            選擇讀者
          </Button>
        </Box>
      )}
    </Box>
  )
}
