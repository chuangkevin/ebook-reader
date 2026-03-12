import { useDispatch, useSelector } from 'react-redux';
import {
  Drawer,
  Box,
  Typography,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Switch,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import type { RootState } from '../../store';
import {
  setThemeMode,
  setFontSize,
  setLineHeight,
  setWritingMode,
  setConvertToTraditional,
  setTapZoneLayout,
  setVolumeKeyNav,
  type ThemeMode,
  type WritingMode,
  type TapZoneLayout,
} from '../../store/settingsSlice';

interface ReaderSettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function ReaderSettings({ open, onClose }: ReaderSettingsProps) {
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.settings);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: '16px 16px 0 0',
          maxHeight: '60vh',
          bgcolor: 'rgba(30,30,30,0.95)',
          backdropFilter: 'blur(12px)',
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            閱讀設定
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Theme */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          主題
        </Typography>
        <ToggleButtonGroup
          value={settings.themeMode}
          exclusive
          onChange={(_, val) => val && dispatch(setThemeMode(val as ThemeMode))}
          fullWidth
          sx={{ mb: 3 }}
        >
          <ToggleButton value="light">
            <LightModeIcon sx={{ mr: 0.5 }} fontSize="small" />
            亮色
          </ToggleButton>
          <ToggleButton value="sepia">
            護眼
          </ToggleButton>
          <ToggleButton value="dark">
            <DarkModeIcon sx={{ mr: 0.5 }} fontSize="small" />
            暗色
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Font Size */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          字體大小：{settings.fontSize}px
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Typography variant="body2" sx={{ fontSize: 12 }}>A</Typography>
          <Slider
            value={settings.fontSize}
            onChange={(_, val) => dispatch(setFontSize(val as number))}
            min={12}
            max={32}
            step={1}
          />
          <Typography variant="body2" sx={{ fontSize: 24 }}>A</Typography>
        </Box>

        {/* Line Height */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          行距：{settings.lineHeight.toFixed(1)}
        </Typography>
        <Slider
          value={settings.lineHeight}
          onChange={(_, val) => dispatch(setLineHeight(val as number))}
          min={1.2}
          max={3.0}
          step={0.1}
          sx={{ mb: 3 }}
        />

        {/* Writing Mode */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          排版方向
        </Typography>
        <ToggleButtonGroup
          value={settings.writingMode}
          exclusive
          onChange={(_, val) => val && dispatch(setWritingMode(val as WritingMode))}
          fullWidth
          sx={{ mb: 3 }}
        >
          <ToggleButton value="horizontal">橫排</ToggleButton>
          <ToggleButton value="vertical">直排</ToggleButton>
        </ToggleButtonGroup>

        {/* Tap Zone Layout */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          翻頁區域
        </Typography>
        <ToggleButtonGroup
          value={settings.tapZoneLayout}
          exclusive
          onChange={(_, val) => val && dispatch(setTapZoneLayout(val as TapZoneLayout))}
          fullWidth
          sx={{ mb: 3 }}
        >
          <ToggleButton value="default">預設</ToggleButton>
          <ToggleButton value="left-hand">左手</ToggleButton>
          <ToggleButton value="right-hand">右手</ToggleButton>
        </ToggleButtonGroup>

        {/* Volume key navigation */}
        <FormControlLabel
          control={
            <Switch
              checked={settings.volumeKeyNav}
              onChange={(e) => dispatch(setVolumeKeyNav(e.target.checked))}
            />
          }
          label="音量鍵翻頁"
          sx={{ mb: 1 }}
        />

        {/* Simplified to Traditional */}
        <FormControlLabel
          control={
            <Switch
              checked={settings.convertToTraditional}
              onChange={(e) => dispatch(setConvertToTraditional(e.target.checked))}
            />
          }
          label="簡體轉繁體"
        />
      </Box>
    </Drawer>
  );
}
