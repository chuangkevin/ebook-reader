import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'dark' | 'light' | 'sepia';
export type WritingMode = 'horizontal' | 'vertical';

export interface ReaderSettings {
  themeMode: ThemeMode;
  fontSize: number;       // px
  lineHeight: number;     // multiplier
  writingMode: WritingMode;
  convertToTraditional: boolean;
}

const STORAGE_KEY = 'ebook-reader-settings';

const defaultSettings: ReaderSettings = {
  themeMode: 'dark',
  fontSize: 18,
  lineHeight: 1.8,
  writingMode: 'horizontal',
  convertToTraditional: true,
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
  },
});

export const { setThemeMode, setFontSize, setLineHeight, setWritingMode, setConvertToTraditional } = settingsSlice.actions;
export default settingsSlice.reducer;
