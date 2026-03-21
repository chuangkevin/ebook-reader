import type { User, Book, ReaderSettings } from '../types/index'
import {
  saveLocalProgress,
  getLocalProgress,
  saveLocalSettings,
  getLocalSettings,
  saveLocalBooks,
  saveLocalUsers,
  addToSyncQueue,
  getLocalBooks,
  getLocalUsers,
} from './offlineStorage'

const BASE_URL = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, options)
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }
  return response.json() as Promise<T>
}

/**
 * Try a network request; if offline, return null.
 */
async function tryRequest<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    return await request<T>(url, options)
  } catch {
    return null
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

async function listUsers(): Promise<User[]> {
  const serverUsers = await tryRequest<User[]>('/users')
  if (serverUsers) {
    await saveLocalUsers(serverUsers)
    return serverUsers
  }
  // Offline fallback
  const local = await getLocalUsers()
  return local as User[]
}

async function createUser(name: string): Promise<User> {
  return request<User>('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

async function removeUser(id: string): Promise<void> {
  return request<void>(`/users/${id}`, { method: 'DELETE' })
}

// ─── Books ───────────────────────────────────────────────────────────────────

async function listBooks(_userId: string): Promise<Book[]> {
  const serverBooks = await tryRequest<Book[]>('/books')
  if (serverBooks) {
    await saveLocalBooks(
      serverBooks.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        format: b.format,
        coverUrl: b.coverUrl ?? '',
        cached: false, // will be updated by book cache logic
      }))
    )
    return serverBooks
  }
  // Offline fallback
  const local = await getLocalBooks()
  return local.map(b => ({
    id: b.id,
    title: b.title,
    author: b.author,
    format: b.format as Book['format'],
    coverUrl: b.coverUrl,
    addedAt: '',
  }))
}

async function uploadBook(file: File, userId: string): Promise<Book> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('uploadedBy', String(userId))
  return request<Book>('/books', {
    method: 'POST',
    body: formData,
  })
}

async function removeBook(bookId: string): Promise<void> {
  return request<void>(`/books/${bookId}`, { method: 'DELETE' })
}

// ─── Progress ────────────────────────────────────────────────────────────────

interface ProgressResponse {
  cfi: string | null
  percentage: number
  version: number
  lastReadAt?: number
  conflict?: boolean
  serverData?: ProgressResponse
  serverVersion?: number
}

