import { Button, ToggleButton, ToggleButtonGroup, Typography, Box } from '@mui/material'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import { useDeviceTheme } from '../theme/deviceTheme'

export default function ThemeSwitch({ expanded = false }: { expanded?: boolean }) {
  const { mode, preference, setAppearance } = useDeviceTheme()
  if (expanded)
    return (
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          畫面外觀
        </Typography>
        <ToggleButtonGroup
          value={preference}
          exclusive
          onChange={(_, value) => value && setAppearance(value)}
          aria-label="畫面外觀"
        >
          <ToggleButton value="light">淺色</ToggleButton>
          <ToggleButton value="dark">深色</ToggleButton>
          <ToggleButton value="system">跟隨系統</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
          只儲存在這個瀏覽器，不影響其他裝置。
        </Typography>
      </Box>
    )
  return (
    <Button
      className="theme-switch"
      color="inherit"
      onClick={() => setAppearance(mode === 'dark' ? 'light' : 'dark')}
      startIcon={mode === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
      aria-label={mode === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
      sx={{ whiteSpace: 'nowrap', minWidth: 44, px: 1.5 }}
    >
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        {mode === 'dark' ? '淺色' : '深色'}
      </Box>
    </Button>
  )
}
