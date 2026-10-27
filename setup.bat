@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ===== Instructor: set these once =====
set "TOOLCHAIN_URL=https://github.com/YOUR-ORG/dab-toolchain/releases/download/v1/toolchain.zip"
set "TOOLCHAIN_SHA256="
rem ======================================

if exist ".tools\dab-tool\dab.exe" (
  echo Toolchain already installed.
  goto :env
)

rem Use a toolchain.zip dropped next to this file (USB / network share), else download.
set "ZIP=%~dp0toolchain.zip"
if not exist "%ZIP%" (
  echo Downloading toolchain...
  set "ZIP=%TEMP%\toolchain.zip"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest '%TOOLCHAIN_URL%' -OutFile '!ZIP!'"
  if errorlevel 1 (
    echo.
    echo Download failed. Ask your teacher for toolchain.zip, put it in this folder, and run setup.bat again.
    exit /b 1
  )
)

if defined TOOLCHAIN_SHA256 (
  set "HASH="
  for /f "skip=1 tokens=*" %%h in ('certutil -hashfile "!ZIP!" SHA256') do if not defined HASH set "HASH=%%h"
  set "HASH=!HASH: =!"
  if /i not "!HASH!"=="%TOOLCHAIN_SHA256%" (
    echo Checksum mismatch - the file is corrupt or not the expected version.
    exit /b 1
  )
)

echo Unpacking...
if not exist ".tools" mkdir ".tools"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '!ZIP!' -DestinationPath '.tools' -Force"
if not exist ".tools\dab-tool\dab.exe" (
  echo Unpack failed: .tools\dab-tool\dab.exe not found.
  exit /b 1
)

:env
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Created .env - open it and check the server name for this computer.
)

set "DOTNET_ROOT=%~dp0.tools\dab-tool\dotnet"
set "PATH=%~dp0.tools\dab-tool;%DOTNET_ROOT%;%PATH%"
echo.
dab --version
if errorlevel 1 (
  echo DAB did not start. See the Troubleshooting section of README.md.
  exit /b 1
)

echo.
echo Setup complete. Next:
echo   1. Edit .env if your SQL Server name is not "localhost"
echo   2. Run rebuild-db.bat  (or run db\01_schema.sql then db\02_seed.sql in SSMS)
echo   3. Run run.bat, then open this folder in VS Code and click Go Live
