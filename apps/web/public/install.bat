@echo off
setlocal enabledelayedexpansion

set "REPO=joachimhodana/vvvv"
set "BINARY=vvvv-core"
set "ARCH=amd64"

:: Detect architecture
if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" set "ARCH=amd64"

echo -^> Detected windows/%ARCH%

:: Get latest release tag
set "TMPFILE=%TEMP%\vvvv_release.json"
curl -fsSL -o "%TMPFILE%" "https://api.github.com/repos/%REPO%/releases/latest"
if errorlevel 1 (
    echo X Could not fetch latest release
    exit /b 1
)

for /f "tokens=2 delims=:" %%a in ('findstr "tag_name" "%TMPFILE%"') do (
    set "TAG=%%~a"
)
set "TAG=%TAG: =%"
set "TAG=%TAG:,=%"
set "TAG=%TAG:"=%"

if "%TAG%"=="" (
    echo X Could not determine latest release
    exit /b 1
)

echo -^> Latest release: %TAG%

set "URL=https://github.com/%REPO%/releases/download/%TAG%/%BINARY%_windows_%ARCH%.exe"
set "INSTALL_DIR=%LOCALAPPDATA%\vvvv"
set "DEST=%INSTALL_DIR%\%BINARY%.exe"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo -^> Downloading %URL%
curl -fSL -o "%DEST%" "%URL%"
if errorlevel 1 (
    echo X Download failed
    exit /b 1
)

:: Add to PATH if not already present
echo %PATH% | findstr /i /c:"%INSTALL_DIR%" >nul
if errorlevel 1 (
    setx PATH "%PATH%;%INSTALL_DIR%" >nul 2>&1
    echo -^> Added %INSTALL_DIR% to user PATH (restart your terminal)
)

echo Done! Installed %BINARY% to %DEST%
echo   Run:  %BINARY% listen
