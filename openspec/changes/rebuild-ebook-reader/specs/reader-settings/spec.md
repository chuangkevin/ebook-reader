## ADDED Requirements

### Requirement: 排版切換
系統 SHALL 允許使用者在直排與橫排之間即時切換，不需重新載入整本書。

#### Scenario: 切換排版
- **WHEN** 使用者在設定中切換排版模式
- **THEN** 閱讀器立即以新排版重新顯示當前章節，保持近似閱讀位置

### Requirement: 字體大小調整
系統 SHALL 允許使用者調整字體大小，即時套用。

#### Scenario: 調大字體
- **WHEN** 使用者增加字體大小
- **THEN** 書頁文字立即以新字體大小顯示

### Requirement: 主題切換
系統 SHALL 提供亮色、護眼（暖黃）、暗色三種主題。

#### Scenario: 切換主題
- **WHEN** 使用者選擇不同主題
- **THEN** 閱讀器背景色與文字色立即切換，包含 iframe 內的書頁樣式

### Requirement: 翻頁區域配置
系統 SHALL 允許設定觸控翻頁的區域分配（預設/左手/右手）。

#### Scenario: 左手模式
- **WHEN** 使用者設定為左手模式
- **THEN** 點擊螢幕左側為下一頁，右側為上一頁（反轉預設）

### Requirement: 設定持久化
系統 SHALL 將閱讀設定儲存到後端，在不同裝置上保持一致。

#### Scenario: 設定跨裝置同步
- **WHEN** 使用者在裝置 A 調整設定後，在裝置 B 開啟閱讀器
- **THEN** 裝置 B 使用與裝置 A 相同的設定
