## ADDED Requirements

### Requirement: PDF 逐頁顯示
系統 SHALL 以逐頁方式顯示 PDF，支援翻頁操作。

#### Scenario: 開啟 PDF
- **WHEN** 使用者開啟 PDF 書籍
- **THEN** 系統顯示第一頁，支援觸控/鍵盤翻頁

#### Scenario: PDF 進度儲存
- **WHEN** 使用者翻頁後關閉
- **THEN** 下次開啟從同一頁繼續
