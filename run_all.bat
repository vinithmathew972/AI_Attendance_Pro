@echo off
title Gateway Software Solutions - AI Attendance System Launcher
echo =====================================================================
echo  Gateway Software Solutions - Launching Complete Attendance System
echo =====================================================================
echo.
echo Starting Backend (FastAPI on Port 8000)...
start "Gateway Attendance Backend" cmd /k "%~dp0run_backend.bat"

timeout /t 3 /nobreak >nul

echo Starting Frontend (React on Port 5173)...
start "Gateway Attendance Frontend" cmd /k "%~dp0run_frontend.bat"

echo.
echo System launched!
echo - Frontend Dashboard: http://localhost:5173
echo - Backend API Docs:   http://127.0.0.1:8000/docs
echo.
echo CEO Credentials:
echo - Email:    ceo@gatewaysoftware.com
echo - Password: AdminPassword123!
echo.
