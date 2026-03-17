## ADDED Requirements

### Requirement: 自動儲存進度
系統 SHALL 在每次翻頁後自動儲存目前閱讀位置，精確到頁內捲動位置。

#### Scenario: 翻頁後儲存
- **WHEN** 使用者翻到新的一頁
- **THEN** 系統在 1 秒內將目前位置（章節索引 + scroll fraction）儲存到後端

### Requirement: 進度恢復
系統 SHALL 在開書時自動恢復到上次離開的位置。

#### Scenario: 繼續閱讀
- **WHEN** 使用者開啟有進度的書籍
- **THEN** 閱讀器自動跳到上次儲存的章節，並恢復到相同的頁內位置

#### Scenario: 第一次開書
- **WHEN** 使用者第一次開啟書籍（無進度）
- **THEN** 閱讀器從第一章第一頁開始

### Requirement: 進度顯示
系統 SHALL 在閱讀器底部顯示目前進度百分比。

#### Scenario: 顯示百分比
- **WHEN** 使用者正在閱讀
- **THEN** 底部常駐顯示目前頁數 / 總頁數與百分比，數值與實際位置一致（不顯示 100%）

### Requirement: 跨裝置同步
系統 SHALL 讓同一使用者在不同裝置上讀到同一本書時，從最新儲存的位置繼續。

#### Scenario: 裝置切換
- **WHEN** 使用者在裝置 A 閱讀後，在裝置 B 開啟同一本書
- **THEN** 裝置 B 從裝置 A 最後儲存的位置開始
