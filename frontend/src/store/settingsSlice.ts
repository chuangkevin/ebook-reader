import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'dark' | 'light' | 'sepia';
export type WritingMode = 'horizontal' | 'vertical';
export type TapZoneLayout = 'default' | 'left-hand' | 'right-hand';

export interface ReaderSettings {
  themeMode: ThemeMode;
  fontSize: number;       // px
  lineHeight: number;     // multiplier
  writingMode: WritingMode;
  convertToTraditional: boolean;
  tapZoneLayout: TapZoneLayout;
  volumeKeyNav: boolean;
}

const STORAGE_KEY = 'ebook-reader-settings';

const defaultSettings: ReaderSettings = {
  themeMode: 'dark',
  fontSize: 18,
  lineHeight: 1.8,
  writingMode: 'horizontal',
  convertToTraditional: true,
  tapZoneLayout: 'default',
  volumeKeyNav: true,
};

function loadSettings(): ReaderSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return defaultSettings;
}

function saveSettings(settings: ReaderSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState: loadSettings(),
  reducers: {
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
      saveSettings(state);
    },
    setFontSize(state, action: PayloadAction<number>) {
      state.fontSize = action.payload;
      saveSettings(state);
    },
    setLineHeight(state, action: PayloadAction<number>) {
      state.lineHeight = action.payload;
      saveSettings(state);
    },
    setWritingMode(state, action: PayloadAction<WritingMode>) {
      state.writingMode = action.payload;
      saveSettings(state);
    },
    setConvertToTraditional(state, action: PayloadAction<boolean>) {
      state.convertToTraditional = action.payload;
      saveSettings(state);
    },
    setTapZoneLayout(state, action: PayloadAction<TapZoneLayout>) {
      state.tapZoneLayout = action.payload;
      saveSettings(state);
    },
    setVolumeKeyNav(state, action: PayloadAction<boolean>) {
      state.volumeKeyNav = action.payload;
      saveSettings(state);
    },
  },
});

export const { setThemeMode, setFontSize, setLineHeight, setWritingMode, setConvertToTraditional, setTapZoneLayout, setVolumeKeyNav } = settingsSlice.actions;
export default settingsSlice.reducer;
