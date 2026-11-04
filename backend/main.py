import os
import io
import csv
import json
import datetime
import base64
import sqlite3
import tempfile
import threading
import shutil
import numpy as np
from typing import Optional, List, Union
from starlette.background import BackgroundTask
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import engine, Base, get_db, BASE_DIR, DB_PATH
from models import User, Employee, Attendance, AuditLog, Department, BackupLog
from schemas import (
    LoginRequest, TokenResponse, UserOut, ChangePasswordRequest,
    DepartmentCreate, DepartmentUpdate, DepartmentOut,
    EmployeeCreate, EmployeeUpdate, EmployeeOut, EmployeeResignRequest, FaceRegistrationPayload,
    RecognizeFrameRequest, FrameRecognitionResponse, RecognizedFace, FaceDetectionBox,
    CheckInRequest, CheckOutRequest, AttendanceOut, DashboardStats, BackupStatusResponse
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_current_ceo
)
import face_service
from init_db import initialize_database

# Create tables
Base.metadata.create_all(bind=engine)

# Safely add columns to existing SQLite database for permanent employee & resignation management
with engine.begin() as conn:
    emp_columns = [
        row[1]
        for row in conn.exec_driver_sql("PRAGMA table_info(employees)").fetchall()
    ]

    if "face_image" not in emp_columns:
        conn.exec_driver_sql(
            "ALTER TABLE employees ADD COLUMN face_image BLOB"
        )
    if "employment_status" not in emp_columns:
        conn.exec_driver_sql(
            "ALTER TABLE employees ADD COLUMN employment_status VARCHAR(50) DEFAULT 'Active'"
        )
    if "resignation_date" not in emp_columns:
        conn.exec_driver_sql(
            "ALTER TABLE employees ADD COLUMN resignation_date DATETIME"
        )
    if "resignation_reason" not in emp_columns:
        conn.exec_driver_sql(
            "ALTER TABLE employees ADD COLUMN resignation_reason TEXT"
        )

    # Sync any pre-existing inactive employees to have Resigned status if unset
    conn.exec_driver_sql(
        "UPDATE employees SET employment_status = 'Active' WHERE employment_status IS NULL AND is_active = 1"
    )
    conn.exec_driver_sql(
        "UPDATE employees SET employment_status = 'Resigned' WHERE (employment_status IS NULL OR employment_status = 'Active') AND is_active = 0"
    )

    user_columns = [
        row[1]
        for row in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
    ]
    if "is_active" not in user_columns:
        conn.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"
        )

# Initialize database only after schema update
initialize_database()

app = FastAPI(
    title="Gateway Software Solutions - AI Attendance Management API",
    description="Enterprise Biometric Facial Recognition & Workforce Attendance Management System",
    version="2.1.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


# Helper: resolve active employee by integer id or string employee_id
def resolve_employee(identifier: Union[int, str], db: Session) -> Optional[Employee]:
    # Try integer primary key first if int or numeric string
    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        emp = db.query(Employee).filter(
            Employee.id == int(identifier),
            Employee.is_active == True,
            (Employee.employment_status == "Active") | (Employee.employment_status.is_(None))
        ).first()
        if emp:
            return emp
    # Fallback to employee_id string (e.g. GSS-1001)
    return db.query(Employee).filter(
        Employee.employee_id == str(identifier),
        Employee.is_active == True,
        (Employee.employment_status == "Active") | (Employee.employment_status.is_(None))
    ).first()

# Helper: lookup employee by id or permanent GSS employee_id regardless of status (Active or Resigned)
def get_employee_by_identifier(identifier: Union[int, str], db: Session) -> Optional[Employee]:
    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        emp = db.query(Employee).filter(Employee.id == int(identifier)).first()
        if emp:
            return emp
    return db.query(Employee).filter(Employee.employee_id == str(identifier)).first()


# ==========================================
# 1. AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/auth/login", response_model=TokenResponse, tags=["Authentication"])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates the CEO and returns a secure JWT bearer token."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials."
        )

    if user.role != "CEO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Only Gateway Software Solutions CEO is authorized to access the management platform."
        )

    if hasattr(user, "is_active") and user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated or resigned. Login access is disabled."
        )

    resigned_emp = db.query(Employee).filter(
        Employee.email == user.email,
        (Employee.employment_status == "Resigned") | (Employee.is_active == False)
    ).first()
    if resigned_emp and user.role != "CEO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login access is disabled for resigned employees."
        )

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})

    # Log CEO login event
    audit = AuditLog(
        action="CEO_LOGIN",
        details=f"CEO {user.full_name} authenticated successfully.",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    }

@app.get("/api/auth/me", response_model=UserOut, tags=["Authentication"])
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/api/auth/change-password", tags=["Authentication"])
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """Allows authenticated CEO to securely update their account password."""
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match.")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")
    if not verify_password(payload.current_password, current_ceo.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_ceo.hashed_password = hash_password(payload.new_password)
    db.commit()

    audit = AuditLog(
        action="CEO_PASSWORD_CHANGED",
        details=f"CEO {current_ceo.email} updated their password successfully.",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return {"message": "CEO password changed successfully."}

def format_time_12h(time_str: Optional[str]) -> str:
    """Formats 24h 'HH:MM:SS' or 'HH:MM' into India 12h format with AM/PM e.g. '09:30 AM'."""
    if not time_str or str(time_str).strip() in ("N/A", "--", "None", ""):
        return "N/A"
    try:
        parts = str(time_str).strip().split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        ampm = "PM" if h >= 12 else "AM"
        h12 = h % 12
        h12 = 12 if h12 == 0 else h12
        return f"{h12:02d}:{m:02d} {ampm}"
    except Exception:
        return str(time_str)


# ==========================================
# 2. DEPARTMENT MANAGEMENT ENDPOINTS (DYNAMIC)
# ==========================================

@app.get("/api/departments", response_model=List[DepartmentOut], tags=["Departments"])
def list_departments(db: Session = Depends(get_db)):
    """List all active departments with employee counts dynamically."""
    depts = db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()
    result = []
    for d in depts:
        count = db.query(Employee).filter(Employee.department == d.name, Employee.is_active == True).count()
        result.append(DepartmentOut(
            id=d.id,
            name=d.name,
            description=d.description,
            is_active=d.is_active,
            created_at=d.created_at,
            employee_count=count
        ))
    return result

@app.get("/api/admin/database-backup", tags=["Admin"])
def download_database_backup(
    current_ceo: User = Depends(get_current_ceo)
):
    db_path = os.path.join(BASE_DIR, "gateway_attendance.db")

    if not os.path.exists(db_path):
        raise HTTPException(
            status_code=404,
            detail="Database file not found."
        )

    temp_file = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".db"
    )
    backup_path = temp_file.name
    temp_file.close()

    try:
        with sqlite3.connect(db_path) as source_db:
            with sqlite3.connect(backup_path) as backup_db:
                source_db.backup(backup_db)

        return FileResponse(
            path=backup_path,
            filename="gateway_attendance_backup.db",
            media_type="application/octet-stream",
            background=BackgroundTask(os.remove, backup_path)
        )

    except Exception:
        if os.path.exists(backup_path):
            os.remove(backup_path)

        raise HTTPException(
            status_code=500,
            detail="Database backup failed."
        )

@app.post("/api/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED, tags=["Departments"])
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """Allows CEO to create a new custom department dynamically."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Department name cannot be empty.")

    existing = db.query(Department).filter(func.lower(Department.name) == func.lower(name_clean)).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            if payload.description:
                existing.description = payload.description
            db.commit()
            db.refresh(existing)
            count = db.query(Employee).filter(Employee.department == existing.name, Employee.is_active == True).count()
            return DepartmentOut(
                id=existing.id,
                name=existing.name,
                description=existing.description,
                is_active=existing.is_active,
                created_at=existing.created_at,
                employee_count=count
            )
        raise HTTPException(status_code=400, detail=f"Department '{name_clean}' already exists.")

    new_dept = Department(
        name=name_clean,
        description=payload.description or f"{name_clean} department",
        is_active=True,
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)

    audit = AuditLog(
        action="CREATE_DEPARTMENT",
        details=f"Created department: {new_dept.name}",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return DepartmentOut(
        id=new_dept.id,
        name=new_dept.name,
        description=new_dept.description,
        is_active=new_dept.is_active,
        created_at=new_dept.created_at,
        employee_count=0
    )

@app.put("/api/departments/{id}", response_model=DepartmentOut, tags=["Departments"])
def update_department(
    id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """Allows CEO to rename or update a department, propagating changes to employee records."""
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    old_name = dept.name
    if payload.name and payload.name.strip():
        new_name = payload.name.strip()
        if new_name != old_name:
            clash = db.query(Department).filter(
                func.lower(Department.name) == func.lower(new_name),
                Department.id != id
            ).first()
            if clash:
                raise HTTPException(status_code=400, detail=f"Department '{new_name}' already exists.")

            dept.name = new_name
            # Propagate name change to existing employees so employee records stay consistent!
            db.query(Employee).filter(Employee.department == old_name).update(
                {Employee.department: new_name}, synchronize_session='fetch'
            )

    if payload.description is not None:
        dept.description = payload.description
    if payload.is_active is not None:
        dept.is_active = payload.is_active

    dept.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(dept)

    count = db.query(Employee).filter(Employee.department == dept.name, Employee.is_active == True).count()
    return DepartmentOut(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        is_active=dept.is_active,
        created_at=dept.created_at,
        employee_count=count
    )

@app.delete("/api/departments/{id}", tags=["Departments"])
def delete_department(
    id: int,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """Deactivates a department."""
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    dept.is_active = False
    dept.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": f"Department '{dept.name}' deactivated successfully."}


# Helper: serialize employee to EmployeeOut schema with permanent status fields
def serialize_employee(emp: Employee) -> EmployeeOut:
    status_str = emp.employment_status or ("Active" if emp.is_active else "Resigned")
    return EmployeeOut(
        id=emp.id,
        employee_id=emp.employee_id,
        employee_code=emp.employee_id,
        name=emp.name,
        full_name=emp.name,
        first_name=emp.first_name,
        last_name=emp.last_name,
        email=emp.email,
        phone=emp.phone,
        department=emp.department,
        designation=emp.designation,
        shift_start_time=emp.shift_start_time,
        shift_end_time=emp.shift_end_time,
        photo_url=emp.photo_url,
        face_registered=emp.face_registered,
        consent_given=emp.consent_given,
        consent_timestamp=emp.consent_timestamp,
        is_active=emp.is_active,
        employment_status=status_str,
        resignation_date=emp.resignation_date,
        resignation_reason=emp.resignation_reason,
        created_at=emp.created_at
    )

def process_resignation(emp: Employee, reason: Optional[str], resign_dt: Optional[datetime.datetime], db: Session) -> EmployeeOut:
    """Helper to safely execute employee resignation while preserving permanent records and attendance history."""
    if emp.employment_status == "Resigned":
        raise HTTPException(
            status_code=400,
            detail=f"Employee {emp.name} ({emp.employee_id}) has already been marked as Resigned on {emp.resignation_date}."
        )

    # 1. Update status and retain permanent records
    emp.employment_status = "Resigned"
    emp.is_active = False
    emp.resignation_date = resign_dt or datetime.datetime.utcnow()
    emp.resignation_reason = reason or "Voluntary Resignation"

    # 2. Facial biometrics data retention policy:
    # Clear active vector encoding to prevent live kiosk recognition while keeping photo_url for visual record
    emp.face_registered = False
    emp.face_encoding = None

    # 3. Authentication Deactivation:
    # Disable user account if one exists with matching email to block login
    user_account = db.query(User).filter(User.email == emp.email).first()
    if user_account:
        user_account.is_active = False

    # 4. Audit Log
    audit = AuditLog(
        action="EMPLOYEE_RESIGNED",
        details=f"Permanent Employee {emp.name} ({emp.employee_id}) marked as Resigned by CEO. Reason: {emp.resignation_reason}. Login and Face Recognition access revoked.",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    db.refresh(emp)
    return serialize_employee(emp)

# ==========================================
# 3. EMPLOYEE MANAGEMENT ENDPOINTS (CEO ONLY)
# ==========================================

@app.get("/api/employees", response_model=List[EmployeeOut], tags=["Employees"])
def list_employees(
    department: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = Query("All", description="Employment status filter: All, Active, or Resigned"),
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    List Gateway Software Solutions employees with optional filtering by department, search, and status.
    Resigned employees remain permanently searchable by their original GSS Employee ID.
    Only authenticated CEO users have access to employee records.
    """
    query = db.query(Employee)
    
    # Filter by employment status if requested
    if status == "Active":
        query = query.filter(
            Employee.is_active == True,
            (Employee.employment_status == "Active") | (Employee.employment_status.is_(None))
        )
    elif status == "Resigned":
        query = query.filter(
            (Employee.employment_status == "Resigned") | (Employee.is_active == False)
        )
    # If status == "All" or None, list all permanent employee records

    if department and department != "All":
        query = query.filter(Employee.department == department)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Employee.name.ilike(search_fmt)) |
            (Employee.employee_id.ilike(search_fmt)) |
            (Employee.email.ilike(search_fmt)) |
            (Employee.designation.ilike(search_fmt))
        )
    emps = query.order_by(Employee.employee_id).all()
    return [serialize_employee(emp) for emp in emps]

