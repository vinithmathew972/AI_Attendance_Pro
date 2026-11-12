@echo off
title Gateway Software Solutions - Attendance Frontend (React + Vite)
echo =====================================================================
echo  Gateway Software Solutions - Attendance Frontend Dashboard
echo =====================================================================
echo.
cd /d "%~dp0frontend"
echo Starting Vite development server on http://localhost:5173 ...
npm run dev -- --host 0.0.0.0 --port 5173
pause
