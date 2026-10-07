@echo off
title Tailor Notebook
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install the LTS version from https://nodejs.org
  echo then run this file again.
  pause
  exit /b 1
)

if not exist backend\node_modules (
  echo Installing backend packages ^(first run only, needs internet, ~1 minute^)...
  pushd backend
  call npm install
  if errorlevel 1 (
    echo.
    echo Backend package install FAILED. Check the messages above for the reason.
    popd
    pause
    exit /b 1
  )
  popd
)

if not exist frontend\dist\index.html (
  echo Building the frontend ^(first run only^)...
  pushd frontend
  if not exist node_modules call npm install
  call npm run build
  if errorlevel 1 (
    echo.
    echo Frontend build FAILED. Check the messages above for the reason.
    popd
    pause
    exit /b 1
  )
  popd
)

echo.
echo Starting Tailor Notebook on http://localhost:5000
echo Microsoft Edge will open automatically in a few seconds.
echo If Edge says it can't reach the page, wait a moment and press refresh.
echo Keep THIS window open while you use the app. Close it to stop the server.
echo.

start "" cmd /c "timeout /t 5 /nobreak >nul & start msedge http://localhost:5000"

cd backend
call npm start

echo.
echo The server stopped. If this was unexpected, scroll up to read the error.
pause
