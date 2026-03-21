## Implementation Tasks

### Phase 1: Backend Version Support

- [x] Task 1.1: reading_progress 表新增 version 欄位 + migration
- [ ] Task 1.2: user_settings 表新增 version 欄位
- [ ] Task 1.3: 修改 progress controller 支援 version-based optimistic locking
- [ ] Task 1.4: 新增 progress/resolve endpoint
- [ ] Task 1.5: 修改 settings controller 支援 version
- [ ] Task 1.6: 新增 settings/resolve endpoint
- [ ] Task 1.7: E2E 測試 — 後端 version API
- [ ] Task 1.8: Commit + Push「feat: backend version-based optimistic locking」

### Phase 2: IndexedDB Local Storage

- [ ] Task 2.1: 安裝 Dexie.js，建立 ReadflixDB schema
- [ ] Task 2.2: 建立 offlineStorage service（CRUD for progress, settings, books, syncQueue）
- [ ] Task 2.3: 修改 Zustand stores 整合 IndexedDB（啟動時載入、寫入時雙寫）
- [ ] Task 2.4: E2E 測試 — IndexedDB 讀寫
- [ ] Task 2.5: Commit + Push「feat: IndexedDB offline storage layer」

### Phase 3: Connection Monitor

- [ ] Task 3.1: 建立 useConnectionStore（online/offline 狀態）
- [ ] Task 3.2: 建立 ConnectionBanner UI 元件
- [ ] Task 3.3: E2E 測試 — 離線/上線狀態切換 UI
- [ ] Task 3.4: Commit + Push「feat: connection status monitor」

### Phase 4: PWA & Service Worker

- [ ] Task 4.1: 安裝 vite-plugin-pwa，設定 manifest + SW
- [ ] Task 4.2: 設定 runtime caching rules（book files, covers, API）
- [ ] Task 4.3: 書籍檔案自動下載邏輯（連線時背景下載所有書）
- [ ] Task 4.4: 書庫頁面顯示快取狀態
- [ ] Task 4.5: E2E 測試 — SW 註冊、離線頁面載入
- [ ] Task 4.6: Commit + Push「feat: PWA service worker + book caching」

### Phase 5: Sync Engine

- [ ] Task 5.1: 建立 SyncEngine service（queue flush、version 比對）
- [ ] Task 5.2: 整合 online 事件觸發同步
- [ ] Task 5.3: 修改 ReaderPage 進度儲存流程（先 IndexedDB → 嘗試 API → 失敗入 queue）
- [ ] Task 5.4: 修改 ReaderSettings 設定儲存流程
- [ ] Task 5.5: E2E 測試 — 離線進度儲存 + 上線同步
- [ ] Task 5.6: Commit + Push「feat: sync engine with offline queue」

### Phase 6: Conflict Resolution

- [ ] Task 6.1: 建立 ConflictDialog 元件（Steam 風格 UI）
- [ ] Task 6.2: 建立 SettingsConflictDialog 元件
- [ ] Task 6.3: 整合 SyncEngine 衝突偵測 → 彈出 Dialog
- [ ] Task 6.4: E2E 測試 — 衝突偵測 + 解決流程
- [ ] Task 6.5: Commit + Push「feat: Steam-style conflict resolution UI」

### Phase 7: Integration & Polish

- [ ] Task 7.1: 全流程 E2E 測試（離線閱讀 → 上線同步 → 衝突解決）
- [ ] Task 7.2: 多裝置模擬測試
- [ ] Task 7.3: 效能優化（大量書籍下載、IndexedDB 批次寫入）
- [ ] Task 7.4: Commit + Push「feat: offline mode complete」

## Development Rules

- 每個 Task 的 E2E 測試必須在實作前規劃
- Playwright 測試必須用 `--headed` 模式運行，讓使用者看到瀏覽器
- 每個 Phase 完成後必須 commit + push
