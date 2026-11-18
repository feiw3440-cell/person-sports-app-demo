@echo off
rem 专体 PERSON SPORTS · 一键启动三服务（API 8787 / PC 5174 / APP 5173）
rem 用法：双击运行或命令行执行；窗口保持打开即服务运行，关闭窗口即停止对应进程
rem 说明：用户级脚本，不修改端口、不注册系统任务、不安装依赖（需先在各目录 npm install）

chcp 65001 >nul
setlocal
set ROOT=%~dp0..
set APPDIR=%ROOT%\app

echo [1/3] 启动共享 API（server/ · :8787）...
start "zt-api" cmd /k "cd /d %APPDIR%\server && npx tsx src/index.ts"

echo [2/3] 启动 PC 工作台（pc/ · :5174）...
start "zt-pc" cmd /k "cd /d %APPDIR%\pc && npx vite --port 5174 --strictPort"

echo [3/3] 启动 APP（app/ · :5173）...
start "zt-app" cmd /k "cd /d %APPDIR% && npx vite --port 5173 --strictPort"

echo.
echo 三个服务已在独立窗口启动：
echo   APP   http://localhost:5173
echo   PC    http://localhost:5174
echo   API   http://127.0.0.1:8787/v1/health
echo 关闭对应窗口即可停止该服务。
endlocal
