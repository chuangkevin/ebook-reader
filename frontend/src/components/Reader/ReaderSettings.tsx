import { useCallback, useEffect, useRef } from 'react'
import {
  Box,
  Drawer,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useSettingsStore } from '../../stores/settingsStore'
import { api } from '../../services/api.service'
import type { ReaderSettings as ReaderSettingsType } from '../../types/index'

// opencc-js integration pending

interface ReaderSettingsProps {
  open: boolean
  onClose: () => void
  userId: number
}

export default function ReaderSettings({ open, onClose, userId }: ReaderSettingsProps) {
  const { settings, setSettings } = useSettingsStore()

  // Debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback(
    (updated: ReaderSettingsType) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        api.settings.update(userId, updated).catch(() => {
          // Save failed silently
        })
      }, 500)
    },
    [userId]
  )

  // Cancel pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  function handleWritingMode(_: React.MouseEvent, value: ReaderSettingsType['writingMode'] | null) {
    if (!value) return
    const updated = { ...settings, writingMode: value }
    setSettings({ writingMode: value })
    scheduleSave(updated)
  }

  function handleFontSize(_: Event, value: number | number[]) {
    const fontSize = value as number
    const updated = { ...settings, fontSize }
    setSettings({ fontSize })
    scheduleSave(updated)
  }

  function handleTheme(_: React.MouseEvent, value: ReaderSettingsType['theme'] | null) {
    if (!value) return
    const updated = { ...settings, theme: value }
    setSettings({ theme: value })
    scheduleSave(updated)
  }

  function handleOpencc(_: React.MouseEvent, value: ReaderSettingsType['openccMode'] | null) {
    if (!value) return
    const updated = { ...settings, openccMode: value }
    setSettings({ openccMode: value })
    scheduleSave(updated)
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: '60%',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          px: 3,
          py: 2,
          overflowY: 'auto',
        },
      }}
    >
      {/* 排版模式 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          排版模式
        </Typography>
        <ToggleButtonGroup
          value={settings.writingMode}
          exclusive
          onChange={handleWritingMode}
          size="small"
        >
          <ToggleButton value="vertical-rl">直排</ToggleButton>
          <ToggleButton value="horizontal-tb">橫排</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 字體大小 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          字體大小：{settings.fontSize}px
        </Typography>
        <Slider
          value={settings.fontSize}
          min={14}
          max={28}
          step={2}
          onChange={handleFontSize}
          marks
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v}px`}
          sx={{ maxWidth: 320 }}
        />
      </Box>

      {/* 主題 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          主題
        </Typography>
        <ToggleButtonGroup
          value={settings.theme}
          exclusive
          onChange={handleTheme}
          size="small"
        >
          <ToggleButton value="light" sx={{ bgcolor: '#ffffff', '&.Mui-selected': { bgcolor: '#ffffff' } }}>
            亮色
          </ToggleButton>
          <ToggleButton value="sepia" sx={{ bgcolor: '#f5ecd7', '&.Mui-selected': { bgcolor: '#f5ecd7' } }}>
            護眼
          </ToggleButton>
          <ToggleButton value="dark" sx={{ bgcolor: '#1a1a1a', color: '#fff', '&.Mui-selected': { bgcolor: '#1a1a1a', color: '#fff' } }}>
            暗色
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 簡繁轉換 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          簡繁轉換
        </Typography>
        <ToggleButtonGroup
          value={settings.openccMode}
          exclusive
          onChange={handleOpencc}
          size="small"
        >
          <ToggleButton value="none">關閉</ToggleButton>
          <ToggleButton value="tw2s">繁→簡</ToggleButton>
          <ToggleButton value="s2tw">簡→繁</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Drawer>
  )
}
