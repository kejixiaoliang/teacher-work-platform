@echo off
setlocal
cd /d "%~dp0"
title Teacher Workbench

echo ============================================
echo   Teacher Workbench - Startup
echo ============================================
echo.

rem 1. Install dependencies on first run.
if not exist "node_modules\" (
  echo [First run] Installing dependencies. This may take 1-3 minutes...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
  echo [First run] Dependencies installed.
  echo.
)

rem 2. Build the web interface when no build output exists.
if not exist "web\dist\index.html" (
  echo [Build] Building the web interface...
  call npm run build
  if errorlevel 1 goto :error
  echo [Build] Web interface built.
  echo.
)

rem 3. Check whether port 3210 is already in use.
echo [Check] Checking service port 3210...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 3210 -State Listen -ErrorAction SilentlyContinue; if($null -eq $c){exit 0}; try{$r=Invoke-WebRequest 'http://127.0.0.1:3210/api/health' -UseBasicParsing -TimeoutSec 3; if($r.StatusCode -eq 200){exit 2}else{exit 1}}catch{exit 1}"
set "PORT_STATE=%errorlevel%"

if "%PORT_STATE%"=="2" (
  echo.
  echo [Info] Teacher Workbench is already running.
  echo Opening it in your browser...
  start "" "http://localhost:3210"
  echo This window will close in 3 seconds.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3"
  goto :end
)

if "%PORT_STATE%"=="1" (
  echo.
  echo [Error] Port 3210 is being used by another process.
  echo Close any previous Teacher Workbench window or stop the old node.exe process.
  echo Then run this file again.
  echo.
  pause
  goto :end
)

rem 4. Start the server in a separate minimized window.
echo.
echo ============================================
echo   Starting Teacher Workbench...
echo   Address: http://localhost:3210
echo ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process node -ArgumentList 'server/index.js' -WorkingDirectory '%~dp0' -WindowStyle Minimized"
if errorlevel 1 goto :error

echo The service is running in a minimized window.
echo Open http://localhost:3210 in your browser.
echo To stop the service, close the minimized node window.
echo.
echo This window will close in 8 seconds...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 8"
goto :end

:error
echo.
echo [Error] Startup failed. Review the message above.
echo Common fixes:
echo   1. Port in use       - Close the old startup or node window and retry.
echo   2. Broken dependency - Delete node_modules and retry.
echo   3. Build failure     - Delete web\dist and retry.
echo   4. Database issue    - Back up data, delete data\teacher.db, and retry.
echo.
pause

:end
endlocal
