## ADDED Requirements

### Requirement: 邊距調整
閱讀設定面板 SHALL 提供邊距調整滑桿，範圍 2%~15%，預設 6%。調整後即時套用至 paginator。

#### Scenario: 調整邊距即時生效
- **WHEN** 使用者拖動邊距滑桿
- **THEN** paginator 的 gap 屬性即時更新，文字與螢幕邊緣的距離隨之改變

#### Scenario: 邊距設定持久化
- **WHEN** 使用者調整邊距後離開閱讀器再重新進入
- **THEN** 邊距維持上次設定的值

#### Scenario: 邊距設定跨裝置獨立
- **WHEN** 使用者在 A 裝置調整邊距
- **THEN** B 裝置同帳號登入後使用相同邊距值（經由後端設定同步）
