@echo off
cd /d "%~dp0"
if not exist "..\config\.env" (
  echo config\.env not found. Run setup.bat first.
  exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("..\config\.env") do set "%%a=%%b"

set "DOTNET_ROOT=%~dp0..\.tools\dab-tool\dotnet"
set "PATH=%~dp0..\.tools\dab-tool;%DOTNET_ROOT%;%PATH%"

curl -s http://localhost:5000/ >nul 2>&1

if errorlevel 1 (
    echo DAB is not running. Starting...

    powershell -Command ^
      "Start-Process cmd.exe -ArgumentList '/c dab.cmd start --config ..\config\dab-config.json' -WindowStyle Hidden"

    rem Wait until our endpoint is avaiable before continuing:
    :waitfordab
      curl -s http://localhost:5000/ >nul 2>&1

      if errorlevel 1 (
          echo Waiting for DAB to start...
          timeout /t 1 >nul
          goto waitfordab
      )

    echo DAB is ready.
) else (
    echo DAB is already running.
)

echo Adding files from db\data\files into the file store...
node ..\file-store\server.js --init ..\db\data\files
echo Done.

echo Stopping DAB.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5000" ^| findstr LISTENING') do (
    taskkill /F /PID %%p
)
echo Stopped.

where sqlcmd >nul 2>nul
if errorlevel 1 (
  echo sqlcmd was not found.
  exit /b 1
)

echo Running database seeding scripts on %DB_SERVER% ...
for %%f in (..\db\data\*.sql) do (
  echo   running %%f
  sqlcmd -S "%DB_SERVER%" -E -b -i "%%f"
  if errorlevel 1 (
    echo.
    echo Failed on %%f. Check DB_SERVER in config\.env, or run the scripts in SSMS instead.
    exit /b 1
  )
)
echo Done.
