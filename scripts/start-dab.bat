@echo off
cd /d "%~dp0"
if not exist "..\config\.env" (
  echo config\.env not found. Run setup.bat first.
  exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("..\config\.env") do set "%%a=%%b"

set "DOTNET_ROOT=%~dp0..\.tools\dab-tool\dotnet"
set "PATH=%~dp0..\.tools\dab-tool;%DOTNET_ROOT%;%PATH%"

@echo off

curl -s http://localhost:5000/ >nul 2>&1

if errorlevel 1 (
    echo DAB is not running. Starting...
    
    call dab start --config ..\config\dab-config.json
) else (
    echo DAB is already running.
)