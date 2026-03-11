import type { ThemeMode } from '../store/settingsSlice';

export interface ReaderTheme {
  bg: string;
  fg: string;
  barBg: string;
}

export const readerThemes: Record<ThemeMode, ReaderTheme> = {
  dark: {
    bg: '#1a1a1a',
    fg: '#e0e0e0',
    barBg: 'rgba(0,0,0,0.85)',
  },
  light: {
    bg: '#ffffff',
    fg: '#1a1a1a',
    barBg: 'rgba(255,255,255,0.9)',
  },
  sepia: {
    bg: '#f4ecd8',
    fg: '#433422',
    barBg: 'rgba(244,236,216,0.95)',
  },
};
