## Why

閱讀器在實際使用中存在四個體驗問題：黑暗主題切換後背景仍為白色、文字緊貼螢幕邊緣無法調整、進度百分比因 section 長度不均導致嚴重失準、書庫缺少使用者個人設定入口。這些直接影響日常閱讀的舒適度與準確性。

## What Changes

- 修正主題切換時 foliate-paginator Shadow DOM 內部 `#background` div 未同步更新的問題
- 新增邊距（gap）設定滑桿，利用 paginator 已支援的 `gap` 屬性讓使用者自行調整
- 進度計算改用 foliate-js `SectionProgress`（以 section 位元組大小加權），取代現有的等權除法
- 書庫頁面底部新增 PROFILE 按鈕，打開使用者設定面板，可修改名稱與選擇頭像顏色

## Capabilities

### New Capabilities

- `user-profile`: 書庫內的使用者個人設定功能，包含修改名稱與頭像顏色選擇

### Modified Capabilities

- `reader-settings`: 新增邊距調整滑桿（gap），閱讀設定面板擴充
- `reading-progress`: 進度計算改用位元組加權，顯示格式調整為章節頁碼 + 全書百分比
- `epub-reader`: 修正主題切換時 paginator 背景色未同步的問題

## Impact

- **前端 EpubReader.tsx**: 主題切換邏輯需存取 paginator shadow DOM 更新 `#background`
- **前端 ReaderSettings.tsx**: 新增邊距滑桿 UI
- **前端 ReaderPage.tsx**: 進度計算改用 `SectionProgress`，進度顯示格式變更
- **前端 BookLibrary.tsx**: 底部新增 PROFILE 按鈕與使用者設定 Drawer
- **前端 settingsStore**: 新增 `gap` 設定項
- **前端 api.service.ts**: 新增 `updateUser(id, name, avatarColor)` API 呼叫
- **後端**: 不需修改（`PUT /users/:id` 已存在）
