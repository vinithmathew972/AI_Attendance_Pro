from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, EmailStr
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
    department_stats: List[Dict[str, Any]]
    weekly_trend: List[Dict[str, Any]]
    recent_punches: List[Dict[str, Any]]
