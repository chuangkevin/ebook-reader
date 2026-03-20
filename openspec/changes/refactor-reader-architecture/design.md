## Context

目前 ReaderPage.tsx (464L) 是一個 God Component，包含工具列、書籤管理、進度滑桿、全螢幕、設定載入等所有邏輯。EpubReader.tsx (391L) 同時管理 paginator 生命週期、CSS 注入、模式切換、進度追蹤。進度使用 `@@index@@fraction@@total@@weighted` 格式在系統間傳遞，api.service.ts 有 30 行 parsing 邏輯。API 錯誤全部靜默吞掉。

## Goals / Non-Goals

**Goals:**
- 每個元件/hook 單一責任，檔案控制在 ~150 行
- 進度格式類型安全，消除字串 parsing bug
- 使用者能看到操作失敗的回饋

**Non-Goals:**
- 不改變 UI 外觀或使用者體驗
- 不加入新功能（純重構）
- 不更換技術棧（zustand、MUI、foliate-js 不變）
- 不處理認證/授權問題

## Decisions

### D1: 元件拆分策略 — 按功能職責拆分

**決定：** 從 ReaderPage 拆出 3 個元件，從 EpubReader 拆出 3 個 custom hooks。

```
ReaderPage.tsx (464L → ~120L)
├─ <ReaderToolbar />         ← 工具列 UI + 按鈕事件
├─ <ReaderProgressBar />     ← 進度滑桿 + 百分比顯示
├─ <BookmarkDrawer />        ← 書籤列表 + CRUD
└─ <EpubReader /> / <PdfReader /> / <TxtReader />

EpubReader.tsx (391L → ~150L)
├─ useStyleInjector(doc, writingMode, fontSize, theme)
├─ useModeSwitch(paginator, book)
└─ useEpubProgress(paginator, sectionProgress, onProgressChange)
```

**替代方案：** 用 Context 而非 prop drilling → 過度設計，prop 層級只有 1-2 層。

### D2: ReadingPosition 結構化格式

**決定：** 定義統一的 `ReadingPosition` interface，JSON 序列化存入 DB。

```typescript
interface ReadingPosition {
  format: 'epub' | 'pdf' | 'txt'
  // EPUB
  chapterIndex?: number
  sectionFraction?: number
  totalSections?: number
  weightedFraction?: number
  // PDF
  page?: number
  totalPages?: number
  // TXT
  scrollFraction?: number
}
```

**percentage 計算：** 從 ReadingPosition 即時計算，不再依賴字串 parsing。

```typescript
function calcPercentage(pos: ReadingPosition): number {
  switch (pos.format) {
    case 'epub': return Math.max(1, Math.round((pos.weightedFraction ?? 0) * 100))
    case 'pdf':  return Math.max(1, Math.round(((pos.page ?? 1) / (pos.totalPages ?? 1)) * 100))
    case 'txt':  return Math.max(1, Math.round((pos.scrollFraction ?? 0) * 100))
  }
}
```

**向下相容：** 後端讀取 cfi 時先嘗試 `JSON.parse()`，失敗則 fallback 解析舊 `@@` 格式並轉換。

**替代方案：** 用 EPUB CFI 標準格式 → 太複雜，只有 EPUB 適用，PDF/TXT 沒有對應概念。

### D3: 錯誤處理策略 — Toast + Error Boundary

**決定：**

1. **API 層：** 建立 `useApi` hook 包裝 fetch，失敗時透過 zustand store 觸發 toast
2. **Toast：** 用 MUI Snackbar（已在用），建立 `useToast` store 統一管理
3. **Error Boundary：** 在 App.tsx 加入 React Error Boundary，顯示「出了點問題」+ 重新載入按鈕
4. **進度儲存：** 特殊處理 — 失敗時不阻斷閱讀，但在底部顯示一次性警告

**替代方案：** react-hot-toast → 額外依賴，MUI Snackbar 已經夠用。

## Risks / Trade-offs

- **[Risk] 重構過程中 E2E 測試大量失敗** → Mitigation: 分階段做，每個階段都跑完整測試
- **[Risk] 舊格式進度資料遺失** → Mitigation: 後端 fallback 解析舊格式，不需 migration script
- **[Risk] 拆太細反而增加複雜度** → Mitigation: 只拆到 2 層（Page → Component → Hook），不過度抽象
- **[Trade-off] JSON 存 DB 比字串佔更多空間** → 可接受，每筆進度 ~200 bytes
