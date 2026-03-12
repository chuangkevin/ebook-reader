# ebook-reader

跨裝置同步的電子書閱讀平台，支援多使用者、多格式，像 Netflix 一樣選擇使用者後即可繼續閱讀。

## 功能特色

- **多使用者管理** — 建立不同使用者，各自擁有閱讀進度與書籤
- **跨裝置同步** — 在任何裝置上選擇使用者，接續上次閱讀位置
- **多格式支援** — EPUB、PDF、TXT
- **閱讀設定**
  - 主題切換（亮色 / 護眼 / 暗色）
  - 字體大小、行距調整
  - 橫排 / 直排排版（直排支援傳統中文閱讀方向）
  - 翻頁區域配置（預設 / 左手 / 右手友善）
  - 簡體轉繁體
- **多種翻頁方式**
  - 點擊螢幕左右區域翻頁
  - 行動裝置滑動翻頁
  - 鍵盤方向鍵 / PageUp / PageDown / Space
  - Boox Go Color 7 實體按鈕支援
  - 音量鍵翻頁（Android / Boox 裝置）
- **文字選取禁用** — 閱讀模式下防止誤觸進入複製模式

## 技術架構

| 層級 | 技術 |
| ---- | --- |
| Frontend | React 18 + TypeScript + Vite + Redux Toolkit + MUI |
| Backend | Node.js + Express + TypeScript + better-sqlite3 |
| EPUB 渲染 | react-reader (epub.js) |
| PDF 渲染 | react-pdf (pdfjs-dist) |
| 中文轉換 | opencc-js |
| 部署 | Docker + Docker Compose + GitHub Actions CI/CD |

## 本地開發

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev
```

Frontend: `http://localhost:5173`
Backend API: `http://localhost:3003`

## Docker 部署

```bash
docker compose up -d
```

- Frontend: `http://<host>:7123`
- Backend API: 內部網路 port 3003（由 nginx 反向代理 `/api` → backend）

## CI/CD

- **docker-publish.yml** — push 到 main 時自動建構 Docker image（使用 `ubuntu-24.04-arm` 原生 ARM64 runner）
- **deploy.yml** — image 建構完成後自動 SSH 部署到目標機器
- Trigger paths: `frontend/**`, `backend/**`, `docker-compose*.yml`, `.github/workflows/*.yml`

## 已知問題 / Roadmap

追蹤於 [GitHub Issues](https://github.com/chuangkevin/ebook-reader/issues)

| Issue | 狀態 | 說明 |
| ----- | ---- | ---- |
| #11 閱讀直排文字錯誤 | Open | 垂直排版文字渲染問題 |
| #10 繼續閱讀可選擇不看了 | Open | 「繼續閱讀」區塊需要移除/隱藏功能 |
| #9 離線要可以使用 | Open | PWA 離線支持 |
| #8 可閱讀區塊太小 | Open | 閱讀模式下 UI 元素佔太多空間 |
| #7 閱讀時沒法叫出設定 | Open | 點擊非翻頁區域應彈出設定 |
| #6 音量鍵翻頁 | Open | 閱讀模式下支援音量鍵翻頁 |
| #5 Boox 實體按鈕翻頁 | Open | 支援電子書閱讀器實體按鈕 |
| #3 行動裝置滑動翻頁 | Open | 手機滑動手勢翻頁 |
| #2 翻頁UI多種設計 | Open | 左手/右手友善的翻頁區域配置 |

## 專案結構

```text
ebook-reader/
├── frontend/          # React SPA
│   └── src/
│       ├── components/
│       │   ├── Reader/       # BookReader, PdfReader, TxtReader, ReaderSettings
│       │   ├── Library/      # 書庫管理
│       │   └── UserSelection/ # 使用者選擇
│       ├── store/            # Redux (user, books, settings)
│       ├── hooks/            # useProgressSync
│       ├── services/         # API service
│       └── utils/            # navigation, readerThemes
├── backend/           # Express API
│   └── src/
│       ├── controllers/      # user, book, progress, bookmark
│       ├── services/         # 業務邏輯
│       └── config/           # 環境設定、資料庫
├── docker-compose.yml
└── .github/workflows/ # CI/CD
```
