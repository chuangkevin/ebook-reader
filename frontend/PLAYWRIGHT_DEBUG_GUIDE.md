# ebook-reader Playwright E2E 測試與調試計畫

## 目標

建立完整的測試基礎設施，系統地診斷和修復「翻頁跳章」問題。

### 核心問題陳述
- **症狀**：在橫排和直排模式下，翻頁時經常跳整個章節而不是逐頁翻
- **影響**：兩種排版方式都受影響，導致閱讀體驗極差
- **已知根本原因**（待驗證）：
  1. Flex 容器壓縮：`scrollWidth === offsetWidth` → `maxScroll = 0`
  2. RTL 方向不匹配：epub.js 的 `scrollBy()` 反向滾動
  3. 可能的共同根本原因暗示直排也有類似的尺寸計算問題

---

## 測試框架結構

### 目錄布局
```
frontend/
├── tests/
│   ├── e2e/
│   │   ├── horizontal-pagination.spec.ts    # 橫排翻頁測試
│   │   ├── vertical-pagination.spec.ts      # 直排翻頁測試
│   │   └── cross-mode-consistency.spec.ts   (未創建)
│   ├── helpers/
│   │   └── ReaderTestHelper.ts              # 測試工具函數
│   ├── fixtures/
│   │   └── test.ts                          # Playwright fixtures
│   ├── fixtures/
│   │   └── sample-books/                    (未創建)
│   └── screenshots/
│       └── (調試截圖輸出目錄)
├── playwright.config.ts                      # Playwright 配置
└── test-results/                             # 測試報告輸出
```

### 測試工具函數

**ReaderTestHelper** 提供以下核心功能：

1. **诊断函数** - 检测已知问题
   - `getDebugInfo()` - 获取实时调试信息
   - `detectFlexCompression()` - 检测 flex-shrink 问题
   - `detectRTLIssue()` - 检测 RTL 方向问题
   - `exportDiagnosticReport()` - 导出完整诊断报告

2. **验证函数** - 测试预期行为
   - `validateHorizontalScrollState()` - 验证水平滚动
   - `validateVerticalScrollState()` - 验证垂直滚动
   - `turnPageAndValidate()` - 执行翻页并验证

3. **测试函数** - 发现问题
   - `detectPerpetualChapterJump()` - 检测「每翻必跳」问题
   - `sequentialPageTurns()` - 连续翻页测试

---

## Playwright 測試運行指南

### 安裝依賴

```bash
cd frontend
npm install -D @playwright/test@latest
```

### 運行測試

```bash
# 運行所有測試
npm run test:e2e

# 運行特定測試文件
npm run test:e2e -- horizontal-pagination.spec.ts
npm run test:e2e -- vertical-pagination.spec.ts

# 運行特定的測試
npm run test:e2e -- --grep "Single page turn should scroll"

# 運行特定的瀏覽器
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project="Mobile Chrome"

# 開啟 Playwright Inspector
npm run test:e2e -- --debug

# 生成 HTML 報告
npm run test:e2e
npm run test:report
```

### Package.json 腳本配置

