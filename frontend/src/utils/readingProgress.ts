import { api } from '../services/api.service'

interface Recovery {
  cfi: string
  updatedAt: number
  pending?: boolean
}
const key = (user: string, book: string) =>
  `readflix.progress.${encodeURIComponent(user)}.${encodeURIComponent(book)}`
const queues = new Map<string, Promise<void>>()

export function recoverProgress(
  user: string,
  book: string,
  server?: { cfi: string; lastReadAt: number }
): string | undefined {
  try {
    const value: Recovery | null = JSON.parse(localStorage.getItem(key(user, book)) ?? 'null')
    if (
      value &&
      typeof value.cfi === 'string' &&
      Number.isFinite(value.updatedAt) &&
      (value.pending || !server || value.updatedAt > server.lastReadAt)
    )
      return value.cfi
  } catch {
    /* Storage is optional; server remains source of saved progress. */
  }
  return server?.cfi
}

export function saveProgress(user: string, book: string, cfi: string, format: string) {
  const storageKey = key(user, book)
  const value: Recovery = { cfi, updatedAt: Date.now(), pending: true }
  try {
    localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    /* Keep API persistence available. */
  }
  // Serialize per reader/book so a slow earlier request cannot overwrite a newer position.
  const write = (queues.get(storageKey) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await api.books.updateProgress(user, book, cfi, format)
      try {
        const current = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Recovery | null
        if (current?.cfi === value.cfi && current.updatedAt === value.updatedAt)
          localStorage.removeItem(storageKey)
      } catch {
        /* Optional recovery storage. */
      }
    })
  queues.set(storageKey, write)
  void write
    .finally(() => {
      if (queues.get(storageKey) === write) queues.delete(storageKey)
    })
    .catch(() => {})
  return write
}

export async function waitForProgress(user: string, book: string) {
  await queues.get(key(user, book))?.catch(() => {})
}

export function clearRecovery(user: string, book: string) {
  try {
    localStorage.removeItem(key(user, book))
  } catch {
    /* Optional storage. */
  }
}
