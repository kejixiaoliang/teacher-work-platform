@echo off
setlocal
cd /d "%~dp0"
title Teacher Workbench

echo ============================================
echo   Teacher Workbench - Startup
echo ============================================
echo.

rem 1. Ensure Node.js and npm are available.
where node >nul 2>nul
if errorlevel 1 goto :offer_node_install
where npm >nul 2>nul
if errorlevel 1 goto :offer_node_install
goto :node_ready

:offer_node_install
echo [Setup] Node.js LTS and npm are required but were not found.
set "INSTALL_NODE="
set /p "INSTALL_NODE=Install Node.js LTS now? [Y/N]: "
if /i not "%INSTALL_NODE%"=="Y" goto :node_declined
where winget >nul 2>nul
if errorlevel 1 goto :node_unavailable
echo [Setup] Installing Node.js LTS with winget...
winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :node_unavailable
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 goto :node_restart_required
where npm >nul 2>nul
if errorlevel 1 goto :node_restart_required
echo [Setup] Node.js LTS installed successfully.
goto :node_ready

:node_unavailable
echo [Setup] Automatic installation is unavailable or failed.
echo Download Node.js LTS from: https://nodejs.org/en/download
start "" "https://nodejs.org/en/download"
echo Install Node.js LTS, then run this file again.
pause
goto :end

:node_restart_required
echo [Setup] Node.js was installed, but this window cannot see it yet.
echo Close this window and run this file again.
pause
goto :end

:node_declined
echo [Setup] Installation cancelled. Node.js LTS is required to continue.
pause
goto :end

:node_ready
rem 2. Install dependencies on first run.
if not exist "node_modules\" (
  echo [First run] Installing dependencies. This may take 1-3 minutes...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
  echo [First run] Dependencies installed.
  echo.
)

rem 3. Build the web interface when no build output exists.
if not exist "web\dist\index.html" (
  echo [Build] Building the web interface...
  call npm run build
  if errorlevel 1 goto :error
  echo [Build] Web interface built.
  echo.
)

rem 4. Check whether port 3210 is already in use.
echo [Check] Checking service port 3210...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-WebRequest 'http://127.0.0.1:3210/api/health' -UseBasicParsing -TimeoutSec 3; if($r.StatusCode -eq 200){exit 2}}catch{}; $c=New-Object Net.Sockets.TcpClient; try{$c.Connect('127.0.0.1',3210); exit 1}catch{exit 0}finally{$c.Dispose()}"
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

rem 5. Start the server in a separate minimized window.
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
