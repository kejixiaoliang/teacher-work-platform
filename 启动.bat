@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 教师工作台

echo ============================================
echo   教师工作台 · 启动引导
echo ============================================
echo.

rem ========== 1. 依赖检查 ==========
if not exist node_modules (
  echo [首次运行] 未检测到依赖，正在安装（约 1-3 分钟）...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
  echo [首次运行] 依赖安装完成。
  echo.
)

rem ========== 2. 前端构建检查 ==========
if not exist web\dist\index.html (
  echo [构建] 未检测到前端产物，正在构建界面...
  call npm run build
  if errorlevel 1 goto :error
  echo [构建] 界面构建完成。
  echo.
)

rem ========== 3. 端口与运行实例检测 ==========
echo [检测] 检查服务端口 3210 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 3210 -State Listen -ErrorAction SilentlyContinue; if($c -eq $null){exit 0}; try{$r=Invoke-WebRequest 'http://localhost:3210/api/health' -UseBasicParsing -TimeoutSec 3; if($r.StatusCode -eq 200){exit 2}else{exit 1}}catch{exit 1}"
set "PORT_STATE=%errorlevel%"

if "%PORT_STATE%"=="2" (
  rem 端口被占且健康检查通过 = 已有实例在运行
  echo.
  echo [提示] 检测到「教师工作台」已经在运行！
  echo        正在为你打开浏览器...
  echo.
  start http://localhost:3210
  echo 已打开浏览器。本窗口 3 秒后自动关闭。
  timeout /t 3 >nul
  goto :eof
)
if "%PORT_STATE%"=="1" (
  rem 端口被占但健康检查失败 = 其他程序/残留进程占用
  echo.
  echo [警告] 端口 3210 已被其他进程占用，无法启动！
  echo        可能原因：之前启动的服务窗口没关、或存在残留的 node 进程。
  echo        处理办法：
  echo          1. 关闭所有「教师工作台」的启动窗口
  echo          2. 打开任务管理器，结束残留的 node.exe 进程
  echo          3. 重新运行本程序
  echo.
  pause
  goto :eof
)

rem ========== 4. 正常启动 ==========
echo.
echo ============================================
echo   教师工作台启动中...
echo   服务地址: http://localhost:3210
echo ============================================
echo.

rem 用 PowerShell 以最小化独立窗口启动 node 服务（继承当前目录），主窗口可安全关闭
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process node -ArgumentList 'server/index.js' -WorkingDirectory '%~dp0' -WindowStyle Minimized"

echo   ✔ 服务已在后台最小化窗口运行
echo   ✔ 浏览器将自动打开 http://localhost:3210
echo.
echo   说明：
echo   - 本窗口现在可以安全关闭，不会影响服务
echo   - 需要停止服务时，从任务栏找到并关闭
echo     「node」那个最小化窗口即可
echo   - 数据实时保存，关闭窗口前无需额外操作
echo.
echo 本窗口 8 秒后自动关闭...
timeout /t 8 >nul
goto :eof

:error
echo.
echo [错误] 启动失败，请检查上方提示。
echo 常见原因与处理：
echo   1. 端口被占用   -^> 关闭其他启动窗口 / 结束残留 node 进程后重试
echo   2. 依赖损坏     -^> 删除 node_modules 文件夹后重新运行
echo   3. 前端构建失败 -^> 删除 web\dist 文件夹后重新运行
echo   4. 数据损坏     -^> 先备份 data 文件夹，再删除 data\teacher.db 重试
echo.
pause