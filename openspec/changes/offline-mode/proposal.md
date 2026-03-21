## Why

Readflix 目前完全依賴網路連線，斷網後無法閱讀、進度遺失。使用者在通勤、飛機上、或網路不穩環境下無法使用。多裝置場景下（手機+平板+Boox），同時離線閱讀後上線會互相覆蓋進度。

## What Changes

- 新增 Service Worker + PWA manifest，App Shell 和書籍檔案可離線存取
- 新增 IndexedDB 本地儲存層，離線時儲存閱讀進度、設定、書籍元資料
- 連線時自動下載所有書籍檔案至 Cache API
- 新增 Sync Engine，上線時自動將本地變更同步至伺服器
- 新增衝突解決 UI（Steam 風格），本地與雲端進度不一致時讓使用者選擇
- 後端 reading_progress 表新增 version 欄位，支援樂觀鎖衝突偵測
- 新增連線狀態指示器

## Capabilities

### New

- `offline-storage`：IndexedDB 本地儲存 + Cache API 書籍快取
- `sync-engine`：離線排隊、上線批次同步、version-based 樂觀鎖
- `conflict-resolution`：Steam 風格衝突解決 UI
- `pwa-service-worker`：Service Worker + PWA manifest

### Modified

- `reading-progress`：雙寫模式（先 IndexedDB，再同步雲端）
- `reader-settings`：本地優先策略

## Non-goals

- 離線上傳新書籍
- 離線新增/刪除使用者
- 書籍差異同步（delta sync）
- Background Sync API（MVP 用 online 事件）

## Development Rules

- 每個功能實作前，先規劃 Playwright E2E 測試
- 實作完成後，用 `--headed` 模式運行 Playwright 測試
- 每個階段（功能開發完成、測試通過）都要 commit + push
