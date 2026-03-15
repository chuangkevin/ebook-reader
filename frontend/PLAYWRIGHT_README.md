# 🎭 Playwright E2E 測試框架 - 當前狀態 & 下一步

## 📋 已完成

✅ **完整的 Playwright E2E 測試框架**
- 配置、測試用例、診斷工具、4 份完整文檔
- 支持 5 個瀏覽器環境 + 行動設備測試
- 11 個診斷/驗證方法集中在 `ReaderTestHelper.ts`

✅ **npm 依賴**
- `@playwright/test@^1.58.2` 已添加到 devDependencies
- `npm install` 已完成

✅ **測試腳本集成**
- `npm run test:e2e`
- `npm run test:e2e:debug`
- `npm run test:e2e:watch`
- `npm run test:report`

## 🔧 剩餘工作

### 第 1 步: 完成 Playwright 瀏覽器安裝

```bash
cd frontend
npx playwright install chromium
```

這會下載測試所需的瀏覽器（~400MB）

### 第 2 步: 調整測試以匹配實際代碼

**當前問題**：測試假設了某些 DOM 選擇器，但實際代碼可能不同

**需要做的**：

1. 檢查 BookReader.tsx 中實際的容器選擇器
   - 當前: 測試用 `[data-epub-container]`
   - 實際: 需要通過 `renditionRef.current?.manager?.container` 訪問

2. 為測試添加暴露 DOM 選擇器的方式，或使用 `page.evaluate()` 訪問 React ref

3. 確保應用程式能夠加載 EPUB 書籍用於測試

### 第 3 步: 建立測試資料（EPUB 書籍）

選項 A：在應用程式中建立測試路由來加載示例 EPUB
選項 B：使用現有的任何示例書籍
選項 C：模擬 EPUB 加載狀態

## 🚀 立即可做的事

### 在等待時，您可以：

1. **理解測試框架**
   - 閱讀 `PLAYWRIGHT_DEBUG_GUIDE.md`
   - 查看測試用例邏輯

2. **準備修復程式碼**
   - 確認 commit 07d5915 中的 3 個修復
   - 準備應用到 BookReader.tsx

3. **審查 ReaderTestHelper**
   - 理解 11 個diagnostic 方法如何工作
   - 考慮是否需要其他測試方法

## 📝 快速參考

### 測試根本原因診斷

**橫排模式問題檢測**:
```typescript
// 檢測 #1: Flex 壓縮
const compression = await readerHelper.detectFlexCompression();
if (compression.isCompressed) {
  // maxScroll === 0，需要應用 minWidth 修復
}

// 檢測 #2: RTL 方向
const rtlIssue = await readerHelper.detectRTLIssue();
if (rtlIssue.hasRTLMismatch) {
  // direction === 'rtl'，需要應用 direction = 'ltr' 修復
}
```

**直排模式問題檢測**:
```typescript
// 類似的尺寸檢查
const dims = await readerHelper.getContainerDimensions();
if (dims.containerScrollHeight === dims.containerOffsetHeight) {
  // 類似 flex 壓縮的問題
}
```

## 🎯 完整的工作流程

```
1. npx playwright install chromium        (下載瀏覽器)
   ↓
2. npm run test:e2e:debug                 (開啟 Playwright Inspector)
   ↓
3. 觀察實際 DOM 結構，調整選擇器
   ↓
4. npm run test:e2e -- --grep "Diagnostic" (診斷根本原因)
   ↓
5. 查看 test-results/html-report/ 中的詳細報告
   ↓
6. 編輯 BookReader.tsx 應用 3 個修復
   ├─ Fix #1: element.style.minWidth
   ├─ Fix #2: mgr.settings.direction = 'ltr'
   └─ Fix #3: 簡化横排邏輯為 r.next()
   ↓
7. npm run test:e2e -- --grep "Verification" (驗證修復)
   ↓
8. npm run test:e2e                        (運行完整測試)
   ↓
9. npm run test:report                     (查看最終報告)
```

## 📚 重要文檔

| 文檔 | 內容 |
|------|------|
| `PLAYWRIGHT_QUICK_START.md` | 快速開始 |
| `PLAYWRIGHT_DEBUG_GUIDE.md` | 完整調試指南 ⭐ |
| `PLAYWRIGHT_DEPLOYMENT_CHECKLIST.md` | 部署清單 |
| `PLAYWRIGHT_TEST_STATUS.md` | 當前狀態 |

## 🔍 測試用例結構

### 橫排翻頁測試 (`horizontal-pagination.spec.ts`)

```
✓ [Diagnostic] Detect flex-shrink compression
✓ [Diagnostic] Detect RTL direction mismatch
✓ [Behavior] Single page turn
✓ [Behavior] Sequential page turns
✓ [Debug] Export diagnostic report
✓ [Verification] Confirm minWidth fix
✓ [Verification] Confirm direction fix
✓ [Performance] Measure responsiveness
+ Edge cases for chapter boundaries
```

### 直排翻頁測試 (`vertical-pagination.spec.ts`)

```
✓ [Diagnostic] Verify container dimensions
✓ [Diagnostic] Verify delta calculation
✓ [Behavior] Single page turn
✓ [Behavior] Sequential page turns
✓ [Debug] Scroll state throughout turn
✓ [Verification] Check layout.delta
+ Edge cases for vertical mode
```

## 💡 重大決定點

### 決定 1: 測試選擇器策略

**[A] 方案 A** (推薦)：修改代碼暴露測試選擇器
```typescript
// 在 BookReader.tsx 加入 data 屬性
<div data-epub-container={mgr.container.id}>
```
優點：更容易測試
缺點：為測試修改產品代碼

**方案 B**：使用 page.evaluate() 訪問 React ref
```typescript
const container = await page.evaluate(() => {
  return window.__debugInfo?.epubContainer; // 暴露給全局
});
```
優點：不修改產品代碼
缺點：需要更多 JavaScript 邏輯

### 決定 2: EPUB 測試資料

**方案 A**：建立實際的 EPUB 上傳/加載
- 使用真實數據測試

**方案 B**：模擬 EPUB 加載狀態
- 模擬 rendition 和 manager 對象
- 快速測試邏輯

## 🚨 已知限制

1. **沒有示例 EPUB 書籍**
   - 測試無法加載實際書籍
   - 需要提供測試資料或模擬加載

2. **React ref 訪問**
   - `renditionRef` 在測試中可能無法直接訪問
   - 需要透過頁面全局暴露

3. **瀏覽器下載**
   - 首次運行需要 ~400MB 下載
   - 根據網絡速度可能需要 5-15 分鐘

## ✅ 檢查清單

在運行測試前，請確認：

- [ ] `npm install` 已完成
- [ ] `npx playwright install chromium` 已完成
- [ ] 應用程式可以在 `http://localhost:5173` 啟動
- [ ] 開發伺服器在端口 5173 上運行
- [ ] 有方法在應用程式中加載 EPUB 書籍

## 📞 快速幫助

**Q: 瀏覽器下載時間太長**
A: 可以只安裝 chromium：`npx playwright install chromium`

**Q: 選擇器找不到元素**
A: 運行 `npm run test:e2e:debug` 並在 Inspector 中查看實際的 DOM

**Q: 如何查看測試視頻**
A: 失敗時在 `test-results/` 中查找 .webm 文件

**Q: 如何在特定瀏覽器上測試**
A: `npm run test:e2e -- --project=firefox`

---

**下一步**:
1. 運行 `npx playwright install chromium`
2. 調整測試選擇器以匹配實際代碼
3. 運行診斷測試

**文檔位置**: `frontend/PLAYWRIGHT_*.md`
