@echo off
setlocal
call "%~dp0KHOI_DONG_ADMIN_CN1.bat" -InstallStartup -NoBrowser
if errorlevel 1 exit /b 1
echo.
echo Da cai tu khoi dong Admin CN1 khi tai khoan Windows nay dang nhap.
echo Khong can mo trinh duyet; cac tien trinh se chay nen.
echo Go tu khoi dong: KHOI_DONG_ADMIN_CN1.bat -UninstallStartup
pause
