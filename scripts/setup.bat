@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ===== Instructor: set these once =====
set "TOOLCHAIN_URL=https://github.com/John-Abbott-College/3D6-project/releases/download/v0.1.0/toolchain.zip"
set "TOOLCHAIN_SHA256=073446e0a84474925f59f0785204cb85c68e9d5de3caa151d9b361840f7d168b"
rem ======================================

if exist "..\.tools\dab-tool\dab.cmd" (
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
if not exist "..\.tools" mkdir "..\tools"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '!ZIP!' -DestinationPath '..\.tools' -Force"
if not exist "..\.tools\dab-tool\dab.cmd" (
  echo Unpack failed: ..\.tools\dab-tool\dab.cmd not found.
  exit /b 1
)

:env
if not exist "..\config\.env" (
  copy "..\config\env.example" "..\config\.env" >nul
  echo Created config\.env - open it and check the server name for this computer.
)

set "DOTNET_ROOT=%~dp0..\.tools\dab-tool\dotnet"
set "PATH=%~dp0..\.tools\dab-tool;%DOTNET_ROOT%;%PATH%"
echo.
call dab --version
rem .NET launcher failures return negative exit codes, so test for "not 0"
if not %errorlevel%==0 (
  echo DAB did not start. See the Troubleshooting section of README.md.
  exit /b 1
)

echo.
echo Setup complete. Next:
echo   1. Edit config\.env if your SQL Server name is not "localhost"
echo   2. Run `npm run schema` 
echo   3. Run `npm run data` 
echo   4. Run `npm start` then open this folder in VS Code and click Go Live
