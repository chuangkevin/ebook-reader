# Reader 整合測試流程

針對 epub.js Reader 的完整功能驗證，每次修改 `BookReader.tsx` 後必須執行。

---

## 環境準備

1. 啟動開發伺服器：`npm run dev`（前端 `localhost:5173`）
2. 開啟 Playwright 瀏覽器，導向至一本有多章節的 EPUB
3. 確認書籍已載入（標題顯示在 header）

測試用書籍：哈利波特（id: `c5257e47-6e92-482a-a073-8d3a8a360311`）
- 約 17 章，173 頁
- 第七章約 12 頁（橫排）/ 8 頁（直排）
- 第八章約 8 頁（橫排）/ 8 頁（直排）

---

## 測試一：橫排模式（horizontal）

### 設定
- 開啟設定抽屜 → 選擇「橫排」
- 關閉設定抽屜

### 1-1 章節內翻頁（向前）

連續按 `ArrowRight` 5 次，每次按後以 JS 確認：

```js
const iframe = document.querySelector('iframe');
const win = iframe.contentWindow;
({
  scrollX: win.scrollX,
  page: Math.round(win.scrollX / iframe.offsetWidth) + 1,
  chapter: win.document.querySelector('h1,h2').textContent.slice(0,20)
})
```

**預期**：
- `scrollX` 每次增加 `iframe.offsetWidth`（約 958px）
- `page` 依序 2→3→4→5→6
- `chapter` 維持同一章節（不跳章）

### 1-2 章節內翻頁（向後）

連續按 `ArrowLeft` 3 次確認：

**預期**：
- `scrollX` 每次減少 `iframe.offsetWidth`
- 章節名稱不變

### 1-3 向前跨章節

翻到當前章節最後一頁（scrollX ≈ docScrollWidth - iframeWidth），再按一次 `ArrowRight`：

```js
const iframe = document.querySelector('iframe');
const win = iframe.contentWindow;
({
  scrollX: win.scrollX,
  docScrollW: win.document.documentElement.scrollWidth,
  atEnd: win.scrollX >= win.document.documentElement.scrollWidth - iframe.offsetWidth - 2
})
```

確認 `atEnd: true` 後按 `ArrowRight`，驗證：

**預期**：
- `scrollX` 重置為 `0`
- `chapter` 變為下一章標題
- `docScrollWidth` 為新章節的寬度

### 1-4 向後跨章節

在新章節第 1 頁（scrollX=0）按 `ArrowLeft`：

**預期**：
- 切換回前一章節
- `scrollX` 為 `0`（前一章從頭開始）
- 章節名稱正確

### 1-5 寫入模式驗證

```js
const iframe = document.querySelector('iframe');
const win = iframe.contentWindow;
const doc = win.document;
({
  writingMode: win.getComputedStyle(doc.documentElement).writingMode,
  wmStyleEl: doc.getElementById('__reader-writing-mode').textContent.slice(0,50),
  containerDisplay: iframe.parentElement.parentElement.style.display
})
```

**預期**：
- `writingMode`: `"horizontal-tb"`
- `wmStyleEl`: 包含 `horizontal-tb`
- `containerDisplay`: `""` 或 `"flex"`（非 `block`）

---

## 測試二：直排模式（vertical）

### 設定
- 開啟設定抽屜 → 選擇「直排」
- 關閉設定抽屜

### 2-1 writing-mode 注入確認

```js
const iframe = document.querySelector('iframe');
const win = iframe.contentWindow;
const doc = win.document;
({
  writingMode: win.getComputedStyle(doc.documentElement).writingMode,
  wmStyleEl: doc.getElementById('__reader-writing-mode').textContent.slice(0,50),
  containerDisplay: iframe.parentElement.parentElement.style.display
})
```

**預期**：
- `writingMode`: `"vertical-rl"`
- `containerDisplay`: `"block"`

### 2-2 字體大小一致性（iOS bug #2）

```js
const iframe = document.querySelector('iframe');
const win = iframe.contentWindow;
const doc = win.document;
const ps = Array.from(doc.querySelectorAll('p')).slice(0, 5);
({
  bodyFontSize: win.getComputedStyle(doc.body).fontSize,
  samplePFontSizes: ps.map(p => win.getComputedStyle(p).fontSize)
})
```

