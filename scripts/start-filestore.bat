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
    echo DAB is not running. Waiting for it to be started...

    :waitfordab
      curl -s http://localhost:5000/ >nul 2>&1

      if errorlevel 1 (
          echo Waiting for DAB to start...
          timeout /t 1 >nul
          goto waitfordab
      )

    echo DAB is ready on http://localhost:5000
    echo Swagger: http://localhost:5000/swagger
    echo.
) else (
    echo DAB is already running.
)

echo Starting file store on http://localhost:3000  (Ctrl+C to stop)
node ..\file-store\server.js
