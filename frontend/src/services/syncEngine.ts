import { useConnectionStore } from '../stores/connectionStore'
import {
  getSyncQueue,
  removeSyncQueueItem,
  markProgressClean,
  markSettingsClean,
} from './offlineStorage'
import type { SyncQueueItem } from './db'

const BASE_URL = '/api'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncConflict {
  type: 'progress' | 'settings'
  userId: string
  bookId?: string
  localData: Record<string, unknown>
  serverData: Record<string, unknown>
  serverVersion: number
}

interface SyncResponse {
  version: number
  conflict?: boolean
  serverData?: Record<string, unknown>
  serverVersion?: number
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Classify a fetch Response or error into an action the queue loop should take.
 */
type QueueAction =
  | { kind: 'ok'; data: SyncResponse }
  | { kind: 'conflict'; data: SyncResponse }
  | { kind: 'discard' }      // 4xx (not 409) — bad data, remove from queue
  | { kind: 'retry' }        // 5xx — keep in queue
  | { kind: 'offline' }      // network error — stop processing

async function sendSyncRequest(item: SyncQueueItem): Promise<QueueAction> {
  const url =
    item.type === 'progress'
      ? `${BASE_URL}/users/${item.userId}/books/${item.bookId}/progress`
      : `${BASE_URL}/users/${item.userId}/settings`

  const body =
    item.type === 'progress'
      ? { cfi: item.data.cfi, percentage: item.data.percentage, version: item.localVersion || undefined }
      : { ...item.data, version: item.localVersion || undefined }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Network error — still offline
    return { kind: 'offline' }
  }

  if (response.ok) {
    const data = (await response.json()) as SyncResponse
    return { kind: 'ok', data }
  }

  if (response.status === 409) {
    const data = (await response.json()) as SyncResponse
    return { kind: 'conflict', data }
  }

  if (response.status >= 500) {
    return { kind: 'retry' }
  }

  // Any other 4xx — bad request, discard
  return { kind: 'discard' }
}

// ─── Core flush logic ───────────────────────────────────────────────────────

/**
 * Process every item in the sync queue (ordered by createdAt).
 *
 * - 200 OK        → update local IndexedDB version, remove from queue
 * - 409 Conflict  → keep in queue, add to returned conflict list
 * - Network error → stop processing (still offline)
 * - 4xx (not 409) → remove from queue (bad data, discard)
 * - 5xx           → keep in queue for retry
 */
export async function flushSyncQueue(): Promise<SyncConflict[]> {
  const queue = await getSyncQueue()
  const conflicts: SyncConflict[] = []

  for (const item of queue) {
    const result = await sendSyncRequest(item)

    switch (result.kind) {
      case 'ok': {
        // Update local IndexedDB with new version, mark clean
        if (item.type === 'progress' && item.bookId) {
          await markProgressClean(item.userId, item.bookId, result.data.version)
        } else if (item.type === 'settings') {
          await markSettingsClean(item.userId, result.data.version)
        }
        // Remove from queue
        if (item.id != null) {
          await removeSyncQueueItem(item.id)
        }
        break
      }

      case 'conflict': {
        // Keep in queue, record conflict for caller
        conflicts.push({
          type: item.type,
          userId: item.userId,
          bookId: item.bookId,
          localData: item.data,
          serverData: (result.data.serverData as Record<string, unknown>) ?? result.data,
          serverVersion: result.data.serverVersion ?? result.data.version,
        })
        break
      }

      case 'discard': {
        // Bad data — remove from queue so it doesn't block future syncs
        if (item.id != null) {
          await removeSyncQueueItem(item.id)
        }
        break
      }

      case 'retry': {
        // 5xx — leave in queue, continue to next item
        break
      }

      case 'offline': {
        // Network error — stop processing entirely
        return conflicts
      }
    }
  }

  return conflicts
}

// ─── Startup sync ───────────────────────────────────────────────────────────

/**
 * Called once at app startup. If online, flush the queue.
 */
export async function syncOnStartup(): Promise<void> {
  if (!navigator.onLine) return

  const store = useConnectionStore.getState()
  store.setSyncing(true)
  try {
    await flushSyncQueue()
  } finally {
    store.setSyncing(false)
  }
}

// ─── Event listeners ────────────────────────────────────────────────────────

let listenersInitialized = false

/**
 * Wire up the 'online' event so the queue is flushed automatically
 * whenever connectivity is restored. Call once on app init.
 */
export function initSyncListeners(): void {
  if (listenersInitialized) return
  listenersInitialized = true

  window.addEventListener('online', () => {
    const store = useConnectionStore.getState()
    // Avoid overlapping flushes
    if (store.isSyncing) return

    store.setSyncing(true)
    flushSyncQueue()
      .finally(() => {
        store.setSyncing(false)
      })
  })

  // Also flush on startup if already online
  syncOnStartup()
}
