## ADDED Requirements

### Requirement: ReaderToolbar 元件
ReaderPage SHALL 將工具列拆分為獨立的 `ReaderToolbar` 元件，接收 props 控制所有按鈕行為。ReaderToolbar 負責：返回按鈕、目錄按鈕、書名顯示、百分比、書籤按鈕、全螢幕按鈕、設定按鈕。

#### Scenario: ReaderToolbar 獨立渲染
- **WHEN** ReaderPage 渲染工具列
- **THEN** 使用 `<ReaderToolbar>` 元件，傳入 onBack、onTocOpen、onSettingsOpen、onFullscreenToggle、onAddBookmark、onBookmarksOpen 等 callback props

#### Scenario: ReaderToolbar 全螢幕隱藏
- **WHEN** fullscreen 為 true
- **THEN** ReaderToolbar 的容器高度為 0、minHeight 為 0

### Requirement: ReaderProgressBar 元件
ReaderPage SHALL 將底部進度滑桿拆分為獨立的 `ReaderProgressBar` 元件。

#### Scenario: ReaderProgressBar 獨立渲染
- **WHEN** ReaderPage 渲染進度條
- **THEN** 使用 `<ReaderProgressBar>` 元件，傳入 percent、theme、onSeek props

#### Scenario: ReaderProgressBar 全螢幕隱藏
- **WHEN** fullscreen 為 true
- **THEN** ReaderProgressBar 不渲染（條件渲染）

### Requirement: BookmarkDrawer 元件
ReaderPage SHALL 將書籤列表 Drawer 拆分為獨立的 `BookmarkDrawer` 元件，包含書籤列表顯示、跳轉、刪除功能。

#### Scenario: BookmarkDrawer 獨立渲染
- **WHEN** 使用者點擊書籤列表按鈕
- **THEN** 開啟 `<BookmarkDrawer>` 元件，顯示所有書籤並支援跳轉和刪除

### Requirement: useStyleInjector hook
EpubReader SHALL 將 CSS 注入邏輯拆分為 `useStyleInjector` custom hook，負責將 writingMode、fontSize、theme 注入 iframe document。

#### Scenario: useStyleInjector 注入 CSS
- **WHEN** fontSize 或 theme 變更
- **THEN** hook 自動將新 CSS 注入所有 paginator iframe 並呼叫 paginator.render() 觸發重排版

### Requirement: useModeSwitch hook
EpubReader SHALL 將直排/橫排切換邏輯拆分為 `useModeSwitch` custom hook，封裝文字錨點擷取、重新開啟 book、跳回原位的完整流程。

#### Scenario: useModeSwitch 切換模式
- **WHEN** writingMode prop 變更
- **THEN** hook 自動保存當前文字錨點、重新開啟 paginator、用文字搜尋跳回原位

### Requirement: useEpubProgress hook
EpubReader SHALL 將進度追蹤邏輯拆分為 `useEpubProgress` custom hook，負責監聽 relocate 事件、計算加權進度、回報進度變更。

#### Scenario: useEpubProgress 回報進度
- **WHEN** paginator 觸發 relocate 事件
- **THEN** hook 計算 SectionProgress 加權分數並呼叫 onProgressChange 回傳 ReadingPosition 物件
