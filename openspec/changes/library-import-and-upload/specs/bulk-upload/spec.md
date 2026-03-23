# Bulk Upload Spec

## Overview
支援多選檔案與資料夾匯入，批次上傳書籍並提供即時進度回饋。

## Requirements

### 入口
- 書庫 FAB（現有）展開為兩個選項：「選擇檔案」（多選）、「選擇資料夾」
- 或維持單一 FAB，點擊後打開 Dialog，Dialog 內有兩個按鈕

### 多選檔案
- `<input type="file" multiple accept=".epub,.pdf,.txt">` 支援多選
- 選後立即進入上傳 Dialog

### 資料夾匯入
- `<input type="file" webkitdirectory accept=".epub,.pdf,.txt">` 選取整個資料夾
- 使用 `file.webkitRelativePath` 取得相對路徑
- 第一層資料夾名稱作為 collection（如 "福爾摩斯/血字的研究.epub" → collection="福爾摩斯"）
- 根目錄的書籍（無子資料夾）collection=null

### 上傳 Dialog
- 列出所有待上傳書籍，每本一列，顯示：檔名、進度條、狀態
- 狀態：等待中 / 上傳中（%）/ 完成 ✓ / 重複跳過 ⚠ / 失敗 ✗
- 並行上傳最多 3 本，其餘排隊
- 重複書名（409）標記為「已存在，跳過」，不中斷其他上傳
- 全部完成後顯示摘要（X 本成功，Y 本跳過，Z 本失敗）
- 關閉 Dialog 後書庫自動重整

### 進度回饋
- 使用 XMLHttpRequest `upload.onprogress` 取得上傳進度（0~100%）
- 每本書獨立進度條，非整體進度

## E2E 測試
- 上傳 3 本書，驗證：進度條出現、最終全部顯示完成
- 上傳含重複書名，驗證：重複項標記跳過，其他正常完成
- 資料夾匯入：模擬含子資料夾的 FileList，驗證 collection 正確帶入
- 上傳完成後進入閱讀器，驗證閱讀進度功能正常
