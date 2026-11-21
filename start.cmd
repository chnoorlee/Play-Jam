@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12+ from https://nodejs.org and run again.
  pause
  exit /b 1
)
echo The Last Post - keep this window open while playing.
node server.mjs --open
pause
