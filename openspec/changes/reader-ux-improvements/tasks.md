## 1. 修正黑暗主題背景不生效

- [x] 1.1 在 EpubReader.tsx 的 `useEffect([fontSize, theme])` 中，注入 iframe CSS 後，存取 `paginatorRef.current.shadowRoot.getElementById('background')` 並設定 `style.background` 為對應主題色
- [x] 1.2 確認 foliate-js paginator 使用 open shadow root（若為 closed，需改用其他方式）
- [x] 1.3 E2E 測試：`07-theme-switch.spec.ts`
  - 切換到黑暗主題後，截圖驗證無白色背景殘留
  - 在非第一頁切換主題，驗證左右邊緣無白邊
  - 切換 light → dark → sepia → light 循環，每次截圖確認背景色正確

## 2. 新增邊距調整

- [x] 2.1 settingsStore 新增 `gap` 欄位（預設 `0.06`，範圍 `0.02` ~ `0.15`）
- [x] 2.2 ReaderSettings.tsx 新增邊距滑桿 UI（Slider，label 顯示百分比）
- [x] 2.3 EpubReader.tsx 接收 `gap` prop，在初始化及 gap 變更時呼叫 `paginator.setAttribute('gap', value)`
- [x] 2.4 後端 settings API 確認 gap 欄位可儲存與讀取
- [x] 2.5 E2E 測試：加入 `03-reader-ui.spec.ts` 或新建 `08-reader-gap.spec.ts`
  - 開啟設定面板，拖動邊距滑桿，截圖確認文字邊距變化
  - 調整邊距後離開閱讀器再重新進入，驗證邊距設定保留

## 3. 進度計算改用位元組加權

- [x] 3.1 在 EpubReader.tsx 中 import `SectionProgress` from `progress.js`
- [x] 3.2 book 載入後建立 `sectionProgressRef = new SectionProgress(book.sections, 1500, 1600)`
- [x] 3.3 handleRelocate 中改用 `sectionProgress.getProgress(index, fraction, size)` 取得加權 `fraction`
- [x] 3.4 onProgressChange callback 改為傳遞加權後的 fraction
- [x] 3.5 ReaderPage.tsx 進度顯示直接使用加權 fraction 計算百分比
- [x] 3.6 E2E 測試：更新 `05-reader-progress.spec.ts`
  - 翻過前言/目錄等短 section 後，驗證進度百分比 < 5%（而非之前的 > 15%）
  - 直排翻 20 頁，記錄百分比，切換橫排，驗證百分比差異 ≤ 2%
  - 翻 30 頁後百分比遞增，後端存檔的 percentage 與 UI 顯示一致（±3%）

## 4. 使用者設定（PROFILE）

- [x] 4.1 api.service.ts 新增 `updateUser(id: string, name: string, avatarColor: string)` → `PUT /api/users/:id`
- [x] 4.2 BookLibrary.tsx 底部新增固定的 PROFILE 按鈕
- [x] 4.3 建立 UserProfileDrawer 元件（Bottom Drawer），包含：
  - 名稱 TextField（不可為空驗證）
  - 頭像顏色選擇（6~8 個預設顏色圓圈，點選高亮）
  - 儲存按鈕
- [x] 4.4 儲存後更新 userStore 中的 currentUser，書庫 AppBar 顯示新名稱
- [x] 4.5 E2E 測試：新建 `09-user-profile.spec.ts`
  - 書庫頁面可見 PROFILE 按鈕
  - 點擊 PROFILE 展開設定面板
  - 修改名稱並儲存，書庫頁面顯示新名稱
  - 選擇頭像顏色並儲存，重新進入使用者選擇頁面確認顏色已更新
  - 名稱為空時無法儲存

## 5. 整合測試與清理

- [x] 5.1 跑完所有 E2E 測試（01~09），確認無回歸
- [x] 5.2 移除除錯用 console.log
- [x] 5.3 TypeScript 型別檢查通過（`tsc -b --noEmit`）
