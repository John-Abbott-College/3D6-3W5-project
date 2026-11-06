@echo off
rem INSTRUCTOR ONLY. Builds toolchain.zip (portable DAB + ASP.NET Core runtime) in the repo root.
rem Needs: .NET SDK installed on this machine, and internet access.
setlocal
cd /d "%~dp0.."

rem DAB 2.x targets .NET 10. If you change DAB_VERSION, check the "tools\netNN.0" folder in the shim
rem printed below and set DOTNET_CHANNEL to match.
set "DAB_VERSION=2.1.5"
set "DOTNET_CHANNEL=10.0"

if exist build rmdir /s /q build
mkdir build\dab-tool

echo Installing DAB %DAB_VERSION% into build\dab-tool ...
dotnet tool install --tool-path build\dab-tool Microsoft.DataApiBuilder --version %DAB_VERSION%
if not %errorlevel%==0 goto :fail

echo Installing ASP.NET Core %DOTNET_CHANNEL% runtime into build\dab-tool\dotnet ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest https://dot.net/v1/dotnet-install.ps1 -OutFile build\dotnet-install.ps1"
if not %errorlevel%==0 goto :fail
powershell -NoProfile -ExecutionPolicy Bypass -File build\dotnet-install.ps1 -Channel %DOTNET_CHANNEL% -Runtime aspnetcore -Architecture x64 -InstallDir "%CD%\build\dab-tool\dotnet"
if not %errorlevel%==0 goto :fail

echo.
echo Checking install...
if not exist build\dab-tool\dab.cmd (
  echo ERROR: build\dab-tool\dab.cmd was not created.
  goto :fail
)
echo --- dab.cmd contents ^(the tools\netNN.0 part must match DOTNET_CHANNEL^) ---
type build\dab-tool\dab.cmd
echo ----------------------------------------------------------------------------
findstr /l /i /c:"%CD%" build\dab-tool\dab.cmd >nul && echo WARNING: dab.cmd contains an absolute path to this machine and may not work after unzipping elsewhere.

echo.
echo Testing with the bundled runtime only...
set "DOTNET_ROOT=%CD%\build\dab-tool\dotnet"
set "PATH=%CD%\build\dab-tool;%CD%\build\dab-tool\dotnet;%PATH%"
call dab --version
rem NOTE: .NET launcher failures return NEGATIVE exit codes, so test for "not 0", not "errorlevel 1"
if not %errorlevel%==0 goto :fail

echo.
echo Zipping...
if exist toolchain.zip del toolchain.zip
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path build\dab-tool -DestinationPath toolchain.zip -Force"
if not %errorlevel%==0 goto :fail
echo.
echo Created toolchain.zip. SHA-256 (paste into setup.bat TOOLCHAIN_SHA256 if you want a check):
certutil -hashfile toolchain.zip SHA256
echo Upload toolchain.zip as a GitHub Release asset (or a school share) and set TOOLCHAIN_URL in setup.bat.
exit /b 0

:fail
echo.
echo Build failed. Do not use toolchain.zip if one exists from an earlier run.
if exist toolchain.zip del toolchain.zip
exit /b 1
