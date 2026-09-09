@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo.
echo ========================================
echo An Phu Patient Portal - Localhost 3001
echo Repo: %CD%
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please install Node.js 20+ and npm 10+.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Opening http://localhost:3001/profile
start "" "http://localhost:3001/profile"

echo.
echo [INFO] Starting Next.js dev server on port 3001...
echo [INFO] Keep this window open while testing.
echo [INFO] Press Ctrl+C in this window to stop the server.
echo.

call npm run dev:3001

echo.
echo [INFO] Dev server stopped.
pause
