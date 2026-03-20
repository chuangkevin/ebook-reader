## ADDED Requirements

### Requirement: API 錯誤 Toast 通知
前端 SHALL 在 API 呼叫失敗時顯示 Snackbar Toast 通知使用者，而非靜默吞掉錯誤。

#### Scenario: 書籍上傳失敗
- **WHEN** 書籍上傳 API 回傳錯誤
- **THEN** 顯示 Snackbar 錯誤訊息「上傳失敗」

#### Scenario: 設定儲存失敗
- **WHEN** 設定更新 API 回傳錯誤
- **THEN** 顯示 Snackbar 錯誤訊息「設定儲存失敗」

#### Scenario: 書籤操作失敗
- **WHEN** 書籤新增/刪除 API 回傳錯誤
- **THEN** 顯示 Snackbar 錯誤訊息

### Requirement: 進度儲存失敗特殊處理
進度儲存失敗 SHALL 不阻斷閱讀體驗，但 MUST 顯示一次性底部警告。

#### Scenario: 進度儲存網路錯誤
- **WHEN** 進度 API 呼叫失敗（網路斷線或 server 錯誤）
- **THEN** 底部顯示一次性警告「進度未儲存」，不影響翻頁操作
- **AND** 同一次閱讀 session 中不重複顯示相同警告

### Requirement: useToast 全域 store
前端 SHALL 建立 `useToast` zustand store 統一管理 toast 訊息佇列。

#### Scenario: Toast 顯示
- **WHEN** 任何元件呼叫 `useToast.getState().show(message, severity)`
- **THEN** 在畫面底部中央顯示 Snackbar，severity 支援 'success' | 'error' | 'warning' | 'info'

#### Scenario: Toast 自動消失
- **WHEN** Toast 顯示後
- **THEN** 3 秒後自動消失（success/info），5 秒後自動消失（error/warning）

### Requirement: React Error Boundary
App.tsx SHALL 包裹 React Error Boundary，防止未捕獲的 render 錯誤造成白屏。

#### Scenario: 元件 render 錯誤
- **WHEN** 任何子元件在 render 時拋出未捕獲的 Error
- **THEN** 顯示「出了點問題」頁面，包含「重新載入」按鈕

#### Scenario: Error Boundary 不影響正常操作
- **WHEN** 沒有 render 錯誤發生
- **THEN** Error Boundary 透明通過，不影響任何功能