**預期**：
- `bodyFontSize` 等於設定值（預設 19px）
- `samplePFontSizes` 所有值相同

### 2-3 章節內翻頁（vertical scrollTop）

連續按 `ArrowRight` 4 次，每次確認：

```js
const iframe = document.querySelector('iframe');
const container = iframe.parentElement.parentElement;
({
  scrollTop: container.scrollTop,
  page: Math.round(container.scrollTop / container.offsetHeight) + 1,
  chapter: iframe.contentWindow.document.querySelector('h1,h2').textContent.slice(0,20)
})
```

**預期**：
- `scrollTop` 每次增加 `container.offsetHeight`（約 944px）
- `chapter` 不變

### 2-4 跨章節後字體大小驗證

翻到章節末再按 `ArrowRight` 切換章節，重新執行 2-2 的字體檢查：

**預期**：
- 新章節字體大小與前一章相同
- writing-mode 仍為 `vertical-rl`

---

## 測試三：模式切換

### 3-1 橫排→直排切換

在橫排模式翻到第 3 頁，開設定切換為直排，關閉設定後驗證：

- writing-mode 變為 `vertical-rl`
- 字體大小不變
- scrollTop 為 0（重新載入）

### 3-2 直排→橫排切換

在直排模式翻到第 3 頁，開設定切換為橫排，關閉設定後驗證：

- writing-mode 變為 `horizontal-tb`
- iframe scrollX 為 0

---

## 測試四：設定變更

### 4-1 字體大小調整

在設定抽屜調大字體，確認：

```js
const iframe = document.querySelector('iframe');
const win = iframe.contentWindow;
({
  bodyFontSize: win.getComputedStyle(win.document.body).fontSize,
  fontStyleEl: win.document.getElementById('__reader-font-style').textContent.slice(0,100)
})
```

**預期**：`bodyFontSize` 反映新設定值

### 4-2 主題切換

切換亮色/護眼/暗色，確認：

```js
const iframe = document.querySelector('iframe');
const win = iframe.contentWindow;
({
  bg: win.getComputedStyle(win.document.body).backgroundColor,
  color: win.getComputedStyle(win.document.body).color
})
```

**預期**：背景色與字色對應所選主題

---

## 快速驗證腳本

可在 Playwright evaluate 一次執行整體健康檢查：

```js
const iframe = document.querySelector('iframe');
const win = iframe.contentWindow;
const doc = win.document;
const container = iframe.parentElement.parentElement;
const ps = Array.from(doc.querySelectorAll('p')).slice(0, 3);

({
  // 基本狀態
  chapter: doc.querySelector('h1,h2') ? doc.querySelector('h1,h2').textContent.slice(0,20) : null,
  writingMode: win.getComputedStyle(doc.documentElement).writingMode,
  // 字體
  bodyFontSize: win.getComputedStyle(doc.body).fontSize,
  fontSizesConsistent: new Set(ps.map(p => win.getComputedStyle(p).fontSize)).size === 1,
  // 捲動位置
  scrollX: win.scrollX,
  scrollTop: container.scrollTop,
  iframeW: iframe.offsetWidth,
  containerH: container.offsetHeight,
  // 注入 style 元素
  hasWmStyle: !!doc.getElementById('__reader-writing-mode'),
  hasFontStyle: !!doc.getElementById('__reader-font-style'),
  hasScrollbarStyle: !!doc.getElementById('__reader-scrollbar-hide'),
})
```

**全部通過的預期輸出（橫排 19px）**：
```json
{
  "writingMode": "horizontal-tb",
  "bodyFontSize": "19px",
  "fontSizesConsistent": true,
  "scrollX": 0,
  "iframeW": 958,
  "hasWmStyle": true,
  "hasFontStyle": true,
  "hasScrollbarStyle": true
}
```

---

## 已知限制

- **向後跨章節**：`r.prev()` 為 epub.js 原生行為，切換到上一章時永遠從第 1 頁開始，非 bug。
- **Playwright 環境**：`win.scrollX` 在桌面瀏覽器測試，iOS Safari 上的 `scrolling="no"` 行為需在真機上確認。
- **頁碼計算**：頁碼顯示為估算值（依 scrollX/scrollTop 計算），不同章節字數不同時可能有些微偏差。
