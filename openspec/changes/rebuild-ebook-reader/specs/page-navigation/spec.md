## ADDED Requirements

### Requirement: 觸控翻頁
閱讀器 SHALL 支援點擊螢幕左右區域翻頁（橫排）或上下區域翻頁（直排）。

#### Scenario: 點擊右側下一頁（橫排）
- **WHEN** 使用者點擊螢幕右側 30% 區域（橫排模式）
- **THEN** 前進一頁

#### Scenario: 點擊左側上一頁（橫排）
- **WHEN** 使用者點擊螢幕左側 30% 區域（橫排模式）
- **THEN** 後退一頁

### Requirement: 滑動手勢翻頁
閱讀器 SHALL 支援左右滑動（橫排）或上下滑動（直排）手勢翻頁。

#### Scenario: 左滑下一頁（橫排）
- **WHEN** 使用者在橫排模式向左滑動
- **THEN** 前進一頁

### Requirement: 鍵盤翻頁
閱讀器 SHALL 支援鍵盤方向鍵、PageUp/PageDown、Space 翻頁。

#### Scenario: 方向鍵翻頁
- **WHEN** 使用者按下 ArrowRight 或 ArrowDown
- **THEN** 前進一頁

#### Scenario: Space 翻頁
- **WHEN** 使用者按下 Space
- **THEN** 前進一頁

### Requirement: Boox 實體按鈕
閱讀器 SHALL 支援 Boox Go Color 7 的實體翻頁鍵。

#### Scenario: 實體鍵翻頁
- **WHEN** 使用者按下 Boox 實體翻頁鍵（對應 PageDown/PageUp 鍵盤事件）
- **THEN** 前進或後退一頁

### Requirement: 防誤觸文字選取
閱讀器 SHALL 在翻頁點擊區域停用文字選取，避免觸控誤觸進入選取模式。

#### Scenario: 點擊不觸發選取
- **WHEN** 使用者點擊翻頁區域
- **THEN** 系統翻頁，不出現文字選取游標或選取框
