@echo off
cd /d "%~dp0"
if not exist ".env" (
  echo .env not found. Run setup.bat first.
  exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"

where sqlcmd >nul 2>nul
if errorlevel 1 (
  echo sqlcmd was not found. Open db\01_schema.sql and then db\02_seed.sql in SSMS and run each one.
  exit /b 1
)

echo Rebuilding database on %DB_SERVER% ...
for %%f in (db\*.sql) do (
  echo   running %%f
  sqlcmd -S "%DB_SERVER%" -E -b -i "%%f"
  if errorlevel 1 (
    echo.
    echo Failed on %%f. Check DB_SERVER in .env, or run the scripts in SSMS instead.
    exit /b 1
  )
)
echo Done.
