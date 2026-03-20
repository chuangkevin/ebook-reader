## Why

ReaderPage.tsx (464L) 和 EpubReader.tsx (391L) 承載了所有閱讀器邏輯，隨著功能累積（書籤、全螢幕、字體、邊距、主題...），這兩個檔案越來越難維護。進度格式使用自定義 `@@` 分隔字串，已造成多個 parsing bug（percentage 溢出、format 不一致）。API 錯誤全部被 `.catch(() => {})` 靜默吞掉，使用者不知道操作是否成功。

## What Changes

### 1. 元件拆分 — 降低單一檔案複雜度
- 從 ReaderPage 拆出 `ReaderToolbar`、`ReaderProgressBar`、`BookmarkDrawer` 元件
- 從 EpubReader 拆出 `useStyleInjector`、`useModeSwitch`、`useEpubProgress` custom hooks
- 每個檔案控制在 150 行以內

### 2. 結構化進度格式 — 取代 `@@` 字串 **BREAKING**
- 定義 `ReadingPosition` interface 取代自定義字串
- 後端 `cfi` 欄位改存 JSON 字串
- 前端 `onProgressChange` 改為傳遞 `ReadingPosition` 物件
- 移除 api.service.ts 中 30 行的字串 parsing 邏輯

### 3. 錯誤處理 — 使用者可見的回饋
- 建立全域 `useApiError` hook + Toast 通知
- API 呼叫失敗時顯示友善錯誤訊息
- 進度儲存失敗時顯示「進度未儲存」警告
- 加入 React Error Boundary 防止白屏

## Capabilities

### New Capabilities
- `reader-components`: ReaderPage 拆分後的子元件（ReaderToolbar、ReaderProgressBar、BookmarkDrawer）
- `reading-position`: 結構化 ReadingPosition 物件取代 @@ 字串格式
- `error-handling`: 全域錯誤處理、Error Boundary、Toast 通知

### Modified Capabilities
_(無既有 spec 需要修改)_

## Impact

- **前端**：ReaderPage.tsx、EpubReader.tsx、PdfReader.tsx、TxtReader.tsx、api.service.ts 全部受影響
- **後端**：progress.controller.ts 的 cfi 欄位格式變更（向下相容：先嘗試 JSON parse，失敗則 fallback 舊格式）
- **API**：`PUT /progress` 的 `cfi` 欄位從 `@@` 字串改為 JSON 字串 — **BREAKING**（需 migration）
- **E2E 測試**：所有進度相關測試需更新
- **資料庫**：reading_progress.cfi 欄位內容格式變更（不需 ALTER TABLE）
