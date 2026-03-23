## ADDED Requirements

### Requirement: EPUB 書名提取
系統 SHALL 在前端從 EPUB 檔案（`File` 物件）提取書名，不需上傳至伺服器。
提取流程：讀取 ZIP → `META-INF/container.xml` → OPF 路徑 → `<dc:title>` 文字內容。
任何步驟失敗（非 EPUB、加密、格式異常）SHALL 回傳 `null`。

#### Scenario: 標準 EPUB 提取書名
- **WHEN** 傳入包含合法 OPF 的 EPUB 檔案
- **THEN** 回傳 `<dc:title>` 內容（已 trim）

#### Scenario: 損壞或加密 EPUB
- **WHEN** 傳入無法解壓或缺少 OPF 的檔案
- **THEN** 回傳 `null`，不拋出例外

#### Scenario: 非 EPUB 檔案
- **WHEN** 傳入 PDF 或 TXT
- **THEN** 函式回傳 `null`（由呼叫端決定 fallback）

### Requirement: TXT 書名推導
系統 SHALL 將 TXT 檔案名稱去副檔名後作為書名，與後端行為一致。

#### Scenario: TXT 檔名推導
- **WHEN** 傳入 `后青春期的诗.txt`
- **THEN** 推導書名為 `后青春期的诗`

### Requirement: 解析效能
系統 SHALL 對每個檔案只解壓 `container.xml` 和 `.opf` 兩個小檔案（使用 `fflate` filter），不解壓整個 EPUB。

#### Scenario: 大型 EPUB 解析速度
- **WHEN** 傳入 50MB 的 EPUB 檔案
- **THEN** 解析時間 SHALL 在 2 秒內完成（僅讀 OPF，不解壓圖片/內容）
