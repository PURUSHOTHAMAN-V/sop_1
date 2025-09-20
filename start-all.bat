@echo off
echo Starting Retreivo Services...

echo.
echo Starting Backend Server...
start "Retreivo Backend" cmd /k "cd /d sop\retreivo-backend && set PORT=5000 && npm run dev"

timeout /t 3 /nobreak > nul

echo.
echo Starting ML Service...
start "Retreivo ML Service" cmd /k "cd /d sop\ml-service && set PORT=8000 && python app.py"

timeout /t 3 /nobreak > nul

echo.
echo Starting Frontend Server...
start "Retreivo Frontend" cmd /k "cd /d sop\retreivo-frontend && npm run dev"

echo.
echo All services are starting...
echo.
echo Access Points:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:5000
echo - ML Service: http://localhost:8000
echo.
echo Press any key to exit...
pause > nul