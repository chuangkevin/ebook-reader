## 1. 技術 Spike：foliate-js 直排驗證

- [x] 1.1 建立獨立 HTML 頁面，載入 foliate-js，開啟一本 CJK EPUB，確認 vertical-rl 直排正確顯示
- [ ] 1.2 在 iPhone iOS Safari 真機上確認直排分頁翻頁行為（無跳頁、無黑屏）
- [x] 1.3 確認 foliate-js Paginator 的 `at-start`、`at-end` 事件在直排模式下正確觸發
- [x] 1.4 確認橫排 horizontal-tb 分頁行為正常
- [x] 1.5 記錄 foliate-js API 用法（Paginator 初始化、翻頁方法、設定 writing-mode）

## 2. 前端專案初始化

- [x] 2.1 在 `frontend/` 建立 Vite + React 18 + TypeScript 專案
- [x] 2.2 安裝依賴：MUI、Zustand、foliate-js（或 git submodule）
- [x] 2.3 設定 Vite proxy：`/api` → `localhost:3003`
- [x] 2.4 建立 `src/services/api.service.ts`，包裝所有後端 API 呼叫
- [x] 2.5 建立 Zustand store：`userStore`、`bookStore`、`settingsStore`
- [x] 2.6 建立 Docker 配置（Dockerfile、nginx.conf），確認與後端 compose 整合

## 3. 使用者管理

- [x] 3.1 建立 `UserSelectionScreen` 頁面：列出使用者卡片，新增/刪除使用者
- [x] 3.2 整合 `GET /api/users`、`POST /api/users`、`DELETE /api/users/:id`
- [x] 3.3 選擇使用者後導向 `/library`，userId 存入 Zustand

## 4. 書庫

- [x] 4.1 建立 `BookLibrary` 頁面：網格顯示書封、書名、作者、進度百分比
- [x] 4.2 整合 `GET /api/users/:userId/books`、書籍進度顯示
- [x] 4.3 實作上傳功能：`POST /api/books`，支援 EPUB/PDF/TXT
- [x] 4.4 實作刪除書籍：`DELETE /api/books/:bookId`
- [x] 4.5 點擊書籍導向閱讀器，傳入 bookId 與上次進度

## 5. EPUB 閱讀器核心

- [x] 5.1 建立 `EpubReader` 元件，用 `useRef` + `useEffect` 包裝 foliate-js Paginator
- [x] 5.2 實作直排模式：設定 `vertical-rl`，Paginator 以 scrollTop 分頁
- [x] 5.3 實作橫排模式：設定 `horizontal-tb`，Paginator 以 scrollLeft 分頁
- [x] 5.4 實作章節邊界翻頁：監聽 `at-start`/`at-end` 事件，切換章節
- [x] 5.5 實作向後跨章節：載入上一章並跳到最後一頁
- [x] 5.6 實作目錄（TOC）：顯示章節列表，點選跳轉

## 6. 翻頁操作

- [x] 6.1 實作觸控翻頁：點擊螢幕左/右（橫排）或上/下（直排）區域
- [x] 6.2 實作鍵盤翻頁：ArrowLeft/Right/Up/Down、PageUp/Down、Space
- [x] 6.3 實作滑動手勢翻頁（touch swipe）
- [x] 6.4 防誤觸：翻頁區域禁用 user-select
- [x] 6.5 實作翻頁區域配置（預設/左手/右手）

## 7. 閱讀進度

- [x] 7.1 實作進度儲存：翻頁後儲存 `{ chapterIndex, scrollFraction }` → `@@chapterIndex@@scrollFraction` 格式
- [x] 7.2 整合 `PUT /api/users/:userId/books/:bookId/progress`
- [x] 7.3 實作進度恢復：開書時讀取進度，跳到對應章節與捲動位置
- [x] 7.4 實作進度顯示：底部常駐顯示頁碼 / 總頁數與百分比

## 8. 閱讀設定

- [x] 8.1 建立 `ReaderSettings` 抽屜元件
- [x] 8.2 實作排版切換（直排 ↔ 橫排），即時套用不重載書籍
- [x] 8.3 實作字體大小調整，即時注入 CSS 到 iframe
- [x] 8.4 實作主題切換（亮色/護眼/暗色），即時套用
- [x] 8.5 實作簡繁轉換（opencc-js）
- [x] 8.6 整合 `PUT /api/users/:userId/settings` 儲存設定

## 9. PDF / TXT 閱讀器

- [ ] 9.1 整合 react-pdf，建立 `PdfReader` 元件，支援翻頁與進度儲存
- [ ] 9.2 建立 `TxtReader` 元件，支援直排/橫排顯示與進度儲存

## 10. 整合測試與部署

- [ ] 10.1 iPhone iOS Safari 真機測試：直排翻頁、橫排翻頁、進度恢復
- [ ] 10.2 Android Chrome 測試：所有功能
- [ ] 10.3 Boox Go Color 7 測試：實體按鈕翻頁
- [x] 10.4 更新 GitHub Actions CI/CD workflow（docker build & push）
- [ ] 10.5 確認 Docker Compose 完整部署（frontend + backend）
