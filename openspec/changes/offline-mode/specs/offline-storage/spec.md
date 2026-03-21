## Offline Storage

### IndexedDB Schema (Dexie.js)

```typescript
// db.ts
class ReadflixDB extends Dexie {
  progress!: Table<LocalProgress>
  settings!: Table<LocalSettings>
  books!: Table<LocalBook>
  syncQueue!: Table<SyncQueueItem>
}

interface LocalProgress {
  id: string           // `${userId}_${bookId}`
  userId: string
  bookId: string
  cfi: string
  percentage: number
  lastReadAt: number   // Unix ms
  version: number      // 與 server 同步的版本號
  dirty: boolean       // 是否有未同步的本地變更
}

interface LocalSettings {
  userId: string       // primary key
  writingMode: string
  fontSize: number
  theme: string
  openccMode: string
  tapZoneLayout: string
  version: number
  dirty: boolean
}

interface LocalBook {
  id: string
  title: string
  author: string
  format: string
  coverUrl: string
  cached: boolean      // 書籍檔案是否已快取到 Cache API
}

interface SyncQueueItem {
  id?: number          // auto-increment
  type: 'progress' | 'settings'
  userId: string
  bookId?: string
  data: any
  localVersion: number
  createdAt: number
}
```

### Book File Cache (Cache API)

- Cache name: `readflix-books-v1`
- 快取 key: `/api/books/{bookId}/file`
- 連線時自動背景下載所有書籍
- 下載進度透過 store 追蹤，書庫頁面顯示狀態

### Behaviors

- App 啟動時從 IndexedDB 載入資料到 Zustand store
- 所有寫入操作先寫 IndexedDB，再嘗試 API
- 離線時 API 失敗，自動加入 syncQueue
- 書庫頁面顯示每本書的快取狀態圖示
