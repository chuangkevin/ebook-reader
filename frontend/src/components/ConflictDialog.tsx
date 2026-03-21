import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import CloudIcon from '@mui/icons-material/Cloud'

export interface ConflictDialogProps {
  open: boolean
  type: 'progress' | 'settings'
  bookTitle?: string
  localData: {
    cfi?: string | null
    percentage?: number
    lastReadAt?: number
    writingMode?: string
    fontSize?: number
    theme?: string
  }
  serverData: {
    cfi?: string | null
    percentage?: number
    lastReadAt?: number
    writingMode?: string
    fontSize?: number
    theme?: string
  }
  onResolve: (choice: 'local' | 'server') => void
}

const WRITING_MODE_LABELS: Record<string, string> = {
  'vertical-rl': '直排',
  'horizontal-tb': '橫排',
}

const THEME_LABELS: Record<string, string> = {
  light: '淺色',
  sepia: '復古',
  dark: '深色',
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return '未知時間'

  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days === 1) {
    const date = new Date(timestamp)
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `昨天 ${hh}:${mm}`
  }
  if (days < 7) return `${days} 天前`

  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hh}:${mm}`
}

function ProgressContent({ data }: { data: ConflictDialogProps['localData'] }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body1" fontWeight={600}>
        進度 {data.percentage != null ? `${data.percentage.toFixed(1)}%` : '未知'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
        {formatRelativeTime(data.lastReadAt)}
      </Typography>
    </Box>
  )
}

function SettingsContent({ data }: { data: ConflictDialogProps['localData'] }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {data.writingMode != null && (
        <Typography variant="body2">
          排版：{WRITING_MODE_LABELS[data.writingMode] ?? data.writingMode}
        </Typography>
      )}
      {data.fontSize != null && (
        <Typography variant="body2">
          字體大小：{data.fontSize}px
        </Typography>
      )}
      {data.theme != null && (
        <Typography variant="body2">
          主題：{THEME_LABELS[data.theme] ?? data.theme}
        </Typography>
      )}
    </Box>
  )
}

export function ConflictDialog({ open, type, bookTitle, localData, serverData, onResolve }: ConflictDialogProps) {
  const isProgress = type === 'progress'
  const buttonLabel = isProgress ? '使用此進度' : '使用此設定'

  const cardSx = {
    flex: 1,
    minWidth: 160,
    bgcolor: '#2a2a2a',
    color: 'white',
    p: 2.5,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
    border: '1px solid rgba(255,255,255,0.1)',
  }

  return (
    <Dialog
      open={open}
      PaperProps={{
        sx: {
          bgcolor: '#1e1e1e',
          color: 'white',
          maxWidth: 520,
          width: '100%',
          m: 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 0.5,
        }}
      >
        <WarningAmberIcon sx={{ color: '#ff9800' }} />
        <Typography variant="h6" component="span" fontWeight={700}>
          {isProgress ? '閱讀進度衝突' : '設定衝突'}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {isProgress && bookTitle && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2.5 }}>
            {`「${bookTitle}」的閱讀進度在其他裝置上也有更新`}
          </Typography>
        )}
        {!isProgress && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2.5 }}>
            閱讀設定在其他裝置上也有更新
          </Typography>
        )}

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          {/* Local card */}
          <Card sx={cardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartphoneIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }} />
              <Typography variant="subtitle2" fontWeight={600}>
                本機進度
              </Typography>
            </Box>

            {isProgress ? <ProgressContent data={localData} /> : <SettingsContent data={localData} />}

            <Button
              variant="contained"
              fullWidth
              onClick={() => onResolve('local')}
              sx={{ mt: 'auto' }}
            >
              {buttonLabel}
            </Button>
          </Card>

          {/* Server card */}
          <Card sx={cardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CloudIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }} />
              <Typography variant="subtitle2" fontWeight={600}>
                雲端進度
              </Typography>
            </Box>

            {isProgress ? <ProgressContent data={serverData} /> : <SettingsContent data={serverData} />}

            <Button
              variant="contained"
              fullWidth
              onClick={() => onResolve('server')}
              sx={{ mt: 'auto' }}
            >
              {buttonLabel}
            </Button>
          </Card>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
