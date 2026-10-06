import { useCallback, useEffect, useRef } from 'react'
import {
  Box,
  IconButton,
  Drawer,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ThemeSwitch from '../ThemeSwitch'
import { useDeviceTheme } from '../../theme/deviceTheme'
import { useSettingsStore } from '../../stores/settingsStore'
import { api } from '../../services/api.service'
import type { ReaderSettings as ReaderSettingsType } from '../../types/index'

// opencc-js integration pending

interface ReaderSettingsProps {
  open: boolean
  onClose: () => void
  userId: string
}

export default function ReaderSettings({ open, onClose, userId }: ReaderSettingsProps) {
  const { settings, setSettings } = useSettingsStore()
  const { paper, setPaper } = useDeviceTheme()

  // Debounced auto-save
  const pendingSave = useRef<ReaderSettingsType | null>(null)
  const saveLayout = useCallback(
    (updated: ReaderSettingsType) =>
      api.settings.update(userId, {
        writingMode: updated.writingMode,
        fontSize: updated.fontSize,
        gap: updated.gap,
        openccMode: updated.openccMode,
        tapZoneLayout: updated.tapZoneLayout,
      }),
    [userId]
  )
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback(
    (updated: ReaderSettingsType) => {
      pendingSave.current = updated
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        pendingSave.current = null
        saveLayout(updated).catch(() => {
          // Save failed silently
        })
      }, 500)
    },
    [saveLayout]
  )

  // Flush the final layout choice when leaving the reader before the debounce fires.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (pendingSave.current) {
        void saveLayout(pendingSave.current).catch(() => {})
        pendingSave.current = null
      }
    }
  }, [saveLayout])

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

  function handleGap(_: Event, value: number | number[]) {
    const gap = value as number
    const updated = { ...settings, gap }
    setSettings({ gap })
    scheduleSave(updated)
  }

  function handleOpencc(_: React.MouseEvent, value: ReaderSettingsType['openccMode'] | null) {
    if (!value) return
    const updated = { ...settings, openccMode: value }
    setSettings({ openccMode: value })
    scheduleSave(updated)
  }

  function handleTapZone(_: React.MouseEvent, value: ReaderSettingsType['tapZoneLayout'] | null) {
    if (!value) return
    const updated = { ...settings, tapZoneLayout: value }
    setSettings({ tapZoneLayout: value })
    scheduleSave(updated)
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          maxHeight: '85dvh',
          width: '100%',
          maxWidth: 640,
          mx: 'auto',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          px: 3,
          py: 2,
          overflowY: 'auto',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography component="h2" variant="h5">
          閱讀設定
        </Typography>
        <IconButton aria-label="關閉閱讀設定" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ mb: 3 }}>
        <ThemeSwitch expanded />
      </Box>
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
          aria-label="字體大小"
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

      {/* 邊距 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          邊距：{Math.round((settings.gap ?? 0.06) * 100)}%
        </Typography>
        <Slider
          aria-label="邊距"
          value={settings.gap ?? 0.06}
          min={0.02}
          max={0.15}
          step={0.01}
          onChange={handleGap}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
          sx={{ maxWidth: 320 }}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          閱讀底色
        </Typography>
        <ToggleButtonGroup
          aria-label="閱讀底色"
          value={paper}
          exclusive
          onChange={(_, value) => value && setPaper(value)}
        >
          <ToggleButton value="default">跟隨畫面</ToggleButton>
          <ToggleButton value="sepia">暖紙色</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
          暖紙色用於淺色模式；PDF 保留原始頁面色彩。
        </Typography>
      </Box>

      {/* 簡繁轉換 */}
      <Box sx={{ mb: 3 }}>
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

      {/* 翻頁區域配置 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          翻頁區域
        </Typography>
        <ToggleButtonGroup
          value={settings.tapZoneLayout}
          exclusive
          onChange={handleTapZone}
          size="small"
        >
          <ToggleButton value="default">左右</ToggleButton>
          <ToggleButton value="bottom-next">下頁</ToggleButton>
          <ToggleButton value="bottom-prev">上頁</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
          {settings.tapZoneLayout === 'default'
            ? '左側＝上一頁，右側＝下一頁'
            : settings.tapZoneLayout === 'bottom-next'
              ? '上半＝上一頁，下半＝下一頁'
              : '上半＝下一頁，下半＝上一頁'}
        </Typography>
      </Box>
    </Drawer>
  )
}
