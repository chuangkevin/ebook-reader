## Conflict Resolution

### UI: Steam-style Dialog

```
┌─────────────────────────────────────────────────┐
│  ⚠️ 閱讀進度衝突                                 │
│  「書名」的閱讀進度在其他裝置上也有更新            │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────┐       │
│  │  📱 本機進度      │  │  ☁️ 雲端進度     │       │
│  │                  │  │                 │       │
│  │  第 3 章         │  │  第 5 章         │       │
│  │  進度 45.2%      │  │  進度 72.8%      │       │
│  │  今天 14:30      │  │  昨天 22:15      │       │
│  │                  │  │                 │       │
│  │  [使用此進度]     │  │  [使用此進度]     │       │
│  └─────────────────┘  └─────────────────┘       │
└─────────────────────────────────────────────────┘
```

### Component: ConflictDialog

Props:
- `open: boolean`
- `bookTitle: string`
- `localData: { cfi, percentage, lastReadAt }`
- `serverData: { cfi, percentage, lastReadAt }`
- `onResolve: (choice: 'local' | 'server') => void`

### Behaviors

- 衝突發生時自動彈出，使用者必須選擇才能繼續
- 多本書同時衝突：排隊顯示，一次處理一本
- Settings 衝突：類似 UI，顯示設定差異而非進度
- 選擇後立即寫入本地 + 呼叫 resolve API
