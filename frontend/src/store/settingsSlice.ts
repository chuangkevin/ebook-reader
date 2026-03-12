import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'dark' | 'light' | 'sepia';
export type WritingMode = 'horizontal' | 'vertical';
export type TapMode = 'same-side' | 'two-side';
export type HandPreference = 'left' | 'right';

// Keep old type for migration
export type TapZoneLayout = 'default' | 'left-hand' | 'right-hand';

export interface ReaderSettings {
  themeMode: ThemeMode;
  fontSize: number;       // px
  lineHeight: number;     // multiplier
  writingMode: WritingMode;
  convertToTraditional: boolean;
  tapMode: TapMode;
  handPreference: HandPreference;
  invertPageTurn: boolean;
  volumeKeyNav: boolean;
  showTapZones: boolean;
}

const STORAGE_KEY = 'ebook-reader-settings';

const defaultSettings: ReaderSettings = {
  themeMode: 'dark',
  fontSize: 18,
  lineHeight: 1.8,
  writingMode: 'horizontal',
  convertToTraditional: true,
  tapMode: 'two-side',
  handPreference: 'right',
  invertPageTurn: false,
  volumeKeyNav: true,
  showTapZones: true,
};

function loadSettings(): ReaderSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old tapZoneLayout to new tapMode + handPreference
      if (parsed.tapZoneLayout && !parsed.tapMode) {
        if (parsed.tapZoneLayout === 'left-hand') {
          parsed.tapMode = 'two-side';
          parsed.handPreference = 'left';
        } else {
          parsed.tapMode = 'two-side';
          parsed.handPreference = 'right';
        }
        delete parsed.tapZoneLayout;
      }
      return { ...defaultSettings, ...parsed };
    }
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
    setTapMode(state, action: PayloadAction<TapMode>) {
      state.tapMode = action.payload;
      saveSettings(state);
    },
    setHandPreference(state, action: PayloadAction<HandPreference>) {
      state.handPreference = action.payload;
      saveSettings(state);
    },
    setInvertPageTurn(state, action: PayloadAction<boolean>) {
      state.invertPageTurn = action.payload;
      saveSettings(state);
    },
    setVolumeKeyNav(state, action: PayloadAction<boolean>) {
      state.volumeKeyNav = action.payload;
      saveSettings(state);
    },
    setShowTapZones(state, action: PayloadAction<boolean>) {
      state.showTapZones = action.payload;
      saveSettings(state);
    },
  },
});

export const {
  setThemeMode, setFontSize, setLineHeight, setWritingMode,
  setConvertToTraditional, setTapMode, setHandPreference,
  setInvertPageTurn, setVolumeKeyNav, setShowTapZones,
} = settingsSlice.actions;
export default settingsSlice.reducer;
