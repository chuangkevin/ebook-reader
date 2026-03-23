## Context

現有上傳流程將整個檔案傳至後端後才由後端解析 metadata、判斷重複。EPUB 是標準 ZIP 格式，瀏覽器可直接以 `ArrayBuffer` 讀取後用 `fflate.unzipSync` 解壓，提取 OPF 中的 `<dc:title>`。PDF 可用 DataView 解析 trailer dictionary 取得 Info.Title。TXT 直接用檔名。

## Goals / Non-Goals

**Goals:**
- 前端選檔後立即（非同步）解析書名，不需上傳
- 與現有 `books` store 比對，重複者在 Dialog 開啟前即標記
- Dialog 顯示解析後書名，提升可讀性
- 後端 409 保護仍保留（防止 race condition 或 metadata 不符的情況）

**Non-Goals:**
- 不取代後端重複檢查
- 不解析 EPUB 內容（章節、封面等）
- 不支援加密 EPUB（直接 fallback 檔名）

## Decisions

### D1：ZIP 解析庫選擇 `fflate`
- `fflate`：~10 KB gzip，純 TypeScript，有 `filter` 可只解壓需要的檔案
- `jszip`：~50 KB，Promise-based，較重
- `adm-zip`：Node.js 限定，瀏覽器不能用
- **決定**：用 `fflate`，透過 `filter` 只讀 `META-INF/container.xml` 和 `.opf`，最小化記憶體使用

### D2：解析時機在 `openFilePicker` handler 內
在 `BookLibrary.tsx` 選完檔案後、`setUploadFiles` 前，用 `Promise.allSettled` 並行解析所有檔案。
- 失敗（非標準 EPUB、加密）→ `resolvedTitle = null` → fallback 到檔名
- 最多幾十本同時解析，可接受

### D3：比對邏輯：case-insensitive trim 比較
```ts
const normalize = (s: string) => s.trim().toLowerCase()
existingTitles.has(normalize(resolvedTitle ?? nameWithoutExt))
```
與後端一致（後端也是直接用 title 字串比對）。

### D4：`UploadDialog` 不直接接收 `existingTitles`
由 `BookLibrary` 在開 Dialog 前完成預標記（`preMarkedDuplicate: boolean`），Dialog 只需看 flag，不需知道書庫資料。降低元件耦合。

### D5：UploadFile 型別擴充
```ts
interface UploadFile {
  file: File
  collection: string | null
  resolvedTitle?: string        // extracted title
  preMarkedDuplicate?: boolean  // true = skip upload, show as duplicate
}
```

## Risks / Trade-offs

- **大型 EPUB 解析耗時**：沙丘六部曲可能 50MB+，但只讀 container.xml + OPF（通常 < 5KB），fflate filter 不會解壓其他檔案 → 風險低
- **EPUB metadata 與後端提取結果不一致**：極少數 EPUB 有多個 `<dc:title>`，或 OPF 路徑非標準 → fallback 到不預標，仍由後端 409 處理
- **PDF title 解析**：PDF trailer 解析複雜，先做 EPUB，PDF fallback 用檔名
- **race condition**：兩個使用者同時上傳同一本書 → 後端 409 仍會擋住
