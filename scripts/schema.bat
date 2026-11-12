@echo off
cd /d "%~dp0"
if not exist "..\config\.env" (
  echo config\.env not found. Run setup.bat first.
  exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("..\config\.env") do set "%%a=%%b"

where sqlcmd >nul 2>nul
if errorlevel 1 (
  echo sqlcmd was not found.
  exit /b 1
)

echo Rebuilding database schema on %DB_SERVER% ...
for %%f in (..\db\schema\*.sql
            ..\file-store\db\schema\*.sql) do (
  echo   running %%f
  sqlcmd -S "%DB_SERVER%" -E -b -i "%%f"
  if errorlevel 1 (
    echo.
    echo Failed on %%f. Check DB_SERVER in config\.env, or run the scripts in SSMS instead.
    exit /b 1
  )
)
echo Done.
