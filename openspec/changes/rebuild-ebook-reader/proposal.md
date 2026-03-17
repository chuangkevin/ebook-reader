## Why

原有實作以 react-reader（epub.js）為核心，但該套件不原生支援 `vertical-rl` 直排模式，所有直排功能都是 hack（1308 行 BookReader.tsx、60ms timer、iframe 尺寸手動操控），且在 iOS WebKit 上持續出現 timing bug，無法穩定運作。重建時選擇原生支援直排的 EPUB 渲染方案，從根本解決問題。

## What Changes

- **BREAKING** 移除整個 frontend 與 backend 程式碼，從零重建
- 選擇原生支援 `vertical-rl` 的 EPUB 渲染器（取代 react-reader/epub.js）
- 重建書庫、使用者管理、閱讀器三大模組
- 進度儲存改用可靠的 scroll fraction 機制（不依賴 epub.js CFI）
- 閱讀設定（排版、字體、主題）即時套用，不需重新載入章節
- Docker Compose 自架部署維持不變

## Capabilities

### New Capabilities

- `user-management`：多使用者，首頁選擇使用者進入書庫，各自擁有獨立進度與設定
- `book-library`：書庫管理，上傳 EPUB/PDF/TXT，顯示書封、進度，繼續閱讀
- `epub-reader`：EPUB 閱讀核心，支援直排（vertical-rl）與橫排（horizontal-tb），分頁式翻頁，iOS WebKit 相容
- `pdf-reader`：PDF 閱讀，逐頁顯示
- `txt-reader`：TXT 閱讀，直排/橫排顯示
- `reading-progress`：閱讀進度儲存與跨裝置恢復，精確到頁內位置
- `reader-settings`：閱讀設定，主題/字體/排版/翻頁區域，即時套用
- `page-navigation`：多種翻頁方式，觸控/滑動/鍵盤/Boox 實體鍵/音量鍵

### Modified Capabilities

（無既有 spec，全部從零建立）

## Impact

- **前端**：全部重建，React 18 + TypeScript + Vite
- **EPUB 渲染**：替換 react-reader/epub.js，評估 foliate-js 或直接使用 epubjs 底層 API 搭配正確的 flow/manager 設定
- **後端**：Express + SQLite 架構保持，API 端點保持相容（users、books、progress、bookmarks）
- **部署**：Docker Compose 架構不變
- **目標裝置**：iPhone iOS Safari（最高優先）、Android Chrome、Boox Go Color 7、桌面瀏覽器
