import { create } from 'zustand'
import type { ReaderSettings } from '../types/index'

interface SettingsState {
  settings: ReaderSettings
  setSettings: (settings: Partial<ReaderSettings>) => void
}

const defaultSettings: ReaderSettings = {
  writingMode: 'vertical-rl',
  pageLayout: 'single',
  fontSize: 18,
  gap: 0.06,
  theme: 'light',
  openccMode: 'none',
  tapZoneLayout: 'default',
}

export function getReaderPageLayout(userId: string): ReaderSettings['pageLayout'] {
  try {
    return localStorage.getItem(`readflix.reader.pageLayout.${userId}`) === 'spread' ? 'spread' : 'single'
  } catch {
    return 'single'
  }
}

export function saveReaderPageLayout(userId: string, pageLayout: ReaderSettings['pageLayout']) {
  try {
    localStorage.setItem(`readflix.reader.pageLayout.${userId}`, pageLayout)
  } catch {
    // Keep the in-memory preference if browser storage is unavailable.
  }
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: defaultSettings,
  setSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),
}))
