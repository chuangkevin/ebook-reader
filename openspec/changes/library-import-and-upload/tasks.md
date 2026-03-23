# Tasks

## 後端

- [x] 1.1 `database.ts`：新增 `collection TEXT DEFAULT NULL` migration（ALTER TABLE + 檢查欄位是否存在）
- [x] 1.2 `backend/src/types/index.ts`：Book interface 新增 `collection?: string | null`
- [x] 1.3 `book.service.ts`：`create()` 接受 `collection` 參數，寫入 DB；`mapRow()` 回傳 collection
- [x] 1.4 `book.controller.ts`：`upload()` 從 `req.body.collection` 讀取並傳入 service
- [x] 1.5 後端驗證：collection 若非 null 則 trim，空字串轉為 null

## 前端 API

- [x] 2.1 `api.service.ts`：`uploadBook()` 改用 XMLHttpRequest，支援 `onProgress` callback 和 `collection` 參數
- [x] 2.2 `frontend/src/types/index.ts`：Book interface 新增 `collection?: string | null`

## 書庫 UI — 分類 Block

- [x] 3.1 `BookLibrary.tsx`：新增 `groupBooksByCollection()` 函式，回傳 `{ collection: string | null, books: Book[] }[]`
- [x] 3.2 `BookLibrary.tsx`：有 collection 時渲染分類 block（標題 + ScrollRow），無 collection 區塊顯示「其他書籍」
- [x] 3.3 確認：無任何書籍有 collection 時，維持現有顯示（不顯示「其他書籍」標題）

## 前端 UI — 上傳

- [x] 4.1 `BookLibrary.tsx`：FAB 展開為兩個選項 SpeedDial：「選擇檔案」（多選）、「選擇資料夾」
- [x] 4.2 建立 `UploadDialog.tsx` 元件：接受 `files: UploadFile[]`，列出每本書狀態
- [x] 4.3 `UploadDialog.tsx`：每列顯示檔名、LinearProgress、狀態 icon（等待/上傳中/完成/跳過/失敗）
- [x] 4.4 `UploadDialog.tsx`：並行上傳邏輯，最多 3 個同時，使用 XMLHttpRequest progress event
- [x] 4.5 `UploadDialog.tsx`：409 重複回應 → 標記跳過，不中斷其他上傳
- [x] 4.6 `UploadDialog.tsx`：全部完成後顯示摘要（X 成功 / Y 跳過 / Z 失敗）
- [x] 4.7 `BookLibrary.tsx`：解析 `webkitdirectory` 選擇結果，從 `webkitRelativePath` 提取 collection 名稱
- [x] 4.8 Dialog 關閉後觸發書庫重整（`fetchBooks()`）

## E2E 測試

- [x] 5.1 `12-bulk-upload.spec.ts`：上傳書籍，驗證 Dialog 出現進度條、顯示完成 ✓
- [x] 5.2 `12-bulk-upload.spec.ts`：上傳含重複書名，驗證重複項顯示「跳過」
- [x] 5.3 `13-collection-library.spec.ts`：上傳帶 collection 的書，驗證書庫出現分類 block
- [x] 5.4 `13-collection-library.spec.ts`：點選分類 block 中的書進入閱讀器，驗證進度正常儲存
- [ ] 5.5 回歸測試：跑完整 E2E 測試套件，確認 01~09 全部通過

## 清理

- [x] 6.1 `tsc -b --noEmit` 通過
- [x] 6.2 移除任何 debug console.log
- [ ] 6.3 commit + push
