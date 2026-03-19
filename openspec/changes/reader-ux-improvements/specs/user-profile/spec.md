## ADDED Requirements

### Requirement: 書庫頁面顯示使用者設定入口
書庫頁面底部 SHALL 顯示固定的 PROFILE 按鈕，點擊後展開使用者設定面板。

#### Scenario: 點擊 PROFILE 按鈕
- **WHEN** 使用者在書庫頁面點擊底部 PROFILE 按鈕
- **THEN** 系統展開 Bottom Drawer 顯示使用者設定面板

### Requirement: 修改使用者名稱
使用者設定面板 SHALL 提供名稱編輯欄位，修改後儲存至後端。

#### Scenario: 成功修改名稱
- **WHEN** 使用者在設定面板修改名稱並點擊儲存
- **THEN** 系統呼叫 PUT /api/users/:id 更新名稱，書庫頁面顯示新名稱

#### Scenario: 名稱不可為空
- **WHEN** 使用者將名稱清空並嘗試儲存
- **THEN** 系統不允許儲存，顯示錯誤提示

### Requirement: 選擇頭像顏色
使用者設定面板 SHALL 提供 6~8 個預設顏色供選擇，選擇後作為使用者頭像顏色。

#### Scenario: 選擇頭像顏色並儲存
- **WHEN** 使用者選擇一個顏色並儲存
- **THEN** 系統更新使用者頭像顏色，使用者選擇頁面的頭像圓圈顯示新顏色