@app.post("/api/employees", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED, tags=["Employees"])
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    Create a new employee profile.
    Permanent GSS Employee ID Policy:
    Every employee has a permanent unique GSS ID. Once assigned, the GSS ID must never
    be deleted or reused for another employee, even if the original employee has resigned.
    """
    emp_code = (payload.employee_id or payload.employee_code or "").upper().strip()
    if not emp_code:
        raise HTTPException(status_code=400, detail="Employee ID is required.")

    # Determine full name
    emp_name = payload.name
    if not emp_name:
        parts = [p for p in [payload.first_name, payload.last_name] if p]
        emp_name = " ".join(parts).strip()
    if not emp_name:
        raise HTTPException(status_code=400, detail="Employee Name is required.")

    # Check for duplicate Employee ID across ALL records (including resigned)
    existing_emp = db.query(Employee).filter(Employee.employee_id == emp_code).first()
    if existing_emp:
        if existing_emp.employment_status == "Resigned" or not existing_emp.is_active:
            raise HTTPException(
                status_code=400, 
                detail=f"Permanent Record Policy: GSS Employee ID '{emp_code}' is permanently reserved for resigned employee '{existing_emp.name}' and cannot be reused."
            )
        else:
            raise HTTPException(status_code=400, detail=f"Employee ID '{emp_code}' is already registered to an active employee.")

    existing_email = db.query(Employee).filter(Employee.email == payload.email.lower().strip()).first()
    if existing_email:
        raise HTTPException(status_code=400, detail=f"Email '{payload.email}' is already in use by employee '{existing_email.name}' ({existing_email.employee_id}).")

    shift_start = payload.shift_start_time or "09:00:00"
    if len(shift_start.split(":")) == 2:
        shift_start = f"{shift_start}:00"

    shift_end = payload.shift_end_time or "18:00:00"
    if len(shift_end.split(":")) == 2:
        shift_end = f"{shift_end}:00"

    new_emp = Employee(
        employee_id=emp_code,
        name=emp_name,
        email=payload.email.lower().strip(),
        phone=payload.phone,
        department=payload.department,
        designation=payload.designation,
        shift_start_time=shift_start,
        shift_end_time=shift_end,
        face_registered=False,
        consent_given=False,
        is_active=True,
        employment_status="Active",
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    audit = AuditLog(
        action="EMPLOYEE_CREATE",
        details=f"Created permanent employee {new_emp.name} ({new_emp.employee_id}) by CEO.",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return serialize_employee(new_emp)

@app.get("/api/employees/{employee_id}", response_model=EmployeeOut, tags=["Employees"])
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_employee(emp)

@app.put("/api/employees/{employee_id}", response_model=EmployeeOut, tags=["Employees"])
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Read-only check for resigned employees
    if emp.employment_status == "Resigned" or not emp.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"Employee '{emp.name}' ({emp.employee_id}) is Resigned. Resigned records are permanent and read-only."
        )

    if payload.name:
        emp.name = payload.name.strip()
    elif payload.first_name or payload.last_name:
        fn = payload.first_name or emp.first_name
        ln = payload.last_name or emp.last_name
        emp.name = f"{fn} {ln}".strip()

    if payload.email:
        new_email = payload.email.lower().strip()
        if new_email != emp.email:
            existing_email = db.query(Employee).filter(Employee.email == new_email, Employee.id != emp.id).first()
            if existing_email:
                raise HTTPException(status_code=400, detail=f"Email '{new_email}' is already in use by another employee.")
            emp.email = new_email
    if payload.phone is not None:
        emp.phone = payload.phone
    if payload.department:
        emp.department = payload.department
    if payload.designation:
        emp.designation = payload.designation
    if payload.shift_start_time:
        st = payload.shift_start_time
        emp.shift_start_time = st if len(st.split(":")) == 3 else f"{st}:00"
    if payload.shift_end_time:
        et = payload.shift_end_time
        emp.shift_end_time = et if len(et.split(":")) == 3 else f"{et}:00"
    if payload.is_active is not None and not payload.is_active:
        # If deactivated via update, process as resignation
        return process_resignation(emp, payload.resignation_reason or "Deactivated via profile update", None, db)

    emp.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(emp)

    return serialize_employee(emp)

@app.post("/api/employees/{employee_id}/resign", response_model=EmployeeOut, tags=["Employees"])
def resign_employee(
    employee_id: int,
    payload: EmployeeResignRequest,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    Mark an employee as Resigned:
    - Preserves employee details, permanent GSS ID, joining date, and all historical attendance records.
    - Disables employee login access and invalidates authentication sessions.
    - Revokes face recognition check-in permissions.
    - Resigned records remain permanently viewable and searchable in read-only mode.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    resign_date = None
    if payload.resignation_date:
        try:
            resign_date = datetime.datetime.fromisoformat(payload.resignation_date.replace("Z", "+00:00"))
        except Exception:
            resign_date = datetime.datetime.utcnow()

    return process_resignation(emp, payload.reason, resign_date, db)

@app.delete("/api/employees/{employee_id}", tags=["Employees"])
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    Permanent Employee Record Policy:
    Employees cannot be permanently deleted. Instead, the record is transitioned to 'Resigned'
    to preserve company attendance history and permanent GSS ID integrity.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.employment_status == "Resigned":
        return {"message": f"Employee {emp.name} ({emp.employee_id}) is already archived as Resigned."}

    process_resignation(emp, "Deactivated via Employee Archive by CEO", None, db)
    return {
        "message": f"Employee {emp.name} ({emp.employee_id}) marked as Resigned. Permanent record and attendance history preserved.",
        "employment_status": "Resigned"
    }

# =========================================================================
# 2.2. RESIGNED EMPLOYEE PERMANENT DELETION (CEO ONLY, STRICT VALIDATION)
# =========================================================================

# Concurrency lock and in-progress deletion tracking
# Note: Process-wide threading lock coordinates concurrent requests hitting this worker.
# In single-process deployments (like Render Free), this prevents simultaneous deletion attempts.
# Inside the database transaction, employee existence and status are re-verified atomically.
_deletion_lock = threading.Lock()
_active_deletions = set()

def get_verified_persistent_backup_dir() -> str:
    """
    Validates and returns the configured persistent backup directory.
    Safety Policy & Documentation:
    1. PERSISTENT_BACKUP_DIR must be explicitly configured in the environment pointing to a verified persistent disk mount.
    2. Note: Testing directory writability verifies filesystem access permissions, but cannot automatically prove
       that the underlying volume is a cloud persistent disk. The operator must ensure PERSISTENT_BACKUP_DIR
       points to an actual attached persistent mount path on Render (e.g. a Render Persistent Disk).
    3. Cannot default to BASE_DIR, tempfile, or ephemeral container root storage.
    4. If PERSISTENT_BACKUP_DIR is not configured, permanent deletion is aborted with HTTP 500
       to guarantee no irreversible deletion occurs without durable backup storage.
    5. Evaluated at runtime when permanent deletion is invoked; never at module import time,
       so application startup and unrelated services remain unaffected.
    """
    backup_dir = os.getenv("PERSISTENT_BACKUP_DIR")
    if not backup_dir or not str(backup_dir).strip():
        raise HTTPException(
            status_code=500,
            detail="Persistent backup storage is not configured: PERSISTENT_BACKUP_DIR environment variable is missing or empty. Permanent deletion is rejected to prevent irreversible data loss."
        )

    backup_dir = os.path.realpath(backup_dir.strip())

    # Reject temporary directories or ephemeral system /tmp
    temp_dir = os.path.realpath(tempfile.gettempdir())
    try:
        if os.path.commonpath([backup_dir, temp_dir]) == temp_dir:
            raise HTTPException(
                status_code=500,
                detail="Invalid backup configuration: PERSISTENT_BACKUP_DIR cannot be located within an ephemeral or system temporary directory."
            )
    except ValueError:
        pass  # Different drive letters on Windows

    try:
        os.makedirs(backup_dir, exist_ok=True)
        # Test writability with a small probe file
        test_probe = os.path.join(backup_dir, f".probe_write_{os.getpid()}")
        with open(test_probe, "w", encoding="utf-8") as f:
            f.write("probe")
        if os.path.exists(test_probe):
            os.remove(test_probe)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Persistent backup storage directory is inaccessible or not writable. Please check server storage configuration."
        )

    return backup_dir

def create_and_verify_point_in_time_backup(
    db: Session,
    employee_id: int,
    files_to_backup: Optional[List[str]] = None
) -> dict:
    """
    Creates a fresh, verified point-in-time database AND file backup prior to permanent deletion.
    - Requires PERSISTENT_BACKUP_DIR to be configured in verified persistent storage.
    - Rejects reliance on old or unverified backups.
    - Runs PRAGMA quick_check to verify cryptographic page integrity.
    - Audits table existence and verifies that backup row counts match live database.
    - Archives all associated physical snapshot and photo files into a dedicated backup folder.
    - Writes a recovery manifest documenting database and file recovery assets.
    - If persistent backup storage is unavailable or verification fails, aborts deletion.
    """
    durable_backup_dir = get_verified_persistent_backup_dir()

    timestamp_str = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_base = f"pre_delete_emp_{employee_id}_{timestamp_str}"
    backup_filename = f"{backup_base}.db"
    backup_path = os.path.join(durable_backup_dir, backup_filename)
    files_backup_dir = os.path.join(durable_backup_dir, f"{backup_base}_files")
    manifest_path = os.path.join(durable_backup_dir, f"{backup_base}_manifest.json")

    # 1. Capture live counts before backup
    live_emp_count = db.query(Employee).count()
    live_att_count = db.query(Attendance).count()

    # 2. Perform point-in-time online backup using SQLite backup API
    try:
        src = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        dst = sqlite3.connect(backup_path)
        try:
            with dst:
                src.backup(dst, pages=-1)
        finally:
            dst.close()
            src.close()
    except Exception:
        if os.path.exists(backup_path):
            try:
                os.remove(backup_path)
            except Exception:
                pass
        raise HTTPException(
            status_code=500,
            detail="Database backup creation failed. Permanent deletion aborted."
        )

    # 3. Verify database backup file integrity and counts
    try:
        verif = verify_sqlite_backup(backup_path)
        if not verif.get("verified"):
            raise ValueError("Backup verification returned unverified status.")

        # Ensure backup record counts match live database state
        if verif["employee_count"] != live_emp_count:
            raise ValueError("Backup employee count mismatch.")
        if verif["attendance_count"] != live_att_count:
            raise ValueError("Backup attendance count mismatch.")

    except Exception:
        if os.path.exists(backup_path):
            try:
                os.remove(backup_path)
            except Exception:
                pass
        raise HTTPException(
            status_code=500,
            detail="Database backup integrity verification failed. Permanent deletion aborted."
        )

    # 4. Back up associated physical files (if any exist) into persistent backup storage
    backed_up_file_records = []
    if files_to_backup:
        try:
            os.makedirs(files_backup_dir, exist_ok=True)
            for src_file in files_to_backup:
                if os.path.isfile(src_file):
                    dst_file = os.path.join(files_backup_dir, os.path.basename(src_file))
                    shutil.copy2(src_file, dst_file)
                    src_size = os.path.getsize(src_file)
                    dst_size = os.path.getsize(dst_file)
                    if src_size != dst_size:
                        raise ValueError(f"File copy verification size mismatch for {os.path.basename(src_file)}.")
                    backed_up_file_records.append({
                        "filename": os.path.basename(src_file),
                        "bytes": dst_size
                    })
        except Exception:
            # Clean up both DB backup and partial files backup
            if os.path.exists(backup_path):
                try:
                    os.remove(backup_path)
                except Exception:
                    pass
            if os.path.exists(files_backup_dir):
                try:
                    shutil.rmtree(files_backup_dir)
                except Exception:
                    pass
            raise HTTPException(
                status_code=500,
                detail="Physical file backup preservation failed. Permanent deletion aborted."
            )

    # 5. Write and verify complete recovery manifest
    recovery_scope = (
        f"COMPLETE (SQLite database snapshot + {len(backed_up_file_records)} physical snapshot/photo file(s))"
        if backed_up_file_records else
        "COMPLETE (SQLite database snapshot; employee had no separate physical snapshot/photo files)"
    )
    manifest_data = {
        "timestamp_utc": datetime.datetime.utcnow().isoformat(),
        "employee_id": employee_id,
        "database_backup": os.path.basename(backup_path),
        "database_file_size": os.path.getsize(backup_path),
        "live_employee_count": live_emp_count,
        "live_attendance_count": live_att_count,
        "files_backed_up": backed_up_file_records,
        "recovery_scope": recovery_scope,
        "verified": True
    }

    def _cleanup_current_backup_artifacts():
        """Safely cleans up only this specific operation's backup artifacts without deleting existing backups."""
        if os.path.exists(backup_path):
            try:
                os.remove(backup_path)
            except Exception:
                pass
        if os.path.exists(files_backup_dir):
            try:
                shutil.rmtree(files_backup_dir)
            except Exception:
                pass
        if os.path.exists(manifest_path):
            try:
                os.remove(manifest_path)
            except Exception:
                pass

    try:
        with open(manifest_path, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2)
    except Exception:
        _cleanup_current_backup_artifacts()
        raise HTTPException(
            status_code=500,
            detail="Recovery manifest creation failed. Permanent deletion aborted."
        )

    # 6. Verify that all backup artifacts (database, files, manifest) exist and are readable before allowing deletion
    try:
        # A. Database backup existence and readability
        if not os.path.isfile(backup_path) or os.path.getsize(backup_path) == 0:
            raise ValueError(f"Database backup '{os.path.basename(backup_path)}' is missing or unreadable.")
        with open(backup_path, "rb") as bf:
            header = bf.read(16)
            if not header.startswith(b"SQLite format 3"):
                raise ValueError("Database backup header corrupted.")

        # B. Files backup directory verification
        if backed_up_file_records:
            if not os.path.isdir(files_backup_dir):
                raise ValueError("Employee files backup directory is missing.")
            for rec in backed_up_file_records:
                copied_path = os.path.join(files_backup_dir, rec["filename"])
                if not os.path.isfile(copied_path) or os.path.getsize(copied_path) != rec["bytes"]:
                    raise ValueError(f"Backed up file '{rec['filename']}' is missing or corrupted.")
                with open(copied_path, "rb") as cf:
                    _ = cf.read(64)

        # C. Manifest existence, non-zero size, and readability
        if not os.path.isfile(manifest_path) or os.path.getsize(manifest_path) == 0:
            raise ValueError("Recovery manifest file is missing or empty.")
        with open(manifest_path, "r", encoding="utf-8") as mf:
            loaded_manifest = json.load(mf)
        if not loaded_manifest.get("verified") or loaded_manifest.get("employee_id") != employee_id:
            raise ValueError("Recovery manifest content verification failed.")

    except Exception:
        _cleanup_current_backup_artifacts()
        raise HTTPException(
            status_code=500,
            detail="Backup artifact verification failed. Permanent deletion aborted."
        )

    return {
        "database_backup": backup_path,
        "database_backup_filename": os.path.basename(backup_path),
        "files_backup_dir": files_backup_dir if backed_up_file_records else None,
        "manifest_path": manifest_path,
        "manifest_filename": os.path.basename(manifest_path),
        "verified": True,
        "employee_count": live_emp_count,
        "attendance_count": live_att_count,
        "files_backed_up_count": len(backed_up_file_records),
        "recovery_scope": recovery_scope
    }

