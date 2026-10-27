@echo off
title Gateway Software Solutions - Attendance Backend (FastAPI)
echo =====================================================================
echo  Gateway Software Solutions - Attendance Management Backend
echo =====================================================================
echo.
cd /d "%~dp0backend"
echo [1/2] Checking database and seeding initial records...
python seed_data.py
echo.
echo [2/2] Launching FastAPI backend server on http://127.0.0.1:8000 ...
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
