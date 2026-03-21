## Sync Engine

### Trigger

- `window.addEventListener('online', ...)` 觸發同步
- App 啟動時若在線，自動同步
- 手動同步按鈕（設定頁面）

### Sync Flow

1. 讀取所有 `syncQueue` items，按 `createdAt` 排序
2. 逐筆發送 API request，帶 `localVersion`
3. Server 回應：
   - `200 OK` + 新 version → 更新本地 version，清除 queue item
   - `409 Conflict` + serverData → 觸發衝突解決
4. 全部完成後，拉取 server 最新資料更新本地

### Version-based Optimistic Locking

- Client 送出 `localVersion`
- Server 檢查 `localVersion == server.version`
- 相符：更新，version++，回傳新 version
- 不符：回傳 409 + server 目前資料

### Backend API Changes

#### PUT /api/users/:userId/books/:bookId/progress
Request body 新增 `version` 欄位（optional，向後相容）：
```json
{
  "cfi": "@@2@@0.45",
  "percentage": 45.2,
  "version": 3
}
```

Response:
- 成功: `{ ...progress, version: 4 }`
- 衝突: `{ conflict: true, serverData: {...}, serverVersion: 5 }`

#### PUT /api/users/:userId/books/:bookId/progress/resolve
強制覆寫：
```json
{
  "cfi": "@@2@@0.45",
  "percentage": 45.2,
  "forceVersion": true
}
```

### Error Handling

- 網路錯誤：保留 queue item，下次重試
- 5xx 錯誤：保留 queue item，exponential backoff
- 4xx 錯誤（非 409）：丟棄 queue item，log warning
