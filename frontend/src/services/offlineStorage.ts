import { db, type LocalProgress, type LocalSettings, type LocalBook, type LocalUser, type SyncQueueItem } from './db'

// ─── Progress ────────────────────────────────────────────────────────────────

export async function getLocalProgress(userId: string, bookId: string): Promise<LocalProgress | undefined> {
  return db.progress.get(`${userId}_${bookId}`)
}

export async function getAllLocalProgress(userId: string): Promise<LocalProgress[]> {
  return db.progress.where('userId').equals(userId).toArray()
}

export async function saveLocalProgress(
  userId: string,
  bookId: string,
  cfi: string | null,
  percentage: number,
  version: number,
  dirty: boolean
): Promise<void> {
  await db.progress.put({
    id: `${userId}_${bookId}`,
    userId,
    bookId,
    cfi,
    percentage,
    lastReadAt: Date.now(),
    version,
    dirty,
  })
}

export async function markProgressClean(userId: string, bookId: string, newVersion: number): Promise<void> {
  await db.progress.update(`${userId}_${bookId}`, { dirty: false, version: newVersion })
}

export async function getDirtyProgress(): Promise<LocalProgress[]> {
  return db.progress.filter(p => p.dirty).toArray()
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getLocalSettings(userId: string): Promise<LocalSettings | undefined> {
  return db.settings.get(userId)
}

export async function saveLocalSettings(
  userId: string,
  settings: Omit<LocalSettings, 'userId'>
): Promise<void> {
  await db.settings.put({ userId, ...settings })
}

export async function markSettingsClean(userId: string, newVersion: number): Promise<void> {
  await db.settings.update(userId, { dirty: false, version: newVersion })
}

export async function getDirtySettings(): Promise<LocalSettings[]> {
  return db.settings.filter(s => s.dirty).toArray()
}

// ─── Books ───────────────────────────────────────────────────────────────────

export async function getLocalBooks(): Promise<LocalBook[]> {
  return db.books.toArray()
}

export async function saveLocalBooks(books: LocalBook[]): Promise<void> {
  await db.books.bulkPut(books)
}

export async function updateBookCachedStatus(bookId: string, cached: boolean): Promise<void> {
  await db.books.update(bookId, { cached })
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getLocalUsers(): Promise<LocalUser[]> {
  return db.users.toArray()
}

export async function saveLocalUsers(users: LocalUser[]): Promise<void> {
  await db.users.bulkPut(users)
}

// ─── Sync Queue ──────────────────────────────────────────────────────────────

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
  await db.syncQueue.add(item as SyncQueueItem)
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('createdAt').toArray()
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  await db.syncQueue.delete(id)
}

export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear()
}

// ─── Bulk Sync ───────────────────────────────────────────────────────────────

/**
 * Sync server data to local IndexedDB (called on app startup or reconnect).
 * Replaces local data with server data for items that are NOT dirty.
 */
export async function syncFromServer(data: {
  users?: LocalUser[]
  books?: LocalBook[]
  progress?: Array<{ userId: string; bookId: string; cfi: string | null; percentage: number; lastReadAt: number; version: number }>
  settings?: { userId: string } & Record<string, unknown>
}): Promise<void> {
  if (data.users) {
    await saveLocalUsers(data.users)
  }

  if (data.books) {
    // Preserve cached status from local
    const existingBooks = await getLocalBooks()
    const cachedMap = new Map(existingBooks.map(b => [b.id, b.cached]))
    const merged = data.books.map(b => ({
      ...b,
      cached: cachedMap.get(b.id) ?? false,
    }))
    await saveLocalBooks(merged)
  }

  if (data.progress) {
    for (const p of data.progress) {
      const local = await getLocalProgress(p.userId, p.bookId)
      // Only overwrite if local is not dirty
      if (!local || !local.dirty) {
        await saveLocalProgress(p.userId, p.bookId, p.cfi, p.percentage, p.version, false)
      }
    }
  }
}
