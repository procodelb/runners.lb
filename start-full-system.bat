@echo off
echo Starting Soufian ERP Full System with Neon PostgreSQL...
echo.
echo Starting Server...
start "Soufian ERP Server" cmd /k "start-server.bat"
timeout /t 5 /nobreak >nul
echo.
echo Starting Client...
start "Soufian ERP Client" cmd /k "start-client.bat"
echo.
echo Both server and client are starting...
echo Server: http://localhost:5000
echo Client: http://localhost:5175
echo.
echo Login credentials:
echo Email: soufian@gmail.com
echo Password: Soufi@n123
echo.
pause
