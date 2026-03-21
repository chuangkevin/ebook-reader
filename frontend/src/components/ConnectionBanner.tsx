import { useConnectionStore } from '../stores/connectionStore'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import SyncIcon from '@mui/icons-material/Sync'

export function ConnectionBanner() {
  const isOnline = useConnectionStore((s) => s.isOnline)
  const isSyncing = useConnectionStore((s) => s.isSyncing)

  if (isOnline && !isSyncing) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        px: 2,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: isOnline ? '#2196f3' : '#ff9800',
        color: 'white',
        fontSize: 14,
      }}
      data-testid="connection-banner"
    >
      {!isOnline && (
        <>
          <WifiOffIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: 'white' }}>
            目前為離線模式
          </Typography>
        </>
      )}
      {isOnline && isSyncing && (
        <>
          <SyncIcon sx={{ fontSize: 18, animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
          <Typography variant="body2" sx={{ color: 'white' }}>
            同步中...
          </Typography>
        </>
      )}
    </Box>
  )
}
