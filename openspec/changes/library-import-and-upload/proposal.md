## Why

目前上傳書籍只能單選、無進度回饋，且書庫無分類顯示。使用者在手機整理好的書籍資料夾結構（如「福爾摩斯/」）無法直接匯入，每次只能逐本上傳，體驗差。

## What Changes

- **資料夾匯入**：新增「選擇資料夾」入口，使用 `<input webkitdirectory>` 讓使用者從手機/桌面選取整個資料夾，自動解析子資料夾名稱為 collection 分類，批次上傳並帶入 collection 欄位
- **多選上傳**：現有單選 FAB 改為支援多選，上傳 Dialog 顯示每本書的進度條 + 成功/失敗狀態
- **書庫分類 Block**：書庫依 collection 分組，每個 collection 顯示為獨立的 Netflix 風格橫向 scroll 區塊（含標題）；無 collection 的書籍歸入「其他書籍」區塊
- **後端**：books 表新增 `collection` 欄位；上傳 API 接受 `collection` 參數

## Capabilities

### New Capabilities
- `book-collection`: 書籍分類系統 — collection 欄位、API 支援、書庫分組顯示
- `bulk-upload`: 批次上傳 — 多選檔案、資料夾匯入、進度回饋 UI

### Modified Capabilities
- 無 spec-level 行為變更（現有閱讀功能完全不受影響）

## Impact

- `backend/src/config/database.ts`：新增 `collection` 欄位 migration
- `backend/src/controllers/book.controller.ts`：upload 接受 collection 參數
- `backend/src/services/book.service.ts`：create 帶入 collection
- `backend/src/types/index.ts`：Book 型別加 collection
- `frontend/src/pages/BookLibrary.tsx`：分類 block UI
- `frontend/src/services/api.service.ts`：uploadBook 帶 collection
- `frontend/tests/e2e/`：新增 10-bulk-upload.spec.ts、11-collection-library.spec.ts
