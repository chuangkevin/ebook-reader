## Implementation Tasks

### Phase 1: Backend Version Support ✅ (`79236cf`)

- [x] Task 1.1: reading_progress 表新增 version 欄位 + migration
- [x] Task 1.2: user_settings 表新增 version 欄位
- [x] Task 1.3: 修改 progress controller 支援 version-based optimistic locking
- [x] Task 1.4: 新增 progress/resolve endpoint
- [x] Task 1.5: 修改 settings controller 支援 version
- [x] Task 1.6: 新增 settings/resolve endpoint
- [x] Task 1.7: E2E 測試 — 後端 version API（12 tests pass）
- [x] Task 1.8: Commit + Push「feat: backend version-based optimistic locking」

### Phase 2: IndexedDB Local Storage ✅ (`7661561`)

- [x] Task 2.1: 安裝 Dexie.js，建立 ReadflixDB schema
- [x] Task 2.2: 建立 offlineStorage service（CRUD for progress, settings, books, syncQueue）
- [x] Task 2.3: 修改 api.service 整合 IndexedDB（dual-write pattern）
- [x] Task 2.4: E2E 測試 — IndexedDB 讀寫（5 tests pass）
- [x] Task 2.5: Commit + Push「feat: IndexedDB offline storage layer」

### Phase 3: Connection Monitor ✅ (`8c5e4f8`)

- [x] Task 3.1: 建立 useConnectionStore（online/offline 狀態）
- [x] Task 3.2: 建立 ConnectionBanner UI 元件
- [x] Task 3.3: E2E 測試 — 離線/上線狀態切換 UI（3 tests pass）
- [x] Task 3.4: Commit + Push「feat: connection status monitor」

### Phase 4: PWA & Service Worker ✅ (`4c06289`)

- [x] Task 4.1: 安裝 vite-plugin-pwa，設定 manifest + SW
- [x] Task 4.2: 設定 runtime caching rules（book files CacheFirst, covers CacheFirst, API NetworkFirst）
- [x] Task 4.3: 書籍檔案自動下載邏輯（cacheAllBooks on connect + online event）
- [x] Task 4.4: E2E 測試 — book cache 驗證
- [x] Task 4.5: Commit + Push（合併於 Phase 4-6 commit）

### Phase 5: Sync Engine ✅ (`4c06289`)

- [x] Task 5.1: 建立 SyncEngine service（flushSyncQueue、version 比對、409 conflict 處理）
- [x] Task 5.2: 整合 online 事件觸發同步（initSyncListeners）
- [x] Task 5.3: api.service dual-write：先 IndexedDB → 嘗試 API → 失敗入 syncQueue
- [x] Task 5.4: settings 同樣 dual-write pattern
- [x] Task 5.5: E2E 測試 — 離線進度儲存 + 上線同步（2 tests pass）
- [x] Task 5.6: Commit + Push（合併於 Phase 4-6 commit）

### Phase 6: Conflict Resolution ✅ (`4c06289`)

- [x] Task 6.1: 建立 ConflictDialog 元件（Steam 風格雙欄 UI）
- [x] Task 6.2: 建立 ConflictManager（Zustand store + resolve API 整合）
- [x] Task 6.3: 整合 SyncEngine 衝突偵測 → 彈出 Dialog
- [x] Task 6.4: E2E 測試 — 衝突偵測 + 解決流程（2 tests pass，含 progress 和 settings 衝突）
- [x] Task 6.5: Commit + Push（合併於 Phase 4-6 commit）

### Phase 7: Integration & Polish ✅ (`3d6a89d`)

- [x] Task 7.1: 全流程 E2E 測試（離線閱讀 → 上線同步 → 衝突解決）
- [x] Task 7.2: 多裝置模擬測試（進度衝突 409 + settings 衝突 409 + resolve）
- [x] Task 7.3: 效能驗證（快速翻頁 queue 限制、IndexedDB 持久化、離線書庫載入）
- [x] Task 7.4: Commit + Push「feat: Phase 7 integration E2E tests」

## Development Rules

- 每個 Task 的 E2E 測試必須在實作前規劃
- Playwright 測試必須用 `--headed` 模式運行，讓使用者看到瀏覽器
- 每個 Phase 完成後必須 commit + push
