@echo off
rem INSTRUCTOR ONLY. Builds toolchain.zip (portable DAB + ASP.NET Core runtime) in the repo root.
rem Needs: .NET SDK installed on this machine, and internet access.
setlocal
cd /d "%~dp0.."

if exist build rmdir /s /q build
mkdir build\dab-tool

echo Installing DAB into build\dab-tool ...
dotnet tool install --tool-path build\dab-tool Microsoft.DataApiBuilder
if errorlevel 1 goto :fail

echo Installing ASP.NET Core 9.0 runtime into build\dab-tool\dotnet ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest https://dot.net/v1/dotnet-install.ps1 -OutFile build\dotnet-install.ps1"
if errorlevel 1 goto :fail
powershell -NoProfile -ExecutionPolicy Bypass -File build\dotnet-install.ps1 -Channel 9.0 -Runtime aspnetcore -Architecture x64 -InstallDir "%CD%\build\dab-tool\dotnet"
if errorlevel 1 goto :fail

echo Testing...
set "DOTNET_ROOT=%CD%\build\dab-tool\dotnet"
"%CD%\build\dab-tool\dab.exe" --version
if errorlevel 1 goto :fail

echo Zipping...
if exist toolchain.zip del toolchain.zip
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path build\dab-tool -DestinationPath toolchain.zip -Force"
echo.
echo Created toolchain.zip. SHA-256 (paste into setup.bat TOOLCHAIN_SHA256 if you want a check):
certutil -hashfile toolchain.zip SHA256
echo Upload toolchain.zip as a GitHub Release asset (or a school share) and set TOOLCHAIN_URL in setup.bat.
exit /b 0

:fail
echo Build failed.
exit /b 1
