echo Stopping DAB.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5000" ^| findstr LISTENING') do (
    taskkill /F /PID %%p
)
echo Stopped.