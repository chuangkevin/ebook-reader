## Architecture

```
Browser                                    Server
┌────────────────────────────────┐        ┌──────────────┐
│  Service Worker                │        │              │
│  ├─ App Shell (precache)       │ online │  Express API │
│  ├─ Book Files (Cache API)     │◄══════►│  + SQLite    │
│  └─ API Intercept (fallback)   │        │              │
│                                │        │  reading_    │
│  IndexedDB (Dexie.js)          │ offline│  progress    │
│  ├─ progress                   │───┐    │  + version   │
│  ├─ settings                   │   │    │              │
│  ├─ books (metadata)           │   │    │  user_       │
│  └─ syncQueue                  │   │    │  settings    │
│                                │   │    │  + version   │
│  SyncEngine                    │   │    └──────────────┘
│  ├─ online事件 → flush queue   │◄──┘
│  ├─ version比對 → 衝突偵測     │
│  └─ 衝突 → ConflictDialog     │
│                                │
│  ConnectionMonitor             │
│  └─ 狀態列指示器               │
└────────────────────────────────┘
```

## Key Decisions

### IndexedDB Library: Dexie.js
- 輕量 wrapper，Promise-based API
- 支援 versioned schema migration
- 比原生 IndexedDB API 簡潔很多

### Caching Strategy
- **App Shell**: Vite PWA plugin precache（SW 自動產生）
- **Book Files**: 連線時主動下載所有書至 Cache API（使用者不需手動）
- **API Responses**: Network-first，離線 fallback 到 IndexedDB

### Sync Strategy: Version-based Optimistic Locking
```
Client                          Server
  │  PUT /progress               │
  │  {cfi, percentage,           │
  │   localVersion: 3}           │
  │─────────────────────────────►│
  │                              │ if server.version == 3:
  │                              │   update, version = 4
  │                              │   return {ok, version: 4}
  │                              │ else:
  │                              │   return {conflict,
  │                              │     serverData, serverVersion}
  │◄─────────────────────────────│
  │                              │
  │  if conflict:                │
  │    show ConflictDialog       │
  │    user picks local/remote   │
  │    PUT /progress/resolve     │
  │      {chosen, forceVersion}  │
  │─────────────────────────────►│
```

### Conflict Resolution UI
- Steam 風格：兩欄並排顯示本地 vs 雲端
- 顯示：書名、章節位置、百分比、最後閱讀時間
- 使用者點選「使用此進度」來選擇
- Settings 衝突：同樣機制，顯示設定差異

### Data Flow: Progress Save
1. 翻頁 → 寫入 IndexedDB（即時）
2. 嘗試 API call
3. 成功 → 更新本地 version
4. 失敗（離線）→ 加入 syncQueue
5. online 事件 → flush syncQueue → 逐筆同步 → 處理衝突

### Book Cache Flow
1. 登入/首頁載入 → 取得書籍列表
2. 背景逐本下載至 Cache API
3. 離線時 SW 攔截 `/api/books/:id/file` → 從 Cache 回傳
4. 書庫頁面顯示下載狀態（已快取/下載中/未快取）

## Backend Changes

### reading_progress table
- 新增 `version INTEGER DEFAULT 1`
- UPDATE 時 version + 1

### user_settings table
- 新增 `version INTEGER DEFAULT 1`

### New API Endpoints
- `PUT /api/users/:userId/books/:bookId/progress` — 修改為支援 version 參數
- `PUT /api/users/:userId/books/:bookId/progress/resolve` — 衝突解決
- `PUT /api/users/:userId/settings` — 修改為支援 version 參數
- `PUT /api/users/:userId/settings/resolve` — 設定衝突解決
- `GET /api/books/download-all` — 回傳所有書籍 ID 列表供批次下載

## Technology Choices

| 需求 | 選擇 | 原因 |
|------|------|------|
| IndexedDB wrapper | Dexie.js | 輕量、Promise API、migration 支援 |
| PWA/SW | vite-plugin-pwa | 自動產生 SW、precache manifest |
| 離線偵測 | navigator.onLine + events | 原生 API，不需額外依賴 |
| 衝突 UI | MUI Dialog | 已有 MUI，不需額外 UI 庫 |
