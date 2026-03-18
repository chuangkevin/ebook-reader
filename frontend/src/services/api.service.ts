import type { User, Book, ReaderSettings } from '../types/index'

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

// Books
async function listBooks(_userId: string): Promise<Book[]> {
  return request<Book[]>('/books')
}

async function getBook(bookId: string): Promise<Book> {
  return request<Book>(`/books/${bookId}`)
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

async function updateProgress(userId: string, bookId: string, progress: string, format: string): Promise<void> {
  // Parse progress string to cfi + percentage
  // EPUB: @@chapterIndex@@scrollFraction  -> percentage = scrollFraction * 100
  // PDF:  @@page@@totalPages              -> percentage = page/total * 100
  // TXT:  @@scrollFraction@@1             -> percentage = scrollFraction * 100
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

export const api = {
  users: {
    list: listUsers,
    create: createUser,
    remove: removeUser,
  },
  books: {
    list: listBooks,
    get: getBook,
    upload: uploadBook,
    remove: removeBook,
    updateProgress,
  },
  settings: {
    get: getSettings,
    update: updateSettings,
  },
}
