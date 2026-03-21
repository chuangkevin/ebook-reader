## PWA & Service Worker

### PWA Manifest

```json
{
  "name": "Readflix",
  "short_name": "Readflix",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#121212",
  "theme_color": "#1976d2",
  "icons": [...]
}
```

### Service Worker Strategy (vite-plugin-pwa)

#### Precache (App Shell)
- HTML, CSS, JS bundles
- 字型、圖示等靜態資源
- 由 vite-plugin-pwa 自動產生 precache manifest

#### Runtime Cache Rules

| URL Pattern | Strategy | 用途 |
|-------------|----------|------|
| `/api/books/*/file` | Cache First | 書籍檔案（大且不變） |
| `/api/books/*/cover` | Cache First | 書封圖片 |
| `/api/*` | Network First | 其他 API（進度、設定） |

#### API Fallback (離線)
- `/api/users` → IndexedDB users
- `/api/books` → IndexedDB books
- `/api/users/:id/progress` → IndexedDB progress
- `/api/users/:id/settings` → IndexedDB settings
- 其他 API → 回傳 503 Service Unavailable

### Connection Monitor

- `navigator.onLine` + `online`/`offline` events
- Zustand store: `useConnectionStore`
- UI: 頂部 banner「目前為離線模式」
- 恢復連線時顯示「已恢復連線，同步中...」
