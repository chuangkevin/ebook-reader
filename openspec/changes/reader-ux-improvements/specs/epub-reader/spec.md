## MODIFIED Requirements

### Requirement: 主題切換背景同步
主題切換時 SHALL 同步更新三個層級的背景色：外層容器、paginator Shadow DOM 的 #background div、iframe 內部 document。

#### Scenario: 切換到黑暗主題
- **WHEN** 使用者在閱讀設定中選擇黑暗主題
- **THEN** 整個閱讀區域（包含 iframe 周圍空間）立即變為深色背景，無白色殘留

#### Scenario: 切換主題後翻頁無白邊
- **WHEN** 使用者切換到黑暗主題後繼續翻頁
- **THEN** 所有頁面的背景均為深色，左右邊緣無白色條紋

#### Scenario: 非首頁切換主題
- **WHEN** 使用者在非第一頁時切換到黑暗主題
- **THEN** 當前頁面立即套用深色背景，無需先翻回第一頁
