import { create } from 'zustand'
import type { ReaderSettings } from '../types/index'
import { getLocalSettings, saveLocalSettings } from '../services/offlineStorage'

interface SettingsState {
  settings: ReaderSettings
  setSettings: (settings: Partial<ReaderSettings>) => void
  loadFromLocal: (userId: string) => Promise<void>
}

const defaultSettings: ReaderSettings = {
  writingMode: 'vertical-rl',
  fontSize: 18,
  theme: 'light',
  openccMode: 'none',
  tapZoneLayout: 'default',
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: defaultSettings,
  setSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }))
  },
  loadFromLocal: async (userId: string) => {
    const local = await getLocalSettings(userId)
    if (local) {
      set({
        settings: {
          writingMode: local.writingMode as ReaderSettings['writingMode'],
          fontSize: local.fontSize,
          theme: local.theme as ReaderSettings['theme'],
          openccMode: local.openccMode as ReaderSettings['openccMode'],
          tapZoneLayout: local.tapZoneLayout as ReaderSettings['tapZoneLayout'],
          version: local.version,
        },
      })
    }
  },
}))
