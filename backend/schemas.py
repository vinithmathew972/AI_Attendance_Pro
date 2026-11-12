from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime

# Auth Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class DepartmentOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    employee_count: Optional[int] = 0

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str

    class Config:
        from_attributes = True

# Employee Schemas
class EmployeeBase(BaseModel):
    employee_id: Optional[str] = None
    employee_code: Optional[str] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    department: str
    designation: str
    shift_start_time: Optional[str] = "09:00:00"
    shift_end_time: Optional[str] = "18:00:00"

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    shift_start_time: Optional[str] = None
    shift_end_time: Optional[str] = None
    is_active: Optional[bool] = None
    employment_status: Optional[str] = None
    resignation_date: Optional[datetime] = None
    resignation_reason: Optional[str] = None

class EmployeeResignRequest(BaseModel):
    reason: Optional[str] = "Voluntary Resignation"
    resignation_date: Optional[str] = None

class EmployeeOut(BaseModel):
    id: int
    employee_id: str
    employee_code: str
    name: str
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    department: str
    designation: str
    shift_start_time: str
    shift_end_time: str
    photo_url: Optional[str] = None
    face_registered: bool
    consent_given: bool
    consent_timestamp: Optional[datetime] = None
    is_active: bool
    employment_status: Optional[str] = "Active"
    resignation_date: Optional[datetime] = None
    resignation_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Face Registration
class FaceRegistrationPayload(BaseModel):
    image_base64: str
    consent: bool

# Attendance Schemas
class RecognizeFrameRequest(BaseModel):
    image_base64: str

class FaceDetectionBox(BaseModel):
    top: int
    right: int
    bottom: int
    left: int

class RecognizedFace(BaseModel):
    employee_id: int
    employee_code: str
    full_name: str
    department: str
    designation: str
    photo_url: Optional[str] = None
    confidence: float
    distance: float
    box: Optional[FaceDetectionBox] = None
    already_checked_in: bool = False
    already_checked_out: bool = False
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    today_status: Optional[str] = None

class FrameRecognitionResponse(BaseModel):
    faces_detected: int
    matches: List[RecognizedFace]
    message: str

class CheckInRequest(BaseModel):
    employee_id: Union[int, str]
    snapshot_base64: Optional[str] = None
    confidence: Optional[float] = None
    notes: Optional[str] = None

class CheckOutRequest(BaseModel):
    employee_id: Union[int, str]
    snapshot_base64: Optional[str] = None
    notes: Optional[str] = None

class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    department: Optional[str] = None
    attendance_date: str
    date: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    attendance_status: str
    status: str
    late_minutes: int = 0
    working_hours: Optional[float] = 0.0
    confidence_score: Optional[float] = None
    verification_method: str = "Face Recognition"
    snapshot_path: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

# Stats / Dashboard
class DashboardStats(BaseModel):
    total_employees: int
    present_today: int
    absent_today: int
    late_today: int
    currently_working: int
    attendance_rate: float
    active_employees: Optional[int] = None
    resigned_employees: Optional[int] = None
    total_permanent_records: Optional[int] = None
    department_stats: List[Dict[str, Any]]
    weekly_trend: List[Dict[str, Any]]
    recent_punches: List[Dict[str, Any]]

class BackupStatusResponse(BaseModel):
    has_backup: bool
    last_backup_at: Optional[datetime] = None
    filename: Optional[str] = None
    file_size_bytes: Optional[int] = None


class CleanupDemoRequest(BaseModel):
    confirmation: str
    backup_id: str

    @field_validator('confirmation')
    @classmethod
    def check_phrase(cls, v: str) -> str:
        expected = "DELETE DEMO DATA"
        if v != expected:
            raise ValueError(f'Confirmation phrase must be exactly "{expected}"')
        return v

