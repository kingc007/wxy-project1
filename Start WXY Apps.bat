@echo off
rem Double-click to start Site Brief (http://localhost:3101) and Massing Studio (http://localhost:3301) on Windows.
rem First run installs and builds (several minutes). Close the two app windows to stop them.
rem NOTE: written for Windows but not tested there; the macOS launcher is "Start WXY Apps.command".

cd /d "%~dp0"
set "ROOT=%cd%"
set "SITE_BRIEF=%ROOT%\Project-1_Code-Zoning-Research-Assistant\1B_Site-Brief\app"
set "ENGINE=%ROOT%\Project-3_AI-Massing-Generation\shared\massing"
set "MASSING=%ROOT%\Project-3_AI-Massing-Generation\3A_Massing-Studio\app"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed. Install the LTS version from https://nodejs.org, then run this again.
  pause
  exit /b 1
)

if not exist "%ENGINE%\node_modules" (echo Installing the massing engine... & pushd "%ENGINE%" & call npm install --no-fund --no-audit & popd)
if not exist "%MASSING%\node_modules" (echo Installing Massing Studio... & pushd "%MASSING%" & call npm install --no-fund --no-audit & popd)
if not exist "%SITE_BRIEF%\node_modules" (echo Installing Site Brief... & pushd "%SITE_BRIEF%" & call npm install --no-fund --no-audit & popd)

rem Builds once; delete the app's .next folder to force a rebuild after code changes.
if not exist "%SITE_BRIEF%\.next\BUILD_ID" (echo Building Site Brief... & pushd "%SITE_BRIEF%" & call npx next build & popd)
if not exist "%MASSING%\.next\BUILD_ID" (echo Building Massing Studio... & pushd "%MASSING%" & call npx next build & popd)

start "Site Brief (port 3101)" /d "%SITE_BRIEF%" cmd /k npx next start -p 3101
start "Massing Studio (port 3301)" /d "%MASSING%" cmd /k npx next start -p 3301

echo Waiting for the apps to start...
timeout /t 8 /nobreak >nul
start "" http://localhost:3101
echo.
echo Site Brief      http://localhost:3101
echo Massing Studio  http://localhost:3301
echo Close the two app windows to stop them.
pause
