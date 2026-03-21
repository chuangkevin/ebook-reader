import { create } from 'zustand'

interface ConnectionState {
  isOnline: boolean
  isSyncing: boolean
  setOnline: (online: boolean) => void
  setSyncing: (syncing: boolean) => void
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
}))

// Auto-listen to online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useConnectionStore.getState().setOnline(true)
  })
  window.addEventListener('offline', () => {
    useConnectionStore.getState().setOnline(false)
  })
}
