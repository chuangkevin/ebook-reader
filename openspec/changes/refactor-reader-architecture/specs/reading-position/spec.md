## ADDED Requirements

### Requirement: ReadingPosition 統一格式
系統 SHALL 使用 `ReadingPosition` 結構化物件取代 `@@` 分隔字串作為進度格式。ReadingPosition 包含 format 欄位區分 epub/pdf/txt，以及對應的位置資訊。

#### Scenario: EPUB 進度格式
- **WHEN** EpubReader 回報進度
- **THEN** 產生 ReadingPosition 物件 `{ format: 'epub', chapterIndex, sectionFraction, totalSections, weightedFraction }`

#### Scenario: PDF 進度格式
- **WHEN** PdfReader 回報進度
- **THEN** 產生 ReadingPosition 物件 `{ format: 'pdf', page, totalPages }`

#### Scenario: TXT 進度格式
- **WHEN** TxtReader 回報進度
- **THEN** 產生 ReadingPosition 物件 `{ format: 'txt', scrollFraction }`

### Requirement: 進度 API 傳輸 JSON
`PUT /api/users/:userId/books/:bookId/progress` 的 `cfi` 欄位 SHALL 傳輸 JSON 序列化的 ReadingPosition 字串。percentage 由前端從 ReadingPosition 計算後傳入，不再由 api.service.ts 解析字串。

#### Scenario: 進度上傳
- **WHEN** 前端呼叫 updateProgress
- **THEN** request body 為 `{ cfi: JSON.stringify(position), percentage: calcPercentage(position) }`

#### Scenario: 進度下載
- **WHEN** 前端讀取使用者進度
- **THEN** 從 cfi 欄位 JSON.parse 還原 ReadingPosition 物件

### Requirement: 舊格式向下相容
系統 SHALL 支援讀取舊 `@@` 格式的 cfi 資料。

#### Scenario: 讀取舊格式進度
- **WHEN** 後端或前端讀取 cfi 欄位且 JSON.parse 失敗
- **THEN** fallback 解析 `@@` 格式轉換為 ReadingPosition 物件

### Requirement: percentage 最低保證
任何有閱讀活動的書籍 percentage SHALL 至少為 1，確保出現在「繼續閱讀」區塊。

#### Scenario: 首頁進度 percentage
- **WHEN** 使用者開啟書籍首頁（位置接近 0%）
- **THEN** percentage 為 1（非 0）
