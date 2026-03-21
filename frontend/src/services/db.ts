import Dexie, { type Table } from 'dexie'

export interface LocalProgress {
  id: string           // `${userId}_${bookId}`
  userId: string
  bookId: string
  cfi: string | null
  percentage: number
  lastReadAt: number
  version: number
  dirty: boolean
}

export interface LocalSettings {
  userId: string       // primary key
  writingMode: string
  fontSize: number
  theme: string
  openccMode: string
  tapZoneLayout: string
  version: number
  dirty: boolean
}

export interface LocalBook {
  id: string
  title: string
  author: string
  format: string
  coverUrl: string
  cached: boolean
}

export interface LocalUser {
  id: string
  name: string
  avatar?: string
}

export interface SyncQueueItem {
  id?: number
  type: 'progress' | 'settings'
  userId: string
  bookId?: string
  data: Record<string, unknown>
  localVersion: number
  createdAt: number
}

class ReadflixDB extends Dexie {
  progress!: Table<LocalProgress, string>
  settings!: Table<LocalSettings, string>
  books!: Table<LocalBook, string>
  users!: Table<LocalUser, string>
  syncQueue!: Table<SyncQueueItem, number>

  constructor() {
    super('readflix')
    this.version(1).stores({
      progress: 'id, userId, bookId, [userId+bookId]',
      settings: 'userId',
      books: 'id',
      users: 'id',
      syncQueue: '++id, type, userId',
    })
  }
}

export const db = new ReadflixDB()
