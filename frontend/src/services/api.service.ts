import type { User, Book, ReaderSettings } from '../types/index'

const BASE_URL = '/api'
const API_BASE = BASE_URL

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

// Users
async function listUsers(): Promise<User[]> {
  return request<User[]>('/users')
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

async function updateUser(id: string, name: string, avatarColor?: string): Promise<User> {
  return request<User>(`/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, avatarColor }),
  })
}

// Normalize backend book response: backend returns coverPath (absolute path),
// frontend expects coverUrl (/api/books/:id/cover)
function normalizeBook(raw: any): Book {
  return {
    id: raw.id,
    title: raw.title,
    author: raw.author,
    format: raw.format,
    coverUrl: `/api/books/${raw.id}/cover`,
    progress: raw.progress,
    addedAt: raw.uploadedAt ? String(raw.uploadedAt) : '',
    uploadedBy: raw.uploadedBy,
    collection: raw.collection ?? null,
  }
}

// Books
async function listBooks(_userId: string): Promise<Book[]> {
  const raw = await request<any[]>('/books')
  return raw.map(normalizeBook)
}

async function getBook(bookId: string): Promise<Book> {
  const raw = await request<any>(`/books/${bookId}`)
  return normalizeBook(raw)
}

async function uploadBook(
  file: File,
  userId: string,
  options?: { collection?: string | null; onProgress?: (percent: number) => void }
): Promise<Book> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('uploadedBy', String(userId))
    if (options?.collection) formData.append('collection', options.collection)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/books`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options?.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status === 201) {
        try { resolve(normalizeBook(JSON.parse(xhr.responseText))) }
        catch { reject(new Error('Invalid response')) }
      } else {
        const err = new Error(xhr.responseText || String(xhr.status))
        ;(err as any).status = xhr.status
        reject(err)
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(formData)
  })
}

async function removeBook(bookId: string, userId: string): Promise<void> {
  return request<void>(`/books/${bookId}?requestedBy=${encodeURIComponent(userId)}`, { method: 'DELETE' })
}

async function updateProgress(userId: string, bookId: string, progress: string, format: string): Promise<void> {
  // Parse progress string to cfi + percentage
  // EPUB: @@chapterIndex@@sectionFraction@@totalSections -> (chapterIndex+sectionFraction)/totalSections * 100
  // PDF:  @@page@@totalPages                            -> page/total * 100
  // TXT:  @@scrollFraction@@1                           -> scrollFraction * 100
  const parts = progress.split('@@').filter(Boolean)
  let percentage = 0
  if (parts.length >= 2) {
    const fourth = parts.length >= 4 ? parseFloat(parts[3]) : NaN
    if (!isNaN(fourth)) {
      // EPUB: use weighted fraction from SectionProgress
      percentage = Math.round(fourth * 100)
    } else {
      const first = parseFloat(parts[0])
      const second = parseFloat(parts[1])
      const third = parts.length >= 3 ? parseFloat(parts[2]) : 0
      if (format === 'pdf' && second > 0) {
        percentage = Math.round((first / second) * 100)
      } else if (format !== 'pdf' && third > 0) {
        percentage = Math.round(((first + second) / third) * 100)
      } else {
        percentage = Math.round(second * 100)
      }
    }
    percentage = Math.min(100, Math.max(0, percentage))
    // Ensure any reading activity records at least 1% so book appears in "繼續閱讀"
    if (percentage === 0 && parts.length >= 2) percentage = 1
  }
  return request<void>(`/users/${userId}/books/${bookId}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cfi: progress, percentage }),
  })
}

// Settings
async function getSettings(userId: string): Promise<ReaderSettings> {
  return request<ReaderSettings>(`/users/${userId}/settings`)
}

async function updateSettings(userId: string, settings: ReaderSettings): Promise<void> {
  return request<void>(`/users/${userId}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
}

// Bookmarks
async function getBookmarks(userId: string): Promise<string[]> {
  return request<string[]>(`/users/${userId}/bookmarks`)
}

async function toggleBookmark(userId: string, bookId: string): Promise<void> {
  return request<void>(`/users/${userId}/books/${bookId}/bookmark`, { method: 'POST' })
}

// User reading progress (all books)
async function getUserProgress(userId: string): Promise<Array<{ bookId: string; cfi: string; percentage: number; lastReadAt: number }>> {
  return request<Array<{ bookId: string; cfi: string; percentage: number; lastReadAt: number }>>(`/users/${userId}/progress`)
}

// Page bookmarks (閱讀器內頁面書籤)
export interface PageBookmark {
  id: string
  userId: string
  bookId: string
  position: string
  label: string | null
  createdAt: number
}

async function listPageBookmarks(userId: string, bookId: string): Promise<PageBookmark[]> {
  return request<PageBookmark[]>(`/users/${userId}/books/${bookId}/page-bookmarks`)
}

async function addPageBookmark(userId: string, bookId: string, position: string, label?: string): Promise<PageBookmark> {
  return request<PageBookmark>(`/users/${userId}/books/${bookId}/page-bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position, label }),
  })
}

async function removePageBookmark(id: string): Promise<void> {
  return request<void>(`/page-bookmarks/${id}`, { method: 'DELETE' })
}

// Clear reading progress for a book
async function clearProgress(userId: string, bookId: string): Promise<void> {
  return request<void>(`/users/${userId}/books/${bookId}/progress`, { method: 'DELETE' })
}

export const api = {
  users: {
    list: listUsers,
    create: createUser,
    remove: removeUser,
    update: updateUser,
  },
  books: {
    list: listBooks,
    get: getBook,
    upload: uploadBook,
    remove: removeBook,
    updateProgress,
    getUserProgress,
    clearProgress,
  },
  bookmarks: {
    list: getBookmarks,
    toggle: toggleBookmark,
  },
  pageBookmarks: {
    list: listPageBookmarks,
    add: addPageBookmark,
    remove: removePageBookmark,
  },
  settings: {
    get: getSettings,
    update: updateSettings,
  },
}
