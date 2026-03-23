## MODIFIED Requirements

### Requirement: UploadDialog 顯示書名
UploadDialog SHALL 優先顯示 `resolvedTitle`（前端解析的書名），若無則 fallback 顯示 `file.name`（檔名）。
collection 前綴顯示邏輯不變（`collection/書名`）。

#### Scenario: 有解析書名時顯示書名
- **WHEN** EPUB metadata 解析成功，`resolvedTitle = "哈利波特 神秘的魔法石"`
- **THEN** Dialog 列表顯示 `哈利波特 神秘的魔法石`，而非 `harry1.epub`

#### Scenario: 解析失敗時顯示檔名
- **WHEN** `resolvedTitle` 為 `null` 或 `undefined`
- **THEN** Dialog 列表顯示原始 `file.name`

### Requirement: 預標重複不上傳
UploadDialog SHALL 在初始化 items 時，`preMarkedDuplicate === true` 的項目直接設 `status = 'duplicate'`，不加入上傳佇列。

#### Scenario: 預標重複項目跳過上傳
- **WHEN** `UploadFile.preMarkedDuplicate === true`
- **THEN** 該項目在 Dialog 開啟時即為「跳過（已存在）」，不發起 XHR 請求
