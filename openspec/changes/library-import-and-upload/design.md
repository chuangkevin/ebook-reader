## Architecture

### Backend

**DB Migration** — `books` 表新增 `collection TEXT DEFAULT NULL`：
```sql
ALTER TABLE books ADD COLUMN collection TEXT DEFAULT NULL;
```

**API 變更**：
- `POST /api/books`（upload）：multipart body 新增 `collection` 欄位（optional）
- `GET /api/books`：回傳包含 `collection` 欄位

### Frontend

**資料夾匯入流程**：
```
FAB 長按 or 展開選單
  ├── 選擇檔案（多選，現有）
  └── 選擇資料夾（新增）
        │
        ▼
<input type="file" webkitdirectory multiple accept=".epub,.pdf,.txt">
        │
        ▼
解析 file.webkitRelativePath
  "福爾摩斯/血字的研究.epub" → collection="福爾摩斯"
  "哈利波特.epub"            → collection=null
        │
        ▼
UploadQueue：每個檔案建立 UploadItem { file, collection, status, progress }
        │
        ▼
並行上傳（最多 3 個同時），XMLHttpRequest 監聽 progress event
```

**UploadDialog**：
```
┌─────────────────────────────────────────────┐
│ 上傳書籍 (3/5)                        ✕    │
├─────────────────────────────────────────────┤
│ 福爾摩斯/血字的研究.epub                    │
│ [████████████░░░░░░░░] 65%                  │
│                                             │
│ 福爾摩斯/四簽名.epub                        │
│ [████████████████████] ✓ 完成               │
│                                             │
│ 哈利波特.epub                               │
│ [░░░░░░░░░░░░░░░░░░░░] 等待中...            │
│                                             │
│ 重複書名.epub                               │
│ [──────────────────────] ⚠ 已存在，跳過    │
└─────────────────────────────────────────────┘
```

**書庫分類 Block**：
```tsx
// 資料分組
const grouped = groupBy(books, b => b.collection ?? '__none__')
const collections = Object.keys(grouped).filter(k => k !== '__none__').sort()

// 渲染：collection blocks 在上，其他書籍在下
{collections.map(col => (
  <CollectionBlock key={col} title={col} books={grouped[col]} />
))}
{grouped['__none__'] && (
  <CollectionBlock title="其他書籍" books={grouped['__none__']} />
)}
```

`CollectionBlock` = 橫向 ScrollRow，已有現成元件可複用。

### 並行上傳限流
```
const CONCURRENCY = 3
使用 async-pool pattern，避免同時送太多請求壓垮後端
```

### E2E 測試策略
- **10-bulk-upload.spec.ts**：多選 3 本書上傳，驗證進度條出現、每本都顯示完成
- **11-collection-library.spec.ts**：上傳帶 collection 的書，驗證書庫出現分類 block，點選後進入閱讀器不影響現有進度功能
- 資料夾匯入因 `webkitdirectory` 在 Playwright 中需用 `setInputFiles` 模擬，以相對路徑帶入測試

## Key Decisions

| 決定 | 理由 |
|------|------|
| `webkitdirectory` 而非 File System Access API | iOS Safari 相容性，15.4+ 支援 |
| 並行 3 個 | 避免伺服器過載，同時有速度感 |
| collection 為 null 而非空字串 | DB 查詢更簡潔，區分「無分類」與「根目錄」 |
| CollectionBlock 複用現有 ScrollRow | 不重複造輪，維持 UI 一致性 |
| 重複書籍跳過（不報錯） | 批次匯入時重複很常見，不應中斷流程 |