async function updateProgress(
  userId: string,
  bookId: string,
  progress: string,
  format: string
): Promise<ProgressResponse | null> {
  // Parse progress string to percentage
  const parts = progress.split('@@').filter(Boolean)
  let percentage = 0
  if (parts.length >= 2) {
    const first = parseFloat(parts[0])
    const second = parseFloat(parts[1])
    if (format === 'pdf' && second > 0) {
      percentage = Math.round((first / second) * 100)
    } else {
      percentage = Math.round(second * 100)
    }
  }

  // Get local version for optimistic locking
  const local = await getLocalProgress(userId, bookId)
  const localVersion = local?.version ?? 0

  // Always save to IndexedDB first
  await saveLocalProgress(userId, bookId, progress, percentage, localVersion, true)

  // Try to sync to server
  try {
    const response = await fetch(`${BASE_URL}/users/${userId}/books/${bookId}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cfi: progress, percentage, version: localVersion || undefined }),
    })

    const data = await response.json() as ProgressResponse

    if (response.status === 409) {
      // Conflict — return conflict data for resolution
      return data
    }

    if (response.ok) {
      // Sync succeeded — update local with new version, mark clean
      await saveLocalProgress(userId, bookId, progress, percentage, data.version, false)
      return data
    }

    // Server error — queue for later sync
    await addToSyncQueue({
      type: 'progress',
      userId,
      bookId,
      data: { cfi: progress, percentage },
      localVersion,
      createdAt: Date.now(),
    })
    return null
  } catch {
    // Offline — queue for later sync
    await addToSyncQueue({
      type: 'progress',
      userId,
      bookId,
      data: { cfi: progress, percentage },
      localVersion,
      createdAt: Date.now(),
    })
    return null
  }
}

async function getProgress(
  userId: string,
  bookId: string
): Promise<ProgressResponse | null> {
  const serverData = await tryRequest<ProgressResponse>(
    `/users/${userId}/books/${bookId}/progress`
  )
  if (serverData) {
    // Update local if not dirty
    const local = await getLocalProgress(userId, bookId)
    if (!local || !local.dirty) {
      await saveLocalProgress(
        userId,
        bookId,
        serverData.cfi,
        serverData.percentage,
        serverData.version,
        false
      )
    }
    return serverData
  }
  // Offline fallback
  const local = await getLocalProgress(userId, bookId)
  if (local) {
    return { cfi: local.cfi, percentage: local.percentage, version: local.version }
  }
  return null
}

// ─── Settings ────────────────────────────────────────────────────────────────

interface SettingsResponse extends ReaderSettings {
  version: number
  conflict?: boolean
  serverData?: SettingsResponse
  serverVersion?: number
}

async function getSettings(userId: string): Promise<ReaderSettings> {
  const serverData = await tryRequest<SettingsResponse>(`/users/${userId}/settings`)
  if (serverData) {
    const local = await getLocalSettings(userId)
    if (!local || !local.dirty) {
      await saveLocalSettings(userId, {
        writingMode: serverData.writingMode,
        fontSize: serverData.fontSize,
        theme: serverData.theme,
        openccMode: serverData.openccMode,
        tapZoneLayout: serverData.tapZoneLayout,
        version: serverData.version ?? 0,
        dirty: false,
      })
    }
    return serverData
  }
  // Offline fallback
  const local = await getLocalSettings(userId)
  if (local) {
    return {
      writingMode: local.writingMode as ReaderSettings['writingMode'],
      fontSize: local.fontSize,
      theme: local.theme as ReaderSettings['theme'],
      openccMode: local.openccMode as ReaderSettings['openccMode'],
      tapZoneLayout: local.tapZoneLayout as ReaderSettings['tapZoneLayout'],
      version: local.version,
    }
  }
  return {
    writingMode: 'vertical-rl',
    fontSize: 18,
    theme: 'light',
    openccMode: 'none',
    tapZoneLayout: 'default',
  }
}

async function updateSettings(userId: string, settings: ReaderSettings): Promise<SettingsResponse | null> {
  const local = await getLocalSettings(userId)
  const localVersion = local?.version ?? 0

  // Always save locally first
  await saveLocalSettings(userId, {
    writingMode: settings.writingMode,
    fontSize: settings.fontSize,
    theme: settings.theme,
    openccMode: settings.openccMode,
    tapZoneLayout: settings.tapZoneLayout,
    version: localVersion,
    dirty: true,
  })

  // Try to sync to server
  try {
    const response = await fetch(`${BASE_URL}/users/${userId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, version: localVersion || undefined }),
    })

    const data = await response.json() as SettingsResponse

    if (response.status === 409) {
      return data
    }

    if (response.ok) {
      await saveLocalSettings(userId, {
        writingMode: data.writingMode,
        fontSize: data.fontSize,
        theme: data.theme,
        openccMode: data.openccMode,
        tapZoneLayout: data.tapZoneLayout,
        version: data.version,
        dirty: false,
      })
      return data
    }

    await addToSyncQueue({
      type: 'settings',
      userId,
      data: { ...settings },
      localVersion,
      createdAt: Date.now(),
    })
    return null
  } catch {
    await addToSyncQueue({
      type: 'settings',
      userId,
      data: { ...settings },
      localVersion,
      createdAt: Date.now(),
    })
    return null
  }
}

export const api = {
  users: {
    list: listUsers,
    create: createUser,
    remove: removeUser,
  },
  books: {
    list: listBooks,
    upload: uploadBook,
    remove: removeBook,
    updateProgress,
    getProgress,
  },
  settings: {
    get: getSettings,
    update: updateSettings,
  },
}
