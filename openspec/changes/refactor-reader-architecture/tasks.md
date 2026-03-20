## 1. 錯誤處理基礎設施（先做，後續重構可立即使用）

- [ ] 1.1 建立 `useToast` zustand store（message, severity, show/hide actions）
- [ ] 1.2 在 App.tsx 加入全域 `<ToastProvider>` 元件（讀取 useToast store，渲染 MUI Snackbar）
- [ ] 1.3 建立 React Error Boundary 元件，包裹在 App.tsx 的 Routes 外層
- [ ] 1.4 E2E 測試：驗證 Error Boundary 顯示「出了點問題」（可用 test-only 的故意 crash 元件）

## 2. ReadingPosition 結構化格式

- [ ] 2.1 在 `frontend/src/types/index.ts` 定義 `ReadingPosition` interface 和 `calcPercentage()` 工具函數
- [ ] 2.2 在 `frontend/src/utils/readingPosition.ts` 實作 `parsePosition(cfi: string, format: string): ReadingPosition`（支援 JSON 和舊 `@@` 格式 fallback）
- [ ] 2.3 修改 EpubReader 的 `onProgressChange` 改為傳遞 `ReadingPosition` 物件
- [ ] 2.4 修改 PdfReader 的 `onProgressChange` 改為傳遞 `ReadingPosition` 物件
- [ ] 2.5 修改 TxtReader 的 `onProgressChange` 改為傳遞 `ReadingPosition` 物件
- [ ] 2.6 修改 `api.service.ts` 的 `updateProgress`：移除 `@@` 字串 parsing，改為 `JSON.stringify(position)` + `calcPercentage(position)`
- [ ] 2.7 修改 ReaderPage 的 `handleProgressChange` 接收 `ReadingPosition` 物件
- [ ] 2.8 修改 BookLibrary 的進度還原邏輯（`parsePosition` 讀取 cfi）
- [ ] 2.9 E2E 測試：更新 05-reader-progress.spec.ts 驗證新格式
- [ ] 2.10 E2E 測試：驗證舊格式 `@@` 資料仍能正確還原

## 3. ReaderPage 元件拆分

- [ ] 3.1 拆出 `ReaderToolbar` 元件（工具列 UI + 所有按鈕 callback props）
- [ ] 3.2 拆出 `ReaderProgressBar` 元件（進度滑桿 + 百分比顯示 + onSeek）
- [ ] 3.3 拆出 `BookmarkDrawer` 元件（書籤列表 Drawer + CRUD + goToBookmark）
- [ ] 3.4 ReaderPage 改為組合使用新元件，確認行為不變
- [ ] 3.5 E2E 測試：跑完 03-reader-ui.spec.ts 確認無回歸

## 4. EpubReader hook 拆分

- [ ] 4.1 拆出 `useStyleInjector` hook（CSS 注入 + paginator.render() 觸發重排版）
- [ ] 4.2 拆出 `useModeSwitch` hook（直排/橫排切換 + 文字錨點保存/還原）
- [ ] 4.3 拆出 `useEpubProgress` hook（relocate 事件監聽 + SectionProgress 加權計算）
- [ ] 4.4 EpubReader 改為使用新 hooks，確認行為不變
- [ ] 4.5 E2E 測試：跑完 06-mode-switch.spec.ts、07-theme-switch.spec.ts、11-font-size.spec.ts 確認無回歸

## 5. API 錯誤處理整合

- [ ] 5.1 將 BookLibrary 中的 API 呼叫加入 toast 錯誤通知（上傳、刪除、設定儲存）
- [ ] 5.2 將 ReaderPage 中的書籤 API 呼叫加入 toast 錯誤通知
- [ ] 5.3 進度儲存失敗特殊處理：一次性「進度未儲存」警告，不重複顯示
- [ ] 5.4 E2E 測試：模擬 API 失敗場景驗證 toast 出現

## 6. 整合驗證

- [ ] 6.1 跑完所有 E2E 測試（01~11），確認零回歸
- [ ] 6.2 TypeScript 型別檢查通過（`tsc -b --noEmit`）
- [ ] 6.3 移除舊的 `@@` 字串 parsing 邏輯（確認不再被引用）
- [ ] 6.4 確認每個新檔案不超過 ~150 行
