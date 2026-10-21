@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download Node.js 20 or newer from https://nodejs.org
  pause
  exit /b 1
)
echo Starting FOUR CROWNS on port 3000...
start "" http://localhost:3000
node server.js
pause
