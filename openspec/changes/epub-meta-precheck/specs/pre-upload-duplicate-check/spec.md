## ADDED Requirements

### Requirement: 上傳前重複預檢
系統 SHALL 在使用者選完檔案後、開啟 UploadDialog 前，將解析出的書名與現有書庫比對（case-insensitive trim）。
比對命中者 SHALL 設 `preMarkedDuplicate: true`，不進入上傳佇列。

#### Scenario: 重複書籍預標記
- **WHEN** 選取的檔案解析書名與書庫中某本書完全相符（忽略大小寫與首尾空白）
- **THEN** 該檔案在 UploadDialog 開啟時即顯示為「跳過（已存在）」狀態，不發起任何網路請求

#### Scenario: 書名解析失敗時不預標
- **WHEN** EPUB 解析失敗（`resolvedTitle === null`）
- **THEN** 不預標重複，交由後端判斷（後端 409 仍生效）

#### Scenario: 後端 409 仍保留
- **WHEN** 前端未預標但後端回傳 409
- **THEN** UploadDialog 仍正確顯示「跳過（已存在）」，行為與現有一致

### Requirement: 解析並行執行
系統 SHALL 對所有選取檔案並行執行 metadata 解析（`Promise.allSettled`），不阻塞 UI。

#### Scenario: 多檔並行解析
- **WHEN** 使用者選取 9 個 EPUB 檔案
- **THEN** 所有檔案同時開始解析，全部完成後才開啟 UploadDialog
