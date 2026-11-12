
@echo off
title Gateway Software Solutions - Attendance Backend
echo ============================================================
echo  Gateway Software Solutions - Attendance Backend
echo ============================================================
echo.

cd /d "%~dp0"
set PERSISTENT_BACKUP_DIR=%~dp0backups\permanent_deletion_backups

echo Starting FastAPI backend on port 8001...
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload

pause
