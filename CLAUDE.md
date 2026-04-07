# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ebook-reader** 是跨裝置電子書閱讀平台，支援 EPUB、PDF，並提供閱讀進度同步。

## Architecture

- **Frontend** (`frontend/`): React 19 + MUI 7 + Vite + TypeScript
  - EPUB: fflate (解壓縮) + foliate-js (rendering)
  - PDF: react-pdf (pdfjs-dist)
  - Playwright E2E tests (`tests/`)
  - ESLint: `frontend/eslint.config.js`
- **Backend** (`backend/`): Express + TypeScript + SQLite (better-sqlite3)
  - REST API for book management and reading progress sync
  - `backend/src/server.ts` — entry point
- **Root**: husky pre-commit hooks

## Development Commands

```bash
# Frontend (port 5173)
cd frontend && npm run dev
cd frontend && npm run build    # tsc -b && vite build
cd frontend && npm run lint     # eslint
cd frontend && npm run preview

# E2E Tests
cd frontend && npm run test:e2e
cd frontend && npm run test:e2e:ui
cd frontend && npm run test:e2e:headed

# Backend
cd backend && npm run dev       # nodemon + ts-node
cd backend && npm run build     # tsc → dist/
cd backend && npm run lint      # eslint src
cd backend && npm run format    # prettier

# Full stack
docker compose up -d
```

## Key Architecture

- Reading progress stored in SQLite, synced via REST API
- EPUB rendering uses foliate-js (located in `frontend/src/lib/foliate-js/`)
- Frontend reads from backend API for cross-device sync
- opencc-js for Traditional/Simplified Chinese conversion

## Ports

| Port | Service |
|------|---------|
| 5173 | Frontend (Vite dev) |
| 3000 | Backend API |

## Docker

```bash
docker compose up -d           # Production
docker compose -f docker-compose.prod.yml up -d
```
