## ADDED Requirements

### Requirement: 書庫列表
系統 SHALL 顯示目前使用者的所有書籍，每本書顯示書封（若有）、書名、作者、閱讀進度百分比。

#### Scenario: 顯示書庫
- **WHEN** 使用者進入書庫頁面
- **THEN** 系統顯示所有已上傳書籍，包含書封、書名、作者、進度百分比

#### Scenario: 書籍有進度
- **WHEN** 書籍有閱讀紀錄
- **THEN** 進度百分比顯示非零值，並可直接繼續閱讀

### Requirement: 上傳書籍
系統 SHALL 支援上傳 EPUB、PDF、TXT 格式的電子書。

#### Scenario: 上傳 EPUB
- **WHEN** 使用者選擇 .epub 檔案上傳
- **THEN** 系統解析書籍元資料（書名、作者、封面），並加入書庫

#### Scenario: 上傳不支援格式
- **WHEN** 使用者嘗試上傳不支援的格式
- **THEN** 系統顯示錯誤訊息，不執行上傳

### Requirement: 繼續閱讀
系統 SHALL 從上次離開的位置繼續閱讀。

#### Scenario: 開啟有進度的書籍
- **WHEN** 使用者點選有閱讀進度的書籍
- **THEN** 閱讀器開啟並自動跳到上次離開的章節與頁面位置

### Requirement: 刪除書籍
系統 SHALL 允許從書庫刪除書籍。

#### Scenario: 刪除書籍
- **WHEN** 使用者確認刪除某本書籍
- **THEN** 系統刪除書籍檔案及所有使用者對該書的進度
