## ADDED Requirements

### Requirement: 直排模式（vertical-rl）
閱讀器 SHALL 支援傳統中文直排閱讀，文字由上至下、欄位由右至左排列，每次翻頁移動一個螢幕高度。

#### Scenario: 直排顯示
- **WHEN** 使用者設定排版為「直排」
- **THEN** 文字以 vertical-rl 方向排列，第一欄在螢幕右側

#### Scenario: 直排翻頁
- **WHEN** 使用者在直排模式按下一頁
- **THEN** 畫面向下捲動一個螢幕高度，顯示下一頁內容

### Requirement: 橫排模式（horizontal-tb）
閱讀器 SHALL 支援標準橫排閱讀，文字由左至右、由上至下排列，每次翻頁移動一個螢幕寬度。

#### Scenario: 橫排顯示
- **WHEN** 使用者設定排版為「橫排」
- **THEN** 文字以 horizontal-tb 方向排列，第一頁在螢幕左側

#### Scenario: 橫排翻頁
- **WHEN** 使用者在橫排模式按下一頁
- **THEN** 畫面向右捲動一個螢幕寬度，顯示下一頁內容

### Requirement: 章節邊界翻頁
閱讀器 SHALL 在章節末尾自動切換到下一章，在章節開頭向後翻時切換到上一章。

#### Scenario: 到達章節末尾
- **WHEN** 使用者在章節最後一頁繼續往前翻
- **THEN** 閱讀器載入下一章，從第一頁開始

#### Scenario: 在章節開頭往後翻
- **WHEN** 使用者在章節第一頁往後翻
- **THEN** 閱讀器載入上一章，從最後一頁開始

### Requirement: iOS WebKit 相容
閱讀器 SHALL 在 iPhone iOS Safari 上正確顯示直排與橫排，無翻頁異常或版面跑版。

#### Scenario: iOS 直排正常翻頁
- **WHEN** 使用者在 iPhone 上使用直排模式翻頁
- **THEN** 每次翻頁精確移動一個螢幕高度，不發生跳章或黑屏

#### Scenario: iOS 首次開書
- **WHEN** 使用者在 iPhone 上開啟書籍
- **THEN** 閱讀器正確顯示第一頁，進度條顯示正確百分比（非 100%）

### Requirement: 目錄（TOC）
閱讀器 SHALL 提供章節目錄，點選章節直接跳轉。

#### Scenario: 開啟目錄
- **WHEN** 使用者點選目錄按鈕
- **THEN** 顯示章節列表，包含章節名稱

#### Scenario: 跳章
- **WHEN** 使用者點選目錄中某章節
- **THEN** 閱讀器跳轉到該章節第一頁
