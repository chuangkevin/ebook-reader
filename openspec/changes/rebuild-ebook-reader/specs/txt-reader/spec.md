## ADDED Requirements

### Requirement: TXT 分頁顯示
系統 SHALL 以分頁方式顯示 TXT 文件，支援直排與橫排。

#### Scenario: 開啟 TXT（直排）
- **WHEN** 使用者在直排模式開啟 TXT 書籍
- **THEN** 文字以 vertical-rl 排列，支援翻頁

#### Scenario: TXT 進度儲存
- **WHEN** 使用者翻頁後關閉
- **THEN** 下次開啟從同一位置繼續
