## Context

ebook-reader 使用 foliate-js Paginator 作為 EPUB 渲染核心。Paginator 內部使用 Shadow DOM，包含 `#background` div 和 iframe。目前主題 CSS 只注入 iframe 內部，外層 Shadow DOM 不隨主題更新。進度計算使用簡單的 `(chapterIndex + fraction) / totalSections`，未考慮各 section 大小差異。邊距固定為 `gap: 0.06`，無法調整。後端已有 `PUT /users/:id` API 支援修改名稱和頭像顏色。

## Goals / Non-Goals

**Goals:**
- 主題切換時所有層級（外層容器、paginator #background、iframe 內容）背景色同步更新
- 使用者可調整文字邊距，設定持久化
- 進度百分比反映實際閱讀位置（位元組加權），直排/橫排切換後百分比一致
- 書庫頁面提供使用者設定入口，可修改名稱與頭像顏色

**Non-Goals:**
- 上傳自訂頭像圖片（只做顏色選擇）
- 修改使用者選擇首頁的 UI
- 預渲染所有 section 計算精確全書頁數

## Decisions

### 1. 主題背景同步

在 `useEffect([fontSize, theme])` 中，注入 iframe CSS 後，透過 `paginatorRef.current.shadowRoot.getElementById('background')` 存取 Shadow DOM 內的 `#background` div，直接設定 `style.background` 為對應主題色。同時更新外層 ReaderPage 容器的 bgcolor。

**理由**: Paginator 的 `#background` 只在 section load 時讀取 `getBackground(doc)`，不會在主題切換時自動更新。直接操作 Shadow DOM 是最小改動。

### 2. 邊距調整

在 ReaderSettings 加 Slider（範圍 0.02 ~ 0.15，步進 0.01，預設 0.06）。設定變更時呼叫 `paginator.setAttribute('gap', value)`。值存入 settingsStore 並持久化到後端。

**理由**: foliate-js 已原生支援 `gap` 屬性（CSS 變數 `--_gap`），不需修改 paginator.js。

### 3. 進度計算

使用 foliate-js 的 `SectionProgress` 類別。在 book 載入後建立 `new SectionProgress(book.sections, 1500, 1600)`。在 `handleRelocate` 中呼叫 `sectionProgress.getProgress(index, fraction, size)` 取得加權後的 `fraction`。顯示格式改為 toolbar 顯示全書百分比。

**理由**: `SectionProgress` 已存在於 foliate-js，用各 section 的 `size`（位元組）做加權，版權頁/目錄等短 section 佔比小，進度更符合直覺。且此 fraction 是 layout-independent（基於位元組比例），直排/橫排切換後百分比一致。

### 4. 使用者設定

書庫頁面底部新增固定的 PROFILE 按鈕。點擊展開 Bottom Drawer，包含：
- 名稱編輯 TextField
- 頭像顏色選擇（6~8 個預設顏色圓圈）
- 儲存按鈕

呼叫 `PUT /api/users/:id` 更新。儲存後更新 userStore 中的 currentUser。

## Risks / Trade-offs

- **Shadow DOM 存取**: `shadowRoot` 可能在某些瀏覽器或 paginator 版本中為 closed shadow。需確認 foliate-js 使用 open shadow root。
- **SectionProgress 依賴 section.size**: 如果 EPUB 的 section 沒有 size 屬性（某些格式），需要 fallback 到等權計算。
- **邊距極端值**: gap 太小文字貼邊，太大內容太窄。設定範圍 2%~15% 應可涵蓋合理使用。
