import { create } from 'zustand'
import type { ReaderSettings } from '../types/index'

interface SettingsState {
  settings: ReaderSettings
  setSettings: (settings: Partial<ReaderSettings>) => void
}

const defaultSettings: ReaderSettings = {
  writingMode: 'vertical-rl',
  fontSize: 18,
  gap: 0.06,
  theme: 'light',
  openccMode: 'none',
  tapZoneLayout: 'default',
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: defaultSettings,
  setSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),
}))
