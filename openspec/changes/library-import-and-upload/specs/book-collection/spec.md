# Book Collection Spec

## Overview
書籍可以屬於一個「collection」（分類），對應使用者上傳時的資料夾名稱。

## Requirements

### 資料模型
- 每本書可有零或一個 collection（字串，null 表示無分類）
- collection 名稱來自上傳時的資料夾名稱（webkitRelativePath 第一層）
- collection 欄位在 DB 中為 `TEXT DEFAULT NULL`

### 書庫顯示
- 有 collection 的書籍依 collection 名稱分組，各自顯示為獨立橫向 block
- 每個 collection block 顯示 collection 名稱作為標題
- 無 collection 的書籍顯示在「其他書籍」block
- 若所有書籍都無 collection，維持現有顯示方式（不顯示多餘 block 標題）
- collection block 順序：有 collection 的依字母排序在前，「其他書籍」在最後

### 現有功能不受影響
- 閱讀進度、書籤、設定完全不受 collection 影響
- 現有書籍（collection=null）正常顯示在「其他書籍」

## API
- `GET /api/books` response 包含 `collection: string | null`
- `POST /api/books` body 接受 `collection?: string`
