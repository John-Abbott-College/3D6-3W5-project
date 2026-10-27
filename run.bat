@echo off
cd /d "%~dp0"
if not exist ".env" (
  echo .env not found. Run setup.bat first.
  exit /b 1
)
rem Load KEY=VALUE lines from .env into this window (lines starting with # are skipped)
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"

set "DOTNET_ROOT=%~dp0.tools\dab-tool\dotnet"
set "PATH=%~dp0.tools\dab-tool;%DOTNET_ROOT%;%PATH%"

echo Starting DAB on http://localhost:5000  (Ctrl+C to stop)
echo REST:    http://localhost:5000/api/Student
echo Swagger: http://localhost:5000/swagger
echo GraphQL: http://localhost:5000/graphql
echo.
dab start --config dab-config.json