在 `frontend/package.json` 中加入：

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:watch": "playwright test --watch",
    "test:e2e:debug": "playwright test --debug",
    "test:report": "playwright show-report test-results/html"
  }
}
```

---

## 調試計畫 (Debug Plan)

### Phase 1: 根本原因驗證

**目標**：确认两个已知根本原因是否真的存在和有效

**要运行的测试**：
```bash
npm run test:e2e -- --grep "Diagnostic"
```

**检查清单**：

- [ ] **橫排模式 - Flex 壓縮**
  - 運行：`[Diagnostic] Detect flex-shrink compression on page load`
  - 預期結果：
    - ✓ 如果沒有 minWidth 設置：isCompressed = true，scrollWidth === offsetWidth
    - ✗ 如果修復成功：isCompressed = false
  - 診斷信息會在控制台和 `test-results/screenshots/` 中的截圖顯示

- [ ] **橫排模式 - RTL 方向**
  - 運行：`[Diagnostic] Detect RTL direction mismatch`
  - 預期結果：
    - ✓ 如果未修復：hasRTLMismatch = true，direction = 'rtl'
    - ✗ 如果修復成功：hasRTLMismatch = false，direction = 'ltr'

- [ ] **直排模式 - 尺寸異常**
  - 運行：`[Diagnostic] Verify vertical container dimensions`
  - 預期結果：
    - 检查 scrollHeight 和 offsetHeight 是否相等
    - 如果相等，可能表示存在类似横排的尺寸压缩问题

### Phase 2: 行為驗證

**目標**：确认当前尚未修复的情况下会产生什么行为

**要运行的测试**：
```bash
npm run test:e2e -- --grep "Behavior"
```

**檢查清單**：

- [ ] **單次翻頁行為**
  - 運行：`[Behavior] Single page turn should scroll within chapter`
  - 預期結果（BUG存在）：jumped = true，表示翻章
  - 預期結果（已修復）：jumped = false，正常滾動

- [ ] **連續翻頁行為**
  - 運行：`[Behavior] Sequential page turns should not always jump`
  - 預期結果（BUG存在）：allJumped = true，所有翻頁都跳章
  - 預期結果（已修復）：allJumped = false，大多數翻頁正常

### Phase 3: 修復驗證

**目標**：應用修復後，驗證修復是否有效

**修復方案**（來自提交 07d5915）：

1. **Flex-shrink 修復**
   ```typescript
   if (element) {
     element.style.width = newW + 'px';
     element.style.minWidth = newW + 'px';  // ← 新增
   }
   ```

2. **RTL 方向修復**
   ```typescript
   if (container && settings.writingMode !== 'vertical') {
     container.style.direction = 'ltr';
     const mgr = renditionRef.current?.manager;
     if (mgr) mgr.settings.direction = 'ltr';  // ← 新增
   }
   ```

3. **簡化横排翻頁邏輯**
   ```typescript
   } else {  // 横排模式
     r.next();  // 直接使用 epub.js 內建翻頁
   }
   ```

**应用修复后运行**：
```bash
npm run test:e2e -- --grep "Verification"
```

**檢查清單**：

- [ ] `[Verification] Confirm minWidth prevents flex compression`
  - 預期結果：isCompressed = false

- [ ] `[Verification] Confirm direction is set to ltr`
  - 預期結果：hasRTLMismatch = false

---

## 診斷信息解讀指南

調試疊層（Debug Overlay）顯示的關鍵信息：

### 橫排模式診斷

```json
{
  "scrollLeft": 0,           // 當前水平滾動位置
  "maxScroll": 0,            // ⚠️ 如果為 0，表示 flex 被壓縮
  "scrollW": 1024,           // 容器內容總寬度
  "offsetW": 1024,           // 容器實際寬度（如果等於 scrollW，有問題）
  "delta": 1024,             // 翻頁步距（應等於列寬）
  "dir": "rtl",              // ⚠️ 如果為 rtl，會導致向後滾動
  "isPag": true,             // 是否為分頁模式
  "axis": "horizontal",      // 排版軸
  "childW": 1024,            // 子元素寬度
  "flexShrink": "default",   // ⚠️ 應檢查是否被壓縮
  "willJump": true           // ⚠️ true = 下次翻頁會跳章
}
```

**診斷決策樹**：

```
maxScroll === 0?
  ├─ YES → Flex 被壓縮 (Root Cause #1)
  │   └─ 修復：設定 element.style.minWidth
  │
  └─ NO  → 檢查 direction
      └─ direction === 'rtl'?
          ├─ YES → RTL 方向問題 (Root Cause #2)
          │   └─ 修復：設定 mgr.settings.direction = 'ltr'
          │
          └─ NO  → 可能другой原因，需要進一步調查
              └─ 檢查 willJump 的邏輯
                  └─ 滾動邏輯 or epub.js 內部問題?
```

---

## 持續整合 (CI/CD) 集成

### GitHub Actions 工作流配置

在 `.github/workflows/playwright.yml` 中：

```yaml
name: Playwright Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci
        working-directory: ./frontend

      - name: Install Playwright browsers
        run: npx playwright install --with-deps
        working-directory: ./frontend

      - name: Run Playwright tests
        run: npm run test:e2e
        working-directory: ./frontend

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/test-results/html/
          retention-days: 30

      - name: Comment PR with results
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            // 添加測試結果評論到 PR
```

### 每日自動化測試

建議在 CI 管道中添加：

1. **每次 commit**：運行關鍵的診斷和行為測試
2. **每天一次**：運行完整的 E2E 測試套件
3. **PR 檢查**：翻頁相關改動必須通過所有測試

---

## 開發工作流 (Development Workflow)

### 修復新bug時的強制步驟

1. **診斷階段**
   ```bash
   npm run test:e2e -- --grep "Diagnostic"
   ```
   - 確認問題的根本原因
   - 收集診斷信息
   - 可視化問題狀態

2. **應用修復**
   - 編輯 `BookReader.tsx`
   - 應用針對性修復

3. **驗證修復**
   ```bash
   npm run test:e2e -- --grep "Verification"
   ```
   - 確認修復無效果

4. **行為測試**
   ```bash
   npm run test:e2e -- --grep "Behavior"
   ```
   - 驗證修復解決了實際問題

5. **邊界情況測試**
   ```bash
   npm run test:e2e -- --grep "Edge"
   ```
   - 確保修復不引入新bug

6. **完整測試**
   ```bash
   npm run test:e2e
   npm run test:report
   ```
   - 確保所有測試通過
   - 檢查報告中是否有退化

### 提交 PR 檢查清單

- [ ] 所有 Playwright 測試通過
- [ ] 新增功能或修復包含相應的測試
- [ ] 沒有遺留的 `.only()` 或 `.skip()`
- [ ] 截圖和報告已審查
- [ ] 診斷信息確認根本原因已解決

---

## 案例研究：修復歷史

### 提交 07d5915 的分析

**應用的修復**：
1. ✅ 設定 `element.style.minWidth`
2. ✅ 設定 `mgr.settings.direction = 'ltr'`
3. ✅ 簡化橫排翻頁邏輯使用 `r.next()`

**可能的失敗原因**（提交 532e211 回退）：
- [ ] `r.next()` 在某些 EPUB 格式中表現不如預期
- [ ] 修復引入了其他副作用（性能、視覺bug等）
- [ ] 沒有充分的測試驗證修復有效性

**使用新測試框架可以避免的問題**：
- ✅ 自動化驗證根本原因確實被修復
- ✅ 檢測修復可能引入的退化
- ✅ 在 CI 中防止未測試的修復被提交

---

## 測試覆蓋範圍

| 功能 | 測試類型 | 文件 | 狀態 |
|------|---------|------|------|
| 橫排翻頁 | Diagnostic, Behavior, Verification | horizontal-pagination.spec.ts | ✅ |
| 直排翻頁 | Diagnostic, Behavior, Verification | vertical-pagination.spec.ts | ✅ |
| 跨模式一致性 | Integration | cross-mode-consistency.spec.ts | ⏳ 待創建 |
| 觸控翻頁 | E2E | touch-pagination.spec.ts | ⏳ 待創建 |
| 鍵盤翻頁 | E2E | keyboard-navigation.spec.ts | ⏳ 待創建 |
| 性能回歸 | Performance | performance.spec.ts | ⏳ 待創建 |

---

## 故障排除

### 問題：測試超時

```
Error: Timeout 5000ms exceeded while waiting for element
```

**解決方案**：
1. 確保開發伺服器正在運行：`npm run dev`
2. 檢查 EPUB 测试数据是否已加载
3. 增加 `waitForElement` 的超時時間

### 問題：調試信息未出現

```
Error: Debug overlay not found
```

**解決方案**：
1. 確認 Debug Overlay 代碼在 `BookReader.tsx` 中（第 443-472 行）
2. 在瀏覽器控制台檢查是否有錯誤
3. 驗證 goNext() 確實被調用

### 問題：Playwright 找不到元素

**解決方案**：
1. 使用 `--debug` 模式逐步執行測試
2. 在 Playwright Inspector 中檢查選擇器
3. 更新 `ReaderTestHelper` 中的選擇器以匹配您的 HTML 結構

---

## 最佳實踐

1. **測試隔離** - 每個測試應獨立，不依賴其他測試的狀態
2. **明確的斷言** - 使用清晰的錯誤消息
3. **適當的等待** - 使用 `waitForLoadState`、`waitForNavigation` 等，避免 sleep
4. **截圖和視頻** - 失敗時自動保存以供分析
5. **速度優化** - 使用 `reuseExistingServer` 避免重複啟動
6. **定期維護** - 隨著 UI 變化更新選擇器

---

## 下一步

1. **運行初始診斷**
   ```bash
   npm run test:e2e -- --grep "Diagnostic" --project=chromium
   ```

2. **查看測試報告**
   ```bash
   npm run test:report
   ```

3. **應用修復並驗證**
   - 應用來自 commit 07d5915 的修復
   - 運行驗證測試
   - 檢查是否有未預期的失敗

4. **針對失敗情況的根本原因分析**
   - 如果修復不起作用，使用 `--debug` 和螢幕截圖進行調查
   - 檢查診斷信息以尋找新的根本原因

---

## 參考資料

- 📼 視頻參考：`reference/795208475.684539.mp4`
- 💬 GitHub Issue #12：橫排翻頁跳章問題
- 💬 GitHub Issue #1：翻頁問題（已關閉）
- 📝 提交 07d5915：fix: 修正橫排翻頁跳章的兩個根本原因
- 📝 提交 532e211：Revert "fix: 修正橫排翻頁跳章的兩個根本原因"
- 📝 提交 d9dd4c5：debug: 橫排翻頁跳章 — 螢幕顯示診斷資訊

---

**版本**：1.0
**最後更新**：2026-03-15
**維護者**：@chuangkevin
