@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo.
echo ========================================
echo An Phu Patient Portal - Local Test Runner
echo Repo: %CD%
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please install Node.js 20+ and npm 10+.
  goto fail
)

if not exist "node_modules\" (
  echo [INFO] node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 goto fail
)

echo.
echo [1/5] Running unit tests...
call npm run test
if errorlevel 1 goto fail

echo.
echo [2/5] Building Next.js portal...
call npm run build
if errorlevel 1 goto fail

echo.
echo [3/5] Typechecking shared patient-domain package...
call npm --workspace @anphu/patient-domain run typecheck
if errorlevel 1 goto fail

echo.
echo [4/5] Typechecking Expo mobile app...
call npm --workspace @anphu/mobile-app run typecheck
if errorlevel 1 goto fail

echo.
echo [5/5] Building .NET PatientApi if SDK is available...
where dotnet >nul 2>nul
if errorlevel 1 (
  echo [WARN] dotnet was not found. Skipping backend build.
) else (
  call dotnet build backend\PatientApi\PatientApi.csproj --no-restore --no-incremental
  if errorlevel 1 goto fail
)

echo.
echo ========================================
echo All available local checks passed.
echo ========================================
echo.
pause
exit /b 0

:fail
echo.
echo ========================================
echo Local checks failed. See the error above.
echo ========================================
echo.
pause
exit /b 1
