## Why

上傳書籍後才由後端回傳 409「重複」，整個檔案已傳輸完畢才被拒絕，浪費頻寬且體驗差。改在前端選檔後、上傳前即解析 EPUB/PDF metadata 取得書名，與書庫比對，重複書目直接跳過不上傳。

## What Changes

- 安裝 `fflate` 輕量 ZIP 解析器（~10 KB gzip）作為 frontend dependency
- 新增 `epubMeta.ts` 工具：從 File 物件讀取 EPUB（ZIP → container.xml → OPF → `<dc:title>`）或 PDF（DataView → Info.Title）metadata，回傳書名字串
- `UploadFile` interface 新增 `resolvedTitle?: string`（前端解析出的書名）
- `BookLibrary.tsx`：選檔後呼叫 metadata 解析，與現有 `books` 比對，重複的設 `preMarkedDuplicate: true`
- `UploadDialog.tsx`：
  - 接受 `existingTitles: Set<string>` prop
  - 初始化 items 時，`preMarkedDuplicate` 者直接設 status='duplicate'，不進入上傳佇列
  - 顯示 `resolvedTitle`（若有），否則 fallback 到 `file.name`
- TXT 檔案以檔名（去副檔名）作為書名，行為與後端一致

## Capabilities

### New Capabilities

- `epub-meta-extraction`: 前端從 EPUB/PDF/TXT 檔案擷取書名（不上傳）
- `pre-upload-duplicate-check`: 選檔後、上傳前，以提取的書名與書庫比對，重複者標記跳過

### Modified Capabilities

- `bulk-upload`: UploadDialog 改顯示解析後書名；支援預標 duplicate 狀態的 items 直接跳過

## Impact

- **新增依賴**：`fflate`（frontend）
- **修改檔案**：`UploadDialog.tsx`、`BookLibrary.tsx`、`frontend/src/types/index.ts`
- **新增檔案**：`frontend/src/utils/epubMeta.ts`
- **不影響**：後端 API、閱讀器、進度儲存、現有書庫所有功能
- 後端 409 重複保護仍保留作為最後防線