def validate_and_resolve_upload_file(rel_url: str, employee_id: int) -> Optional[str]:
    """
    Strictly validates and resolves an upload file path:
    1. Resolves path using os.path.realpath().
    2. Validates path containment using os.path.commonpath() against approved UPLOADS_DIR.
    3. Verifies that the file name specifically belongs to the employee (e.g. emp_{id}_ or in_{id}_ / out_{id}_ / snap_{id}_).
    4. Never uses wildcards.
    5. Returns canonical path if valid and existing, else None.
    """
    if not rel_url or not isinstance(rel_url, str):
        return None

    clean_rel = rel_url.lstrip("/").replace("/", os.sep)
    target_path = os.path.realpath(os.path.join(BASE_DIR, clean_rel))
    approved_uploads = os.path.realpath(UPLOADS_DIR)

    # Path containment check using os.path.commonpath()
    try:
        if os.path.commonpath([target_path, approved_uploads]) != approved_uploads:
            return None
    except Exception:
        return None

    # Verify file exists and is a regular file
    if not os.path.isfile(target_path):
        return None

    # Filename must explicitly belong to this employee (no wildcards)
    fname = os.path.basename(target_path)
    allowed_prefixes = (
        f"emp_{employee_id}_",
        f"in_{employee_id}_",
        f"out_{employee_id}_",
        f"snap_{employee_id}_"
    )
    if not fname.startswith(allowed_prefixes):
        return None

    return target_path

