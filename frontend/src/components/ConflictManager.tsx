import { create } from 'zustand'
import { ConflictDialog, type ConflictDialogProps } from './ConflictDialog'
import { saveLocalProgress, saveLocalSettings } from '../services/offlineStorage'

export interface ConflictItem {
  id: string
  type: 'progress' | 'settings'
  bookTitle?: string
  bookId?: string
  userId: string
  localData: Record<string, unknown>
  serverData: Record<string, unknown>
}

interface ConflictState {
  conflicts: ConflictItem[]
  currentConflict: ConflictItem | null
  addConflict: (item: ConflictItem) => void
  resolveConflict: (id: string) => void
}

export const useConflictStore = create<ConflictState>()((set) => ({
  conflicts: [],
  currentConflict: null,

  addConflict: (item) => {
    set((state) => {
      // Avoid duplicates
      if (state.conflicts.some((c) => c.id === item.id)) return state
      const updated = [...state.conflicts, item]
      return {
        conflicts: updated,
        currentConflict: state.currentConflict ?? item,
      }
    })
  },

  resolveConflict: (id) => {
    set((state) => {
      const remaining = state.conflicts.filter((c) => c.id !== id)
      return {
        conflicts: remaining,
        currentConflict: remaining[0] ?? null,
      }
    })
  },
}))

// Expose store for E2E testing
if (typeof window !== 'undefined') {
  ;(window as any).__conflictStore__ = useConflictStore
}

const BASE_URL = '/api'

async function resolveOnServer(
  conflict: ConflictItem,
  choice: 'local' | 'server',
): Promise<void> {
  const data = choice === 'local' ? conflict.localData : conflict.serverData

  try {
    if (conflict.type === 'progress' && conflict.bookId) {
      const res = await fetch(
        `${BASE_URL}/users/${conflict.userId}/books/${conflict.bookId}/progress/resolve`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cfi: data.cfi, percentage: data.percentage }),
        },
      )
      if (res.ok) {
        const result = await res.json()
        await saveLocalProgress(
          conflict.userId,
          conflict.bookId,
          String(data.cfi ?? ''),
          Number(data.percentage ?? 0),
          result.version,
          false,
        )
      }
    } else if (conflict.type === 'settings') {
      const res = await fetch(
        `${BASE_URL}/users/${conflict.userId}/settings/resolve`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      )
      if (res.ok) {
        const result = await res.json()
        await saveLocalSettings(conflict.userId, {
          writingMode: result.writingMode,
          fontSize: result.fontSize,
          theme: result.theme,
          openccMode: result.openccMode,
          tapZoneLayout: result.tapZoneLayout,
          version: result.version,
          dirty: false,
        })
      }
    }
  } catch {
    // Silently fail — next sync cycle will retry
  }
}

export function ConflictManager() {
  const currentConflict = useConflictStore((s) => s.currentConflict)
  const resolveConflict = useConflictStore((s) => s.resolveConflict)

  if (!currentConflict) return null

  const handleResolve = async (choice: 'local' | 'server') => {
    await resolveOnServer(currentConflict, choice)
    resolveConflict(currentConflict.id)
  }

  return (
    <ConflictDialog
      open
      type={currentConflict.type}
      bookTitle={currentConflict.bookTitle}
      localData={currentConflict.localData as ConflictDialogProps['localData']}
      serverData={currentConflict.serverData as ConflictDialogProps['serverData']}
      onResolve={handleResolve}
    />
  )
}

