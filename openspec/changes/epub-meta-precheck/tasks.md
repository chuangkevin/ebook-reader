# Tasks

## 1. 依賴安裝

- [x] 1.1 `cd frontend && npm install fflate`
- [x] 1.2 確認 `fflate` 出現在 `frontend/package.json` dependencies

## 2. EPUB Metadata 工具

- [x] 2.1 建立 `frontend/src/utils/epubMeta.ts`，export `extractBookTitle(file: File): Promise<string | null>`
- [x] 2.2 EPUB 流程：`ArrayBuffer` → `fflate.unzipSync`（filter: container.xml + *.opf）→ 解析 container.xml 取 OPF 路徑 → 解析 OPF 取 `<dc:title>`
- [x] 2.3 TXT 流程：回傳 `file.name` 去副檔名
- [x] 2.4 PDF 及其他：回傳 `null`（fallback 到檔名）
- [x] 2.5 所有錯誤以 try/catch 包覆，失敗時回傳 `null`

## 3. 型別擴充

- [x] 3.1 `frontend/src/components/UploadDialog.tsx`：`UploadFile` interface 新增 `resolvedTitle?: string` 和 `preMarkedDuplicate?: boolean`

## 4. BookLibrary 整合

- [x] 4.1 `BookLibrary.tsx`：`openFilePicker` handler 中，取得 files 後呼叫 `Promise.allSettled(files.map(f => extractBookTitle(f.file)))`
- [x] 4.2 `BookLibrary.tsx`：建立 `existingTitleSet`（現有 `books` 的 title lowercase trim set）
- [x] 4.3 `BookLibrary.tsx`：對每個 file，若 `resolvedTitle` 命中 `existingTitleSet` 則設 `preMarkedDuplicate: true`
- [x] 4.4 `BookLibrary.tsx`：將 `resolvedTitle` 和 `preMarkedDuplicate` 附加到 `UploadFile` 物件後再 `setUploadFiles`

## 5. UploadDialog 更新

- [x] 5.1 `UploadDialog.tsx`：items 初始化時，`preMarkedDuplicate === true` 的項目設 `status: 'duplicate'`
- [x] 5.2 `UploadDialog.tsx`：`runUploads` 的 queue 排除初始 status 已為 'duplicate' 的項目
- [x] 5.3 `UploadDialog.tsx`：列表顯示改用 `item.resolvedTitle ?? item.file.name`（collection 前綴邏輯不變）

## 6. 品質確認

- [x] 6.1 `tsc --noEmit` 通過
- [ ] 6.2 手動測試：選取重複 EPUB → Dialog 一開即顯示跳過，未發出 XHR
- [ ] 6.3 手動測試：選取新 EPUB → 正常上傳，顯示真實書名而非檔名
- [ ] 6.4 commit + push
