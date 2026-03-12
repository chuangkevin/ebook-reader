@echo off
echo =============================================
echo Starting LOCAL DEVELOPMENT servers for Windows...
echo =============================================
echo.

REM Use the directory where this bat file is located
set "PROJECT_DIR=%~dp0"

echo [1/2] Starting Backend Server (Node.js + Express + TypeScript)
echo       Port: http://localhost:3003
echo       Using: nodemon + ts-node
echo.
start "Ebook Reader - Backend Dev Server" cmd /c "cd /d "%PROJECT_DIR%backend" && npm install && npm run dev"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend Server (React + Vite)
echo       Port: http://localhost:5173
echo       Using: Vite HMR
echo.
start "Ebook Reader - Frontend Dev Server" cmd /c "cd /d "%PROJECT_DIR%frontend" && npm install && npm run dev"

echo.
echo =============================================
echo Both servers are starting in new windows!
echo =============================================
echo.
echo Backend:  http://localhost:3003
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this window...
pause >nul
