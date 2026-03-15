# Playwright E2E 測試 - 快速開始指南

## 安裝和初始化

### 1. 安裝 Playwright

```bash
cd frontend
npm install -D @playwright/test@latest
```

### 2. 驗證安裝

```bash
# 檢查 Playwright 是否正確安裝
npm run test:e2e -- --version

# 輸出應該類似：
# Version 1.40.0 (or later)
```

## 運行測試

### 基本命令

```bash
# 運行所有測試
npm run test:e2e

# 運行特定文件的測試
npm run test:e2e horizontal-pagination.spec.ts
npm run test:e2e vertical-pagination.spec.ts

# 運行只符合特定記分的測試
npm run test:e2e -- --grep "Diagnostic"
npm run test:e2e -- --grep "Behavior"

# 在調試模式運行
npm run test:e2e -- --debug

# 觀看模式（監視更改，自動重新運行）
npm run test:e2e -- --watch
```

## 檢查測試結果

### HTML 報告

```bash
# 生成 HTML 報告
npm run test:e2e

# 查看報告
npm run test:report
```

報告位置：`frontend/test-results/html/index.html`

### 故障排查

- **視頻**：`test-results/` 目錄中的失敗測試視頻
- **截圖**：`test-results/screenshots/` 中的診斷截圖
- **日誌**：控制台輸出（運行時顯示）

## 典型工作流

### 場景 1：診斷翻頁問題

```bash
# 1. 運行診斷測試
npm run test:e2e -- --grep "Diagnostic"

# 2. 檢查控制台輸出的診斷信息

# 3. 查看 test-results/screenshots/ 中的截圖

# 4. 分析根本原因
```

### 場景 2：驗證修復是否有效

```bash
# 1. 應用修復到代碼
# (編輯 BookReader.tsx)

# 2. 運行驗證測試
npm run test:e2e -- --grep "Verification"

# 3. 運行行為測試
npm run test:e2e -- --grep "Behavior"

# 4. 如果都通過，運行完整測試
npm run test:e2e
```

### 場景 3：調試特定測試失敗

```bash
# 使用調試模式
npm run test:e2e -- --grep "Single page turn" --debug

# Playwright Inspector 會打開
# - 使用"Step over" 按鈕逐步執行
# - 檢查頁面狀態
# - 驗證選擇器
```

## 理解測試輸出

### 成功的測試

```
✓ [Diagnostic] Detect flex-shrink compression on page load (1.2s)
```

### 失敗的測試

```
✗ [Behavior] Single page turn should scroll within chapter
  Error: expect(received).toBe(expected)
  Expected: false
  Received: true
```

### 關鍵診斷信息

在控制台中查找這些標識符：

- ✓ 表示通過
- ✗ 表示失敗
- ⚠️  表示警告（可能的問題）
- ❌ 表示臨界失敗

## 常見問題

### Q: 測試無法連接到本地開發伺服器

**A:**
```bash
# 確保開發伺服器正在運行
npm run dev  # 在另一個終端中

# 然後運行測試
npm run test:e2e
```

### Q: 測試因"找不到元素"而失敗

**A:**
1. 檢查 HTML 選擇器是否與 BookReader.tsx 匹配
2. 運行 `--debug` 模式來檢查頁面結構
3. 更新 `ReaderTestHelper` 中的選擇器

### Q: 調試信息疊層未出現

**A:**
1. 確認 `goNext()` 函數中的調試代碼正在運行（第 443-472 行）
2. 檢查瀏覽器控制台是否有錯誤
3. 使用 `--debug` 模式逐步執行

### Q: 性能：測試運行緩慢

**A:**
```bash
# 限制為單個工作進程（更可靠但更慢）
npm run test:e2e -- --workers=1

# 只運行關鍵測試
npm run test:e2e -- --grep "Diagnostic|Verification"
```

## 與 IDE 整合

### Visual Studio Code

安裝擴展：
1. "Playwright Test for VS Code" (作者：Microsoft)
2. 按 `Ctrl+Shift+X` 搜索 "Playwright"
3. 點擊 "Install"

### IntelliJ / WebStorm

1. 內置支持
2. 右鍵單擊測試 → "Run" 或 "Debug"

## 與 Git 工作流整合

### 提交前檢查

```bash
# 在提交之前運行測試
npm run test:e2e

# 如果測試失敗，修復問題再提交
```

### Git Hook（可選）

在 `.husky/pre-commit` 中添加：

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 運行 E2E 測試（僅限關鍵測試以節省時間）
cd frontend
npm run test:e2e -- --grep "Diagnostic|Verification"
```

## 持續學習

1. **查看示例診斷輸出**
   - 查看 `test-results/screenshots/`
   - 分析診斷信息格式

2. **實驗 --debug 模式**
   - 打開 Playwright Inspector
   - 了解每個步驟

3. **添加自己的測試**
   - 複製現有測試
   - 修改以測試新場景

## 下一步

1. **運行初始診斷**
   ```bash
   npm run test:e2e -- --grep "Diagnostic" --project=chromium
   ```

2. **查看報告**
   ```bash
   npm run test:report
   ```

3. **根據診斷應用修復**

4. **運行驗證測試確認修復**

---

需要幫助？查看 `PLAYWRIGHT_DEBUG_GUIDE.md` 以獲取完整文檔。