@app.get("/api/employees/{employee_id}/deletion-preview", tags=["Employees"])
def get_employee_deletion_preview(
    employee_id: int,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    CEO-only endpoint to preview the impact of permanently deleting a Resigned employee.
    Strictly validates:
      employment_status == 'Resigned' AND is_active == False.
    Rejects Active employees with HTTP 400.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    # Strict validation: Require BOTH employment_status == 'Resigned' AND is_active == False
    if emp.employment_status != "Resigned" or emp.is_active is not False:
        raise HTTPException(
            status_code=400,
            detail=f"Permanent deletion rejected: Employee '{emp.name}' ({emp.employee_id}) must satisfy BOTH employment_status == 'Resigned' AND is_active == False. Current status: employment_status='{emp.employment_status}', is_active={emp.is_active}."
        )

    attendance_count = db.query(Attendance).filter(Attendance.employee_id == emp.id).count()

    return {
        "id": emp.id,
        "employee_id": emp.employee_id,
        "name": emp.name,
        "department": emp.department,
        "designation": emp.designation,
        "employment_status": emp.employment_status,
        "is_active": emp.is_active,
        "resignation_date": emp.resignation_date,
        "attendance_count": attendance_count,
        "photo_url": emp.photo_url
    }

@app.delete("/api/employees/{employee_id}/permanent", tags=["Employees"])
def permanently_delete_resigned_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    Permanently deletes a single Resigned employee and their associated records.
    Strict Security & Data Rules:
    1. Authenticated CEO users only.
    2. Concurrency Control: Prevents simultaneous deletion requests for the same employee via process lock.
    3. Re-validates employee existence and Resigned status inside the atomic transaction to prevent race conditions.
    4. Employee must exist and strictly satisfy BOTH employment_status == 'Resigned' AND is_active == False.
    5. Backup Freshness & Durability: Generates and verifies a fresh point-in-time backup of database AND files in PERSISTENT_BACKUP_DIR.
    6. Collects all attendance snapshot paths and photo paths into memory BEFORE deleting rows.
    7. Atomically deletes attendances first (FK safety), employee record second (purges BLOB & encoding), and inserts audit log.
    8. Automatically rolls back the transaction on any database failure.
    9. Does NOT query attendance records again after commit.
    10. Performs physical file deletion strictly AFTER database commit.
    11. Uses strict uploads-directory containment validation and employee prefix checks; never wildcards.
    12. Returns HTTP 207 Multi-Status on partial cleanup (files remaining) or HTTP 200 on complete cleanup.
    """
    # Concurrency Lock: Prevent simultaneous deletion requests for the same employee
    with _deletion_lock:
        if employee_id in _active_deletions:
            raise HTTPException(
                status_code=409,
                detail=f"Conflict: A deletion operation for employee ID {employee_id} is already in progress."
            )
        _active_deletions.add(employee_id)

    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found.")

        # Strict validation: Require BOTH employment_status == 'Resigned' AND is_active == False
        if emp.employment_status != "Resigned" or emp.is_active is not False:
            raise HTTPException(
                status_code=400,
                detail=f"Permanent deletion rejected: Employee '{emp.name}' ({emp.employee_id}) must satisfy BOTH employment_status == 'Resigned' AND is_active == False. Current status: employment_status='{emp.employment_status}', is_active={emp.is_active}."
            )

        emp_id_val = emp.id
        emp_code = emp.employee_id
        emp_name = emp.name
        had_biometrics = bool(emp.face_registered or emp.face_encoding or emp.face_image)

        # 1. Collect all candidate snapshot paths and profile photo into memory BEFORE deleting anything
        emp_attendances = db.query(Attendance).filter(Attendance.employee_id == emp_id_val).all()
        initial_att_ids = [att.id for att in emp_attendances]
        stored_snapshot_paths = [att.snapshot_path for att in emp_attendances if att.snapshot_path]
        stored_photo_url = emp.photo_url

        # Validate and resolve safe canonical paths belonging to this employee
        files_to_delete = []
        if stored_photo_url:
            safe_photo = validate_and_resolve_upload_file(stored_photo_url, emp_id_val)
            if safe_photo:
                files_to_delete.append(safe_photo)

        for sp in stored_snapshot_paths:
            safe_snap = validate_and_resolve_upload_file(sp, emp_id_val)
            if safe_snap:
                files_to_delete.append(safe_snap)

        files_to_delete = list(dict.fromkeys(files_to_delete))

        # 2. Fresh Point-In-Time Backup Generation & Verification in Verified Persistent Storage
        # Backs up both SQLite database AND all physical snapshot/photo files
        backup_result = create_and_verify_point_in_time_backup(
            db=db,
            employee_id=emp_id_val,
            files_to_backup=files_to_delete
        )

        # 3. Transactional Database Deletion with Strict Consistency Safeguards
        # In SQLAlchemy 2.0, previous query operations autobegan a transaction on db.
        # To establish a clean, explicit write transaction with with db.begin(), rollback the read state:
        if db.in_transaction():
            db.rollback()

        try:
            with db.begin():
                # Re-verify employee inside transaction to guard against concurrent status change or deletion
                emp_to_delete = db.query(Employee).filter(
                    Employee.id == emp_id_val,
                    Employee.employment_status == "Resigned",
                    Employee.is_active == False
                ).first()
                if not emp_to_delete:
                    raise HTTPException(
                        status_code=409,
                        detail="Concurrent modification detected: Employee record or status changed during processing."
                    )

                if emp_to_delete.photo_url != stored_photo_url:
                    raise HTTPException(
                        status_code=409,
                        detail="Concurrent modification detected: Employee profile photo changed during processing. Deletion aborted."
                    )

                # Verify attendance record set consistency inside transaction before deleting
                current_att_rows = db.query(Attendance).filter(Attendance.employee_id == emp_id_val).all()
                current_att_ids = [att.id for att in current_att_rows]
                if set(current_att_ids) != set(initial_att_ids):
                    raise HTTPException(
                        status_code=409,
                        detail="Concurrent modification detected: Attendance records changed during processing. Deletion aborted."
                    )

                # A. Delete dependent attendances first (satisfies foreign key constraints)
                deleted_attendance_count = db.query(Attendance).filter(
                    Attendance.employee_id == emp_id_val
                ).delete(synchronize_session=False)

                if deleted_attendance_count != len(initial_att_ids):
                    raise HTTPException(
                        status_code=409,
                        detail="Concurrent modification detected: Attendance deletion count mismatch. Deletion aborted."
                    )

                # B. Delete employee record (purges face_image BLOB and face_encoding from database)
                db.delete(emp_to_delete)

                # C. Insert audit trail documenting biometric removal (never logs raw bytes or float vectors)
                biometric_audit = "Biometric face vectors and image BLOBs were purged from database." if had_biometrics else "No registered biometrics were present."
                audit = AuditLog(
                    action="EMPLOYEE_PERMANENT_DELETE",
                    details=f"Permanent deletion of Resigned employee {emp_name} (ID: {emp_id_val}, Code: {emp_code}) executed by CEO {current_ceo.full_name} ({current_ceo.email}). Deleted {deleted_attendance_count} associated attendance record(s). {biometric_audit}",
                    timestamp=datetime.datetime.utcnow()
                )
                db.add(audit)

        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Database transaction failed and was rolled back."
            )

        # 4. Note: Attendances have been committed and deleted.
        # We do NOT query Attendance table again! All paths were already collected into memory.

        # 5. Perform physical file deletion strictly AFTER database commit
        removed_files = []
        failed_files = []

        for fpath in files_to_delete:
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
                    removed_files.append(os.path.basename(fpath))
            except Exception:
                failed_files.append({
                    "filename": os.path.basename(fpath),
                    "error": "File removal failed due to access restriction or file lock"
                })

        sanitized_backup_summary = {
            "verified": backup_result["verified"],
            "recovery_scope": backup_result["recovery_scope"],
            "database_backup": backup_result["database_backup_filename"],
            "manifest": backup_result["manifest_filename"],
            "files_backed_up_count": backup_result["files_backed_up_count"]
        }

        # 6. Response Handling
        # If any physical file failed to remove, return HTTP 207 Multi-Status
        if failed_files:
            return JSONResponse(
                status_code=207,
                content={
                    "success": True,
                    "partial_success": True,
                    "message": f"Resigned employee {emp_name} ({emp_code}) database record and {deleted_attendance_count} attendance records permanently deleted. However, {len(failed_files)} physical snapshot file(s) could not be removed from disk.",
                    "deleted_employee_id": emp_id_val,
                    "deleted_employee_code": emp_code,
                    "deleted_attendances": deleted_attendance_count,
                    "biometrics_purged": had_biometrics,
                    "backup": sanitized_backup_summary,
                    "files_removed_count": len(removed_files),
                    "failed_file_count": len(failed_files),
                    "files_removed": removed_files,
                    "files_failed_removal": failed_files,
                    "all_files_removed": False
                }
            )

        return {
            "success": True,
            "partial_success": False,
            "message": f"Resigned employee {emp_name} ({emp_code}) permanently deleted.",
            "deleted_employee_id": emp_id_val,
            "deleted_employee_code": emp_code,
            "deleted_attendances": deleted_attendance_count,
            "biometrics_purged": had_biometrics,
            "backup": sanitized_backup_summary,
            "files_removed_count": len(removed_files),
            "failed_file_count": 0,
            "files_removed": removed_files,
            "files_failed_removal": [],
            "all_files_removed": True
        }

    finally:
        with _deletion_lock:
            _active_deletions.discard(employee_id)

@app.post("/api/employees/{employee_id}/register-face", tags=["Face Registration"])
def register_employee_face(
    employee_id: int,
    payload: FaceRegistrationPayload,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.employment_status == "Resigned" or not emp.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"Face registration denied: Employee '{emp.name}' ({emp.employee_id}) is Resigned. Biometric enrollment is only allowed for Active employees."
        )

    if not payload.consent:
        raise HTTPException(
            status_code=400,
            detail="Biometric consent is mandatory before capturing and storing employee face recognition data."
        )

    try:
        rgb_image = face_service.decode_base64_image(payload.image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decoding failed: {str(e)}")

    encoding, box, error = face_service.extract_face_encoding(rgb_image)
    if error:
        raise HTTPException(status_code=400, detail=error)

    photo_url = face_service.save_face_profile_image(payload.image_base64, employee_id)

    emp.face_image = base64.b64decode(payload.image_base64.split(",")[-1])
    emp.face_encoding = json.dumps(encoding)
    emp.face_registered = True
    emp.consent_given = True
    emp.consent_timestamp = datetime.datetime.utcnow()
    if photo_url:
        emp.photo_url = photo_url
    emp.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(emp)

    audit = AuditLog(
        action="FACE_REGISTERED",
        details=f"Face biometrics registered with consent for {emp.name} ({emp.employee_id})",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Face registered successfully for {emp.name}!",
        "employee_id": emp.id,
        "photo_url": emp.photo_url,
        "box": box
    }

@app.delete("/api/employees/{employee_id}/face", tags=["Face Registration"])
def remove_employee_face(
    employee_id: int,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()

    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Clear all stored biometric data
    emp.face_encoding = None
    emp.face_image = None
    emp.face_registered = False
    emp.consent_given = False
    emp.consent_timestamp = None
    emp.updated_at = datetime.datetime.utcnow()

    db.commit()

    audit = AuditLog(
        action="FACE_REMOVED",
        details=f"Face biometric data removed for {emp.name} ({emp.employee_id}) by CEO.",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Face biometric data cleared for {emp.name}."
    }

@app.get(
    "/api/admin/face-storage-status/{employee_code}",
    tags=["Face Registration"]
)
def get_face_storage_status(
    employee_code: str,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    CEO-only endpoint to verify whether employee face image
    is stored in the SQLite BLOB column.

    Does not expose the actual image or face encoding.
    """

    emp = db.query(Employee).filter(
        Employee.employee_id == employee_code
    ).first()

    if not emp:
        raise HTTPException(
            status_code=404,
            detail="Employee not found."
        )

    image_bytes = len(emp.face_image) if emp.face_image else 0

    return {
        "employee_id": emp.employee_id,
        "employee_name": emp.name,
        "face_registered": bool(emp.face_registered),
        "face_image_present": image_bytes > 0,
        "face_image_bytes": image_bytes,
        "face_encoding_present": bool(emp.face_encoding),
        "consent_given": bool(emp.consent_given)
    }


# ==========================================
# 2.4. DATABASE BACKUP MANAGEMENT (CEO ONLY)
# ==========================================

def format_file_size(size_bytes: int) -> str:
    """Formats raw byte counts into human-readable units (B, KB, MB)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{round(size_bytes / 1024.0, 1)} KB"
    else:
        return f"{round(size_bytes / (1024.0 * 1024.0), 2)} MB"

def cleanup_temp_backup(file_path: str):
    """Safely cleans up temporary SQLite backup file after response has streamed to client."""
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass

def verify_sqlite_backup(backup_path: str) -> dict:
    """
    Rigorously verifies SQLite backup file before delivery:
    1. Verifies physical file existence and non-zero byte size.
    2. Opens backup using SQLite engine and runs 'PRAGMA quick_check'.
    3. Confirms all required business tables exist (employees, attendances, users, departments).
    4. Confirms row counts and verifies BLOB face_image data integrity.
    """
    if not os.path.exists(backup_path):
        raise ValueError("Backup file was not created on disk.")
    
    file_size = os.path.getsize(backup_path)
    if file_size == 0:
        raise ValueError("Backup file is empty (0 bytes).")

    conn = sqlite3.connect(backup_path)
    try:
        cursor = conn.cursor()
        
        # 1. PRAGMA integrity check
        cursor.execute("PRAGMA quick_check")
        check_row = cursor.fetchone()
        if not check_row or check_row[0] != "ok":
            raise ValueError(f"SQLite PRAGMA integrity check failed: {check_row}")

        # 2. Check table schemas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall() if not row[0].startswith("sqlite_")]
        required = ["employees", "attendances", "users", "departments"]
        missing = [t for t in required if t not in tables]
        if missing:
            raise ValueError(f"Missing required tables in backup database: {', '.join(missing)}")

        # 3. Check records & BLOB data preservation
        cursor.execute("SELECT COUNT(*) FROM employees")
        emp_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM attendances")
        att_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM departments")
        dept_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM employees WHERE face_image IS NOT NULL")
        face_blob_count = cursor.fetchone()[0]

        total_records = emp_count + att_count + user_count + dept_count

        return {
            "verified": True,
            "file_size": file_size,
            "tables": tables,
            "employee_count": emp_count,
            "attendance_count": att_count,
            "face_blob_count": face_blob_count,
            "total_records": total_records
        }
    finally:
        conn.close()

@app.get("/api/admin/backup/status", response_model=BackupStatusResponse, tags=["Database Backup"])
def get_backup_status(
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    Retrieves the latest verified backup status, timestamp, size, and live database metrics.
    Only authorized Gateway Software Solutions CEO users have access.
    """
    live_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    
    last_backup = db.query(BackupLog).order_by(desc(BackupLog.created_at)).first()
    if not last_backup:
        return BackupStatusResponse(
            has_backup=False,
            live_db_size_bytes=live_size,
            live_db_size_formatted=format_file_size(live_size)
        )

    tables_list = [t.strip() for t in last_backup.tables_verified.split(",")] if last_backup.tables_verified else ["employees", "attendances", "users", "departments"]

    return BackupStatusResponse(
        has_backup=True,
        last_backup_at=last_backup.created_at,
        filename=last_backup.filename,
        file_size_bytes=last_backup.file_size_bytes,
        file_size_formatted=format_file_size(last_backup.file_size_bytes),
        status=last_backup.status,
        tables_verified=tables_list,
        records_count=last_backup.records_count,
        live_db_size_bytes=live_size,
        live_db_size_formatted=format_file_size(live_size)
    )

@app.get("/api/admin/backup/download", tags=["Database Backup"])
def download_database_backup(
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    Creates a point-in-time consistent SQLite backup using SQLite's online backup API,
    rigorously verifies file and table integrity, logs the event, and delivers a downloadable .db file.
    The temporary backup file is safely cleaned up immediately after transmission.
    """
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Live database file not found on server disk.")

    timestamp_str = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"gateway_attendance_backup_{timestamp_str}.db"
    
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".db", prefix="gss_backup_")
    temp_path = temp_file.name
    temp_file.close()

    try:
        # Perform point-in-time atomic online backup using SQLite backup API
        src_conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        dst_conn = sqlite3.connect(temp_path)
        try:
            with dst_conn:
                src_conn.backup(dst_conn, pages=-1)
        finally:
            dst_conn.close()
            src_conn.close()

        # Rigorous verification before delivery
        verif = verify_sqlite_backup(temp_path)

        # Record successful backup in BackupLog and AuditLog
        backup_entry = BackupLog(
            filename=backup_filename,
            file_size_bytes=verif["file_size"],
            status="Success",
            tables_verified=",".join(verif["tables"]),
            records_count=verif["total_records"],
            created_at=datetime.datetime.utcnow()
        )
        db.add(backup_entry)

        audit = AuditLog(
            action="DATABASE_BACKUP_DOWNLOAD",
            details=f"CEO {current_ceo.full_name} ({current_ceo.email}) generated and downloaded verified SQLite backup '{backup_filename}' ({format_file_size(verif['file_size'])}). Verified {len(verif['tables'])} tables and {verif['face_blob_count']} face BLOB images.",
            timestamp=datetime.datetime.utcnow()
        )
        db.add(audit)
        db.commit()

        # Return FileResponse with automated background cleanup task
        return FileResponse(
            path=temp_path,
            filename=backup_filename,
            media_type="application/x-sqlite3",
            background=BackgroundTask(cleanup_temp_backup, temp_path),
            headers={
                "Content-Disposition": f'attachment; filename="{backup_filename}"',
                "X-Backup-Size": str(verif["file_size"]),
                "X-Backup-Status": "Success"
            }
        )

    except Exception as e:
        cleanup_temp_backup(temp_path)
        fail_entry = BackupLog(
            filename=backup_filename,
            file_size_bytes=0,
            status="Failed",
            tables_verified="",
            records_count=0,
            created_at=datetime.datetime.utcnow()
        )
        db.add(fail_entry)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Database backup generation failed: {str(e)}")


# ==========================================
# 3. ATTENDANCE & FACE RECOGNITION ENDPOINTS
# ==========================================

@app.post("/api/attendance/recognize-frame", response_model=FrameRecognitionResponse, tags=["Attendance Kiosk"])
def recognize_frame(payload: RecognizeFrameRequest, db: Session = Depends(get_db)):
    """Matches live webcam video frames against enrolled employee face vectors."""
    try:
        rgb_img = face_service.decode_base64_image(payload.image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decoding failed: {str(e)}")

    registered_emps = db.query(Employee).filter(
        Employee.is_active == True,
        (Employee.employment_status == "Active") | (Employee.employment_status.is_(None)),
        Employee.face_registered == True,
        Employee.face_encoding.isnot(None)
    ).all()

    emp_list = []
    for emp in registered_emps:
        try:
            enc = np.array(json.loads(emp.face_encoding))
            emp_list.append({
                "id": emp.id,
                "employee_id": emp.employee_id,
                "employee_code": emp.employee_id,
                "name": emp.name,
                "department": emp.department,
                "designation": emp.designation,
                "photo_url": emp.photo_url,
                "encoding_np": enc
            })
        except Exception:
            continue

    matches, faces_count = face_service.match_face_in_frame(rgb_img, emp_list)

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    enriched_matches = []

    for m in matches:
        emp_id = m["employee_id"]
        already_in = False
        already_out = False
        check_in_time = None
        check_out_time = None
        today_status = None

        if emp_id > 0:
            att = db.query(Attendance).filter(
                Attendance.employee_id == emp_id,
                Attendance.attendance_date == today_str
            ).first()
            if att:
                already_in = bool(att.check_in_time)
                already_out = bool(att.check_out_time)
                check_in_time = att.check_in_time
                check_out_time = att.check_out_time
                today_status = att.attendance_status

        enriched_matches.append(RecognizedFace(
            employee_id=m["employee_id"],
            employee_code=m.get("employee_code") or m.get("employee_id") or "UNKNOWN",
            full_name=m["full_name"],
            department=m["department"],
            designation=m["designation"],
            photo_url=m["photo_url"],
            confidence=m["confidence"],
            distance=m["distance"],
            box=FaceDetectionBox(**m["box"]) if m["box"] else None,
            already_checked_in=already_in,
            already_checked_out=already_out,
            check_in_time=check_in_time,
            check_out_time=check_out_time,
            today_status=today_status
        ))

    message = "No faces detected" if faces_count == 0 else f"{faces_count} face(s) detected."
    return FrameRecognitionResponse(
        faces_detected=faces_count,
        matches=enriched_matches,
        message=message
    )

@app.post("/api/attendance/check-in", response_model=AttendanceOut, tags=["Attendance Kiosk"])
def mark_check_in(payload: CheckInRequest, db: Session = Depends(get_db)):
    """
    Records employee attendance Check-In:
    - Resolves employee by ID
    - Prevents duplicate check-ins for the same day
    - Calculates late arrivals and late_minutes based on employee shift start timing
    - Saves attendance in SQLite database
    """
    emp = resolve_employee(payload.employee_id, db)
    if not emp:
        resigned_check = get_employee_by_identifier(payload.employee_id, db)
        if resigned_check and (resigned_check.employment_status == "Resigned" or not resigned_check.is_active):
            raise HTTPException(
                status_code=403,
                detail=f"Attendance check-in denied: Employee '{resigned_check.name}' ({resigned_check.employee_id}) is Resigned. Resigned employees cannot record attendance."
            )
        raise HTTPException(status_code=404, detail=f"Employee '{payload.employee_id}' not found or inactive.")

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    now_dt = datetime.datetime.now()
    now_time = now_dt.strftime("%H:%M:%S")

    # 1. Prevent duplicate check-in today
    existing = db.query(Attendance).filter(
        Attendance.employee_id == emp.id,
        Attendance.attendance_date == today_str
    ).first()

    if existing and existing.check_in_time:
        raise HTTPException(
            status_code=400,
            detail=f"{emp.name} ({emp.employee_id}) has already checked in today at {existing.check_in_time}."
        )

    # 2. Calculate late arrivals based on employee shift timing
    shift_start_str = emp.shift_start_time or "09:00:00"
    try:
        parts = [int(p) for p in shift_start_str.split(":")[:2]]
        shift_hour = parts[0]
        shift_min = parts[1]
        shift_dt = now_dt.replace(hour=shift_hour, minute=shift_min, second=0, microsecond=0)
        
        diff_seconds = (now_dt - shift_dt).total_seconds()
        if diff_seconds > 0:
            late_minutes = int(diff_seconds // 60)
            # If after shift start time with standard 15 minute grace period
            attendance_status = "Late" if late_minutes > 15 else "Present"
        else:
            late_minutes = 0
            attendance_status = "Present"
    except Exception:
        late_minutes = 0
        attendance_status = "Present"

    # Save snapshot if supplied
    snapshot_path = None
    if payload.snapshot_base64:
        snapshot_path = face_service.save_snapshot_image(payload.snapshot_base64, prefix=f"in_{emp.id}")

    if existing:
        existing.check_in_time = now_time
        existing.attendance_status = attendance_status
        existing.late_minutes = late_minutes
        existing.confidence_score = payload.confidence or 98.5
        if snapshot_path:
            existing.snapshot_path = snapshot_path
        if payload.notes:
            existing.notes = payload.notes
        existing.updated_at = datetime.datetime.utcnow()
        att_record = existing
    else:
        att_record = Attendance(
            employee_id=emp.id,
            attendance_date=today_str,
            check_in_time=now_time,
            check_out_time=None,
            attendance_status=attendance_status,
            late_minutes=late_minutes,
            working_hours=0.0,
            confidence_score=payload.confidence or 98.5,
            verification_method="Face Recognition",
            snapshot_path=snapshot_path,
            notes=payload.notes or "Biometric face verification check-in."
        )
        db.add(att_record)

    db.commit()
    db.refresh(att_record)

    audit = AuditLog(
        action="ATTENDANCE_CHECK_IN",
        details=f"Check-In recorded for {emp.name} ({emp.employee_id}) at {now_time}. Status: {attendance_status}, Late: {late_minutes} min.",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return AttendanceOut(
        id=att_record.id,
        employee_id=emp.id,
        employee_code=emp.employee_id,
        employee_name=emp.name,
        department=emp.department,
        attendance_date=att_record.attendance_date,
        date=att_record.attendance_date,
        check_in_time=att_record.check_in_time,
        check_out_time=att_record.check_out_time,
        attendance_status=att_record.attendance_status,
        status=att_record.attendance_status,
        late_minutes=att_record.late_minutes,
        working_hours=att_record.working_hours,
        confidence_score=att_record.confidence_score,
        verification_method=att_record.verification_method,
        snapshot_path=att_record.snapshot_path,
        notes=att_record.notes
    )

@app.post("/api/attendance/check-out", response_model=AttendanceOut, tags=["Attendance Kiosk"])
def mark_check_out(payload: CheckOutRequest, db: Session = Depends(get_db)):
    """
    Records employee attendance Check-Out:
    - Resolves employee by ID
    - Validates employee has checked in today first
    - Prevents duplicate check-outs
    - Calculates total working hours
    - Saves attendance in SQLite database
    """
    emp = resolve_employee(payload.employee_id, db)
    if not emp:
        resigned_check = get_employee_by_identifier(payload.employee_id, db)
        if resigned_check and (resigned_check.employment_status == "Resigned" or not resigned_check.is_active):
            raise HTTPException(
                status_code=403,
                detail=f"Attendance check-out denied: Employee '{resigned_check.name}' ({resigned_check.employee_id}) is Resigned. Resigned employees cannot record attendance."
            )
        raise HTTPException(status_code=404, detail=f"Employee '{payload.employee_id}' not found or inactive.")

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    now_dt = datetime.datetime.now()
    now_time = now_dt.strftime("%H:%M:%S")

    existing = db.query(Attendance).filter(
        Attendance.employee_id == emp.id,
        Attendance.attendance_date == today_str
    ).first()

    # 1. Ensure employee has checked in today first
    if not existing or not existing.check_in_time:
        raise HTTPException(
            status_code=400,
            detail=f"{emp.name} ({emp.employee_id}) has not checked in today yet. Please check in first."
        )

    # 2. Prevent duplicate check-out today
    if existing.check_out_time:
        raise HTTPException(
            status_code=400,
            detail=f"{emp.name} ({emp.employee_id}) has already checked out today at {existing.check_out_time}."
        )

    # 3. Calculate working hours
    try:
        in_dt = datetime.datetime.strptime(existing.check_in_time, "%H:%M:%S")
        out_dt = datetime.datetime.strptime(now_time, "%H:%M:%S")
        diff_hours = round(max(0.0, (out_dt - in_dt).total_seconds() / 3600.0), 2)
    except Exception:
        diff_hours = 0.0

    existing.check_out_time = now_time
    existing.working_hours = diff_hours
    if existing.attendance_status == "Late":
        existing.attendance_status = "Late (Completed)"
    else:
        existing.attendance_status = "Completed"

    if payload.snapshot_base64:
        snap = face_service.save_snapshot_image(payload.snapshot_base64, prefix=f"out_{emp.id}")
        if snap:
            existing.snapshot_path = snap

    existing.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(existing)

    audit = AuditLog(
        action="ATTENDANCE_CHECK_OUT",
        details=f"Check-Out recorded for {emp.name} ({emp.employee_id}) at {now_time}. Total Hours: {diff_hours} hrs.",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return AttendanceOut(
        id=existing.id,
        employee_id=emp.id,
        employee_code=emp.employee_id,
        employee_name=emp.name,
        department=emp.department,
        attendance_date=existing.attendance_date,
        date=existing.attendance_date,
        check_in_time=existing.check_in_time,
        check_out_time=existing.check_out_time,
        attendance_status=existing.attendance_status,
        status=existing.attendance_status,
        late_minutes=existing.late_minutes,
        working_hours=existing.working_hours,
        confidence_score=existing.confidence_score,
        verification_method=existing.verification_method,
        snapshot_path=existing.snapshot_path,
        notes=existing.notes
    )

@app.get("/api/attendance/today", response_model=List[AttendanceOut], tags=["Attendance Records"])
def get_today_attendance(db: Session = Depends(get_db)):
    """Returns all attendance logs for the current day."""
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    records = db.query(Attendance).join(Employee).filter(
        Attendance.attendance_date == today_str
    ).order_by(desc(Attendance.created_at)).all()

    result = []
    for r in records:
        result.append(AttendanceOut(
            id=r.id,
            employee_id=r.employee_id,
            employee_code=r.employee.employee_id,
            employee_name=r.employee.name,
            department=r.employee.department,
            attendance_date=r.attendance_date,
            date=r.attendance_date,
            check_in_time=r.check_in_time,
            check_out_time=r.check_out_time,
            attendance_status=r.attendance_status,
            status=r.attendance_status,
            late_minutes=r.late_minutes,
            working_hours=r.working_hours,
            confidence_score=r.confidence_score,
            verification_method=r.verification_method,
            snapshot_path=r.snapshot_path,
            notes=r.notes
        ))
    return result

@app.get("/api/attendance/history", response_model=List[AttendanceOut], tags=["Attendance Records"])
def get_attendance_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department: Optional[str] = None,
    status_filter: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    query = db.query(Attendance).join(Employee)

    if start_date:
        query = query.filter(Attendance.attendance_date >= start_date)
    if end_date:
        query = query.filter(Attendance.attendance_date <= end_date)
    if department and department != "All":
        query = query.filter(Employee.department == department)
    if status_filter and status_filter != "All":
        query = query.filter(Attendance.attendance_status.ilike(f"%{status_filter}%"))
    if employee_id:
        query = query.filter(Attendance.employee_id == employee_id)

    records = query.order_by(desc(Attendance.attendance_date), desc(Attendance.check_in_time)).limit(300).all()

    result = []
    for r in records:
        result.append(AttendanceOut(
            id=r.id,
            employee_id=r.employee_id,
            employee_code=r.employee.employee_id,
            employee_name=r.employee.name,
            department=r.employee.department,
            attendance_date=r.attendance_date,
            date=r.attendance_date,
            check_in_time=r.check_in_time,
            check_out_time=r.check_out_time,
            attendance_status=r.attendance_status,
            status=r.attendance_status,
            late_minutes=r.late_minutes,
            working_hours=r.working_hours,
            confidence_score=r.confidence_score,
            verification_method=r.verification_method,
            snapshot_path=r.snapshot_path,
            notes=r.notes
        ))
    return result


# ==========================================
# 4. CEO DASHBOARD METRICS ENDPOINT
# ==========================================

@app.get("/api/dashboard/stats", response_model=DashboardStats, tags=["CEO Dashboard"])
@app.get("/api/attendance/stats", response_model=DashboardStats, tags=["CEO Dashboard"])
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """
    Computes comprehensive attendance and workforce analytics.
    Only authenticated CEO users can access dashboard statistics.
    """
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    active_employees = db.query(Employee).filter(
        Employee.is_active == True,
        (Employee.employment_status == "Active") | (Employee.employment_status.is_(None))
    ).count()
    resigned_employees = db.query(Employee).filter(
        (Employee.employment_status == "Resigned") | (Employee.is_active == False)
    ).count()
    total_permanent_records = db.query(Employee).count()
    total_employees = active_employees

    today_attendances = db.query(Attendance).join(Employee).filter(
        Employee.is_active == True,
        (Employee.employment_status == "Active") | (Employee.employment_status.is_(None)),
        Attendance.attendance_date == today_str
    ).all()
    present_today = len(today_attendances)
    absent_today = max(0, total_employees - present_today)

    late_today = sum(1 for a in today_attendances if (a.late_minutes > 15 or "Late" in (a.attendance_status or "")))
    currently_working = sum(1 for a in today_attendances if a.check_in_time and not a.check_out_time)

    attendance_rate = round((present_today / total_employees * 100.0), 1) if total_employees > 0 else 0.0

    # Department Statistics Breakdown
    dept_counts = db.query(
        Employee.department,
        func.count(Employee.id)
    ).filter(Employee.is_active == True).group_by(Employee.department).all()

    dept_stats = []
    for dept_name, count in dept_counts:
        present_in_dept = db.query(Attendance).join(Employee).filter(
            Attendance.attendance_date == today_str,
            Employee.department == dept_name,
            Employee.is_active == True
        ).count()
        rate = round((present_in_dept / count * 100.0), 1) if count > 0 else 0.0
        dept_stats.append({
            "department": dept_name,
            "total": count,
            "present": present_in_dept,
            "absent": max(0, count - present_in_dept),
            "rate": rate
        })

    # Weekly Trend (Past 7 Days)
    today = datetime.date.today()
    weekly_trend = []
    for i in range(6, -1, -1):
        day_date = today - datetime.timedelta(days=i)
        d_str = day_date.strftime("%Y-%m-%d")
        day_name = day_date.strftime("%a")

        day_records = db.query(Attendance).join(Employee).filter(
            Employee.is_active == True,
            Attendance.attendance_date == d_str
        ).all()
        pres = len(day_records)
        lt = sum(1 for a in day_records if (a.late_minutes > 15 or "Late" in (a.attendance_status or "")))
        absn = max(0, total_employees - pres)
        weekly_trend.append({
            "date": d_str,
            "day": day_name,
            "present": pres,
            "late": lt,
            "absent": absn
        })

    # Recent Punches Feed
    recent_records = db.query(Attendance).join(Employee).order_by(desc(Attendance.updated_at)).limit(10).all()
    recent_punches = []
    for r in recent_records:
        recent_punches.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "name": r.employee.name,
            "code": r.employee.employee_id,
            "department": r.employee.department,
            "photo_url": r.employee.photo_url,
            "date": r.attendance_date,
            "check_in_time": r.check_in_time,
            "check_out_time": r.check_out_time,
            "status": r.attendance_status,
            "late_minutes": r.late_minutes,
            "working_hours": r.working_hours,
            "action": "Check-Out" if r.check_out_time else "Check-In"
        })

    return DashboardStats(
        total_employees=total_employees,
        present_today=present_today,
        absent_today=absent_today,
        late_today=late_today,
        currently_working=currently_working,
        attendance_rate=attendance_rate,
        active_employees=active_employees,
        resigned_employees=resigned_employees,
        total_permanent_records=total_permanent_records,
        department_stats=dept_stats,
        weekly_trend=weekly_trend,
        recent_punches=recent_punches
    )

@app.get("/api/attendance/late-arrivals", tags=["CEO Dashboard"])
def get_late_arrivals(
    date: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """Fetches all late arrival records with search and filter capabilities."""
    target_date = date or datetime.date.today().strftime("%Y-%m-%d")
    query = db.query(Attendance).join(Employee).filter(
        Attendance.attendance_date == target_date,
        (Attendance.late_minutes > 15) | (Attendance.attendance_status.ilike("%Late%"))
    )
    if department and department != "All":
        query = query.filter(Employee.department == department)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Employee.name.ilike(search_fmt)) |
            (Employee.employee_id.ilike(search_fmt))
        )
    records = query.order_by(desc(Attendance.late_minutes)).all()
    
    result = []
    for r in records:
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_code": r.employee.employee_id,
            "employee_name": r.employee.name,
            "department": r.employee.department,
            "designation": r.employee.designation,
            "shift_start_time": r.employee.shift_start_time,
            "attendance_date": r.attendance_date,
            "check_in_time": r.check_in_time,
            "check_out_time": r.check_out_time,
            "late_minutes": r.late_minutes,
            "working_hours": r.working_hours,
            "attendance_status": r.attendance_status,
            "photo_url": r.employee.photo_url
        })
    return result

@app.get("/api/attendance/absent-employees", tags=["CEO Dashboard"])
def get_absent_employees(
    date: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """Fetches all active employees who have not checked in on the specified date."""
    target_date = date or datetime.date.today().strftime("%Y-%m-%d")
    
    # Subquery of present employee ids
    present_ids = [row[0] for row in db.query(Attendance.employee_id).filter(Attendance.attendance_date == target_date).all()]
    
    query = db.query(Employee).filter(
        Employee.is_active == True,
        (Employee.employment_status == "Active") | (Employee.employment_status.is_(None)),
        ~Employee.id.in_(present_ids)
    )
    if department and department != "All":
        query = query.filter(Employee.department == department)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Employee.name.ilike(search_fmt)) |
            (Employee.employee_id.ilike(search_fmt)) |
            (Employee.email.ilike(search_fmt))
        )
    absent_emps = query.order_by(Employee.department, Employee.employee_id).all()
    
    result = []
    for emp in absent_emps:
        result.append({
            "id": emp.id,
            "employee_id": emp.employee_id,
            "employee_code": emp.employee_id,
            "name": emp.name,
            "department": emp.department,
            "designation": emp.designation,
            "email": emp.email,
            "phone": emp.phone,
            "shift_start_time": emp.shift_start_time,
            "shift_end_time": emp.shift_end_time,
            "date": target_date,
            "status": "Absent",
            "photo_url": emp.photo_url
        })
    return result

@app.get("/api/attendance/currently-working", tags=["CEO Dashboard"])
def get_currently_working(
    date: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    """Fetches all staff currently on active shift (checked in without checkout)."""
    target_date = date or datetime.date.today().strftime("%Y-%m-%d")
    now_dt = datetime.datetime.now()
    
    query = db.query(Attendance).join(Employee).filter(
        Attendance.attendance_date == target_date,
        Attendance.check_in_time.isnot(None),
        Attendance.check_out_time.is_(None)
    )
    if department and department != "All":
        query = query.filter(Employee.department == department)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Employee.name.ilike(search_fmt)) |
            (Employee.employee_id.ilike(search_fmt))
        )
    records = query.order_by(Attendance.check_in_time).all()
    
    result = []
    for r in records:
        # Calculate active elapsed duration
        try:
            t_in = datetime.datetime.strptime(r.check_in_time, "%H:%M:%S")
            now_t = datetime.datetime.strptime(now_dt.strftime("%H:%M:%S"), "%H:%M:%S")
            elapsed_hrs = round(max(0.0, (now_t - t_in).total_seconds() / 3600.0), 2)
        except Exception:
            elapsed_hrs = 0.0

        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_code": r.employee.employee_id,
            "employee_name": r.employee.name,
            "department": r.employee.department,
            "designation": r.employee.designation,
            "shift_start_time": r.employee.shift_start_time,
            "shift_end_time": r.employee.shift_end_time,
            "attendance_date": r.attendance_date,
            "check_in_time": r.check_in_time,
            "elapsed_hours": elapsed_hrs,
            "attendance_status": r.attendance_status,
            "photo_url": r.employee.photo_url,
            "notes": r.notes
        })
    return result

@app.get("/api/attendance/export", tags=["Attendance Records"])
def export_attendance_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    query = db.query(Attendance).join(Employee)
    if start_date:
        query = query.filter(Attendance.attendance_date >= start_date)
    if end_date:
        query = query.filter(Attendance.attendance_date <= end_date)
    if department and department != "All":
        query = query.filter(Employee.department == department)
    if status_filter and status_filter != "All":
        query = query.filter(Attendance.attendance_status.ilike(f"%{status_filter}%"))
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Employee.name.ilike(search_fmt)) |
            (Employee.employee_id.ilike(search_fmt))
        )

    records = query.order_by(desc(Attendance.attendance_date), desc(Attendance.check_in_time)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Record ID", "Employee ID", "Employee Name", "Department",
        "Attendance Date", "Check-In Time", "Check-Out Time", "Status", "Late Minutes", "Working Hours", "Method"
    ])

    for r in records:
        writer.writerow([
            r.id,
            r.employee.employee_id,
            r.employee.name,
            r.employee.department,
            r.attendance_date,
            format_time_12h(r.check_in_time) if r.check_in_time else "N/A",
            format_time_12h(r.check_out_time) if r.check_out_time else "N/A",
            r.attendance_status,
            r.late_minutes,
            f"{r.working_hours:.2f}" if r.working_hours else "0.00",
            r.verification_method
        ])

    output.seek(0)
    filename = f"Gateway_Attendance_Report_{datetime.date.today().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/audit-logs", tags=["Audit"])
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_ceo: User = Depends(get_current_ceo)
):
    return db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()

@app.get("/api/health", tags=["System"])
def health_check():
    return {
        "status": "online",
        "system": "Gateway Software Solutions Attendance Engine",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }


# ==========================================
# 5. REACT FRONTEND SERVING
# ==========================================

# Project root contains both backend/ and frontend/
PROJECT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST_DIR = (PROJECT_DIR / "frontend" / "dist").resolve()


@app.get("/", include_in_schema=False)
def serve_frontend():
    """Serve the React application homepage."""
    index_file = FRONTEND_DIST_DIR / "index.html"

    if not index_file.is_file():
        raise HTTPException(
            status_code=503,
            detail=(
                "Frontend build not found. "
                "Run 'npm run build' inside the frontend folder."
            ),
        )

    return FileResponse(index_file)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend_routes(full_path: str):
    """Serve frontend assets and support React client-side routes."""

    # Do not turn unknown API requests into frontend pages.
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(
            status_code=404,
            detail="API endpoint not found",
        )

    # Resolve the requested file safely inside frontend/dist.
    requested_file = (FRONTEND_DIST_DIR / full_path).resolve()

    if (
        requested_file.is_relative_to(FRONTEND_DIST_DIR)
        and requested_file.is_file()
    ):
        return FileResponse(requested_file)

    # Fallback for React routes such as /dashboard.
    index_file = FRONTEND_DIST_DIR / "index.html"

    if index_file.is_file():
        return FileResponse(index_file)

    raise HTTPException(
        status_code=404,
        detail="Frontend file not found",
    )
