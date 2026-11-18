@echo off
rem 专体 PERSON SPORTS · 停止三服务（按端口精确终止，不影响其他 node 进程）
chcp 65001 >nul
for %%P in (8787 5174 5173) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
    echo 终止端口 %%P 的进程 PID=%%a
    taskkill /PID %%a /T /F >nul 2>&1
  )
)
echo 完成。
