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
