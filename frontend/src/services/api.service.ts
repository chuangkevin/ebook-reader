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

async function removeUser(id: number): Promise<void> {
  return request<void>(`/users/${id}`, { method: 'DELETE' })
}

// Books
async function listBooks(_userId: number): Promise<Book[]> {
  return request<Book[]>('/books')
}

async function uploadBook(file: File, userId: number): Promise<Book> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('uploadedBy', String(userId))
  return request<Book>('/books', {
    method: 'POST',
    body: formData,
  })
}

async function removeBook(bookId: number): Promise<void> {
  return request<void>(`/books/${bookId}`, { method: 'DELETE' })
}

async function updateProgress(userId: number, bookId: number, progress: string): Promise<void> {
  return request<void>(`/users/${userId}/books/${bookId}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress }),
  })
}

// Settings
async function getSettings(userId: number): Promise<ReaderSettings> {
  return request<ReaderSettings>(`/users/${userId}/settings`)
}

async function updateSettings(userId: number, settings: ReaderSettings): Promise<void> {
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
    upload: uploadBook,
    remove: removeBook,
    updateProgress,
  },
  settings: {
    get: getSettings,
    update: updateSettings,
  },
}
