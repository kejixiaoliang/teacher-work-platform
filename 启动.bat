@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 教师工作台

if not exist node_modules (
  echo [首次运行] 正在安装依赖，请稍候（约 1-3 分钟）...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
  echo [首次运行] 正在构建前端界面...
  call npm run build
  if errorlevel 1 goto :error
)

if not exist web\dist (
  echo [构建] 正在构建前端界面...
  call npm run build
  if errorlevel 1 goto :error
)

echo.
echo ============================================
echo   教师工作台启动中...
echo   服务地址: http://localhost:3210
echo   关闭本窗口即停止服务，数据保存在 data\ 文件夹
echo ============================================
echo.
call npm start
goto :eof

:error
echo.
echo [错误] 启动失败，请检查上方提示。可尝试删除 node_modules 后重新运行。
pause
