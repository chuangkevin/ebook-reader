## Context

原有 BookReader.tsx 以 `react-reader`（封裝 epub.js）為核心，透過 content hooks 注入 writing-mode CSS、手動操控 iframe 尺寸來實現直排。epub.js 的 `flow: paginated` 模式在 WebKit 上需要 ~60ms 才能完成多欄佈局，期間任何翻頁操作都會誤判為章節末尾而跳章。這是框架層級的限制，無法在不侵入 epub.js 內部的情況下根治。

## Goals / Non-Goals

**Goals:**
- EPUB 渲染器原生支援 `vertical-rl`，不需任何 hack
- 直排/橫排翻頁行為穩定，iOS WebKit 上無 timing bug
- 進度儲存精確（scroll fraction），跨裝置恢復到同一位置
- 閱讀設定即時套用（不重新載入整本書）
- 後端 API 與資料庫格式與舊版相容（不需 migration）

**Non-Goals:**
- 書籤、標注、搜尋（後續版本）
- PWA / 離線快取（後續版本）
- 音量鍵翻頁（需 Android WebView 特殊處理，後續版本）

## Decisions

### D1：EPUB 渲染器選擇 — foliate-js

**選擇**：使用 [foliate-js](https://github.com/johnfactotum/foliate-js)

**理由**：
- 從設計上就支援 `vertical-rl`，不是事後 hack
- 使用 `<iframe>` + Web Components，與 React 整合方式明確
- 支援 `flow: paginated`（分頁）和 `flow: scrolled`（捲動），切換直/橫排只需改 CSS 變數
- 比 epub.js 更現代（ES modules，無 CommonJS 包袱）
- 社群有實際直排中文小說使用案例

**替代方案考慮**：
- epub.js 直接用底層 API：仍有 WebKit 60ms timing 問題，根本原因在 css-columns，非 react-reader 封裝問題
- 原生 iframe + 自行解析 EPUB：工作量過大，epub 格式複雜
- Bibi（日文 EPUB 閱讀器）：功能豐富但難以嵌入 React SPA

### D2：翻頁機制 — CSS scroll snap + scrollLeft/scrollTop

**選擇**：foliate-js 的 `Paginator` 元件管理分頁，我們只控制外層容器的 scrollLeft（橫排）或 scrollTop（直排）

**理由**：
- foliate-js 的 Paginator 已處理好 viewport 計算、章節邊界偵測
- 不需要手動計算 iframe 尺寸或多欄數量
- 章節邊界（`at-start`、`at-end` 事件）由 Paginator 提供，不需猜測

### D3：進度儲存 — scroll fraction

**選擇**：儲存 `{ chapterIndex, scrollFraction }` 而非 CFI

**理由**：
- CFI 在直排/橫排切換後對應位置不一致
- scroll fraction（0.0–1.0）在同一章節內跨排版模式都能對應到近似位置
- 實作簡單，不依賴 epub.js 的 locations API

**格式**：`@@chapterIndex@@scrollFraction`（保持與舊版 CFI 字串格式相容，後端不需改）

### D4：前端架構 — React 18 + Vite + Zustand

**選擇**：Zustand 取代 Redux Toolkit

**理由**：
- 閱讀器狀態（當前章節、進度、設定）不需要 Redux 的複雜中介層
- Zustand 寫法更簡潔，適合中小型 SPA
- 其餘保持不變：React 18、TypeScript、Vite、MUI

### D5：後端 — 原封不動

後端 Express + SQLite 架構完全不動。API 端點、資料格式、Docker 配置全部保持，只重建前端。

## Risks / Trade-offs

- **[Risk] foliate-js 文件不完整** → 從 [Foliate 桌面應用](https://github.com/johnfactotum/foliate) 的源碼學習用法；有實際大型應用作為參考
- **[Risk] foliate-js 與 React 整合複雜** → foliate-js 是 vanilla JS，用 `useRef` + `useEffect` 包裝成 React hook；先建 spike 驗證
- **[Risk] iOS WebKit 仍有相容性問題** → 及早在真機上測試，在 spike 階段就確認直排分頁可行
- **[Risk] 進度 scroll fraction 精度** → 章節開頭/結尾誤差可接受；書籤等精確定位功能列為後續版本

## Migration Plan

1. 後端不需任何改動，保持運行
2. 前端從 `frontend/` 目錄重建：`npm create vite@latest`
3. 建立 foliate-js spike：驗證直排分頁在 iOS Safari 上可行
4. 若 spike 通過，照 tasks.md 順序建立各模組
5. 部署時替換 Docker image 即可，資料庫不需 migration

## Spike 驗證結果（2026-03-17）

### foliate-js API 用法（已驗證）

```js
// 1. 載入書籍（使用 view.js 的 makeBook，不要直接 new EPUB）
import { makeBook } from './foliate-js/view.js'
const book = await makeBook(file)  // file: File 物件或 URL

// 2. 設定 Paginator 屬性（透過 HTML attributes，不是 open() 參數）
paginator.setAttribute('flow', 'paginated')
paginator.setAttribute('gap', '0.06')
paginator.setAttribute('max-column-count', '1')

// 3. 開啟並導航到第一頁（open() 後必須呼叫 next() 才會渲染）
paginator.open(book)
await paginator.next()

// 4. 翻頁
paginator.next()   // 下一頁
paginator.prev()   // 上一頁
paginator.atStart  // boolean
paginator.atEnd    // boolean

// 5. 注入 writing-mode（在 load 事件 + relocate 事件中持續更新）
paginator.addEventListener('load', ({ detail: { doc } }) => {
  // doc 是 iframe 的 document
  injectWritingMode(doc)
})
paginator.addEventListener('relocate', () => {
  // 用 getContents() 確保已載入的 iframe 都是正確模式
  for (const { doc } of paginator.getContents()) injectWritingMode(doc)
})

function injectWritingMode(doc) {
  const wm = isVertical ? 'vertical-rl' : 'horizontal-tb'
  let style = doc.getElementById('__wm')
  if (!style) {
    style = doc.createElement('style')
    style.id = '__wm'
    doc.head.appendChild(style)
  }
  style.textContent = `html, body { writing-mode: ${wm} !important; }`
}

// 6. 進度事件
paginator.addEventListener('relocate', ({ detail }) => {
  const { fraction } = detail  // 0.0–1.0，當前章節進度
  // detail.location 可能沒有頁碼（取決於 EPUB 是否有 pageList）
})
```

### 驗證結論

- ✅ `vertical-rl` 直排正確顯示，文字由右至左分欄
- ✅ `horizontal-tb` 橫排正確顯示，文字左至右
- ✅ `atStart`/`atEnd` 在章節邊界正確回報
- ✅ `load` + `relocate` + `getContents()` 組合可即時切換排版
- ⚠️ `paginator.open()` 的第二個參數（options）無效，必須用 HTML attribute
- ⚠️ `detail.location` 的 `current`/`total` 頁碼需要 EPUB 有 `pageList` 才有值
- ⚠️ 切換模式後 re-open 時 `load` 事件不一定重新觸發（iframe 被 reuse），需在 `relocate` 中補注入

## Open Questions

- **Boox Go Color 7** 的 Android WebView 版本？是否需要 polyfill？
- 字體嵌入：foliate-js 是否自動處理 EPUB 內嵌字體，或需要手動 inject？
