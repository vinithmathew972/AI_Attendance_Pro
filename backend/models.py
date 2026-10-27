import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="CEO")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)  # e.g. GSS-1001
    name = Column(String(200), nullable=False)                                 # Full Name
    email = Column(String(255), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=False)
    designation = Column(String(100), nullable=False)
    shift_start_time = Column(String(10), default="09:00:00")                  # e.g. 09:00:00
    shift_end_time = Column(String(10), default="18:00:00")                    # e.g. 18:00:00
    phone = Column(String(50), nullable=True)
    photo_url = Column(String(255), nullable=True)
    face_encoding = Column(Text, nullable=True)                               # JSON-encoded array of 128 floats
    face_registered = Column(Boolean, default=False)
    consent_given = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    attendances = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")

    # Compatibility aliases
    @property
    def employee_code(self):
        return self.employee_id

    @property
    def full_name(self):
        return self.name

    @property
    def first_name(self):
        parts = self.name.split(" ", 1)
        return parts[0]

    @property
    def last_name(self):
        parts = self.name.split(" ", 1)
        return parts[1] if len(parts) > 1 else ""

class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    attendance_date = Column(String(10), nullable=False, index=True)           # Format: YYYY-MM-DD
    check_in_time = Column(String(10), nullable=True)                          # Format: HH:MM:SS
    check_out_time = Column(String(10), nullable=True)                         # Format: HH:MM:SS
    attendance_status = Column(String(50), default="Present")                  # Present, Late, Completed
    late_minutes = Column(Integer, default=0, nullable=False)                  # Calculated minutes late
    working_hours = Column(Float, nullable=True, default=0.0)                  # Total hours between in & out
    confidence_score = Column(Float, nullable=True)
    verification_method = Column(String(50), default="Face Recognition")
    snapshot_path = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    employee = relationship("Employee", back_populates="attendances")

    # Compatibility aliases
    @property
    def date(self):
        return self.attendance_date

    @property
    def status(self):
        return self.attendance_status

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

