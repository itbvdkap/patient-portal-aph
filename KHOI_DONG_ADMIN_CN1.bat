@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-admin-cn1.ps1" %*
set "CN1_EXIT=%ERRORLEVEL%"
if not "%CN1_EXIT%"=="0" (
  echo.
  echo Khoi dong chua hoan tat. Xem thong bao phia tren.
  pause
)
exit /b %CN1_EXIT%
