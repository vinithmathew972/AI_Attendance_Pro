# Gateway Software Solutions — AI Biometric Employee Attendance System

An enterprise-grade, biometric facial recognition attendance and workforce management platform built specifically for **Gateway Software Solutions**.

---

## 🌟 System Overview & Features

### 1. 👑 Executive CEO Login & Access Control
- **Secure Authentication:** High-security JWT token-based authentication (`PyJWT` + `bcrypt` password hashing).
- **Executive Guard:** Only authenticated CEO users have access to the executive dashboard, workforce directory, absent/late reports, and CSV downloads.
- **Preconfigured CEO Credentials:**
  - **Email:** `ceo@gatewaysoftware.com`
  - **Password:** `AdminPassword123!`
  - *(One-click auto-fill demo button provided on the login page for instant access).*

### 2. 📷 Live Webcam Face Recognition & Attendance Kiosk
- **Laptop Webcam Integration:** Real-time video stream via WebRTC (`getUserMedia`) with canvas overlays and face tracking bounding boxes.
- **Biometric Face Engine:** Powered by **OpenCV** and the **Face Recognition Library** (`dlib` 128-dimensional Euclidean embedding vector comparison).
- **Real-Time Recognition:** Automatically identifies registered personnel, drawing bounding boxes with match confidence scores.
- **Smart Punching System:**
  - **Check-In:** Records timestamp, verifies face, determines on-time vs. late status (based on shift start time + 15 min grace window), prevents duplicate check-ins for the day.
  - **Check-Out:** Records timestamp, computes exact total working hours worked, logs completed shift, prevents duplicate check-outs.
- **Audio & Visual Feedback:** Synthesizes pleasant audio chimes via Web Audio API (success chime, shift-end chime) and triggers celebratory confetti.
- **Manual Search Fallback:** Quick search selector allows attendance logging even in low-light environments or camera-restricted areas.

### 3. 📊 CEO Command Dashboard & Dedicated Reports
- **5 Core Real-Time KPI Cards (with Clickable Drill-Downs):**
  - 👥 **Total Employees:** Count of all active employees registered in SQLite.
  - ✅ **Present Today:** Personnel who logged in today with turnout percentage.
  - ❌ **Absent Today:** Personnel not yet reported for their scheduled shift.
  - ⏰ **Late Arrivals:** Check-ins after shift start time grace window.
  - 💼 **Currently Working:** Active staff on duty right now (live elapsed shift time).
- **Interactive Recharts Analytics:**
  - **7-Day Trend Chart:** Daily distribution of on-time, late, and absent employees.
  - **Department Turnout Breakdown:** Visual turnout progress bars across Engineering, AI & Innovation, Product & Design, etc.
- **Dedicated Reporting Views:**
  - `/attendance-records` — Complete table with Employee ID, Name, Department, Check-In, Check-Out, Late Minutes, Working Hours, Status, and CSV export.
  - `/late-arrivals` — Filterable audit page tracking tardy arrivals and total late minutes.
  - `/absent-employees` — Unreported staff roster with shift timings and direct contact numbers.
  - `/currently-working` — Live shift tracker calculating active elapsed hours with auto-refresh every 30 seconds.
- **CSV Report Export:** Server-side streaming endpoint exporting filtered attendance logs in RFC 4180 CSV format.

### 4. 👥 Employee Management & Face Biometric Enrollment
- **Workforce Directory:** Filter by department, search by name or employee code, add new employees, or edit shift schedules.
- **Biometric Enrollment with Explicit Consent:**
  - Explicit biometric consent checkbox legally required before capturing and computing face encodings.
  - Capture photo directly via live laptop webcam OR upload a portrait image file.
  - Instant feature extraction (128-D vector) and local storage with audit trail.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend** | React 19, Vite 5, Tailwind CSS, Recharts, Lucide Icons, Canvas Confetti, Web Audio API |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, Pydantic, PyJWT, Bcrypt |
| **Database** | SQLite (`gateway_attendance.db`) with relational integrity |
| **Computer Vision** | OpenCV (`opencv-python`), `face_recognition`, `dlib-bin` |

---

## 💻 Windows Laptop Setup & Installation Guide

### Prerequisites for Windows
1. **Python 3.10 or 3.11** installed with *"Add Python to PATH"* checked during installation.
2. **Node.js (v18 or v20+)** installed with npm.
3. **Laptop Webcam:** Integrated webcam or USB camera.

> [!IMPORTANT]
> **Windows Camera Privacy Permissions:**  
> Make sure camera access is enabled in Windows Settings:  
> **Windows Settings** ➔ **Privacy & security** ➔ **Camera** ➔ Toggle **"Let apps access your camera"** to **ON**, and enable **"Let desktop apps access your camera"**.

---

### Step-by-Step Installation

#### 1. Open Terminal (PowerShell or Command Prompt)
Navigate to the project root directory:
```powershell
cd D:\AI_Atten_Pro
```

#### 2. Backend Setup
```powershell
cd backend

# Install dependencies (dlib-bin installs pre-compiled binaries on Windows without Visual Studio C++ build tools)
python -m pip install -r requirements.txt

# Initialize database schema & default CEO / employee seed records
python init_db.py

cd ..
```

#### 3. Frontend Setup
```powershell
cd frontend

# Install node dependencies
npm install --legacy-peer-deps

# Build production bundle
npm run build

cd ..
```

---

## 🚀 Exact Terminal Commands to Run the Project

### Option A: 1-Click Launch (Recommended)
In the root directory, simply run:
```powershell
.\run_all.bat
```
*(Or double-click `run_all.bat` in Windows File Explorer).*

---

### Option B: Running in Two Separate Terminals

#### Terminal 1 — Start the FastAPI Backend:
```powershell
cd D:\AI_Atten_Pro\backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
- **Backend API URL:** `http://127.0.0.1:8000`
- **Swagger Documentation:** `http://127.0.0.1:8000/docs`

#### Terminal 2 — Start the React Frontend:
```powershell
cd D:\AI_Atten_Pro\frontend
npm run preview -- --port 5173 --host 0.0.0.0
```
*(Or for development hot-reloading: `npm run dev -- --port 5173 --host 0.0.0.0`)*
- **Frontend Web Portal:** `http://localhost:5173`

---

## 🔑 Login & Access Credentials

| Portal Role | Access URL | Email | Password | Access Level |
|---|---|---|---|---|
| **CEO (Executive)** | `http://localhost:5173` | `ceo@gatewaysoftware.com` | `AdminPassword123!` | Full Dashboard, Analytics, Staff Management, CSV Export |
| **Attendance Kiosk** | `http://localhost:5173` | *(No login required)* | *(No password required)* | Live Camera Face Recognition, Check-In & Check-Out |

---

## 🧪 Testing & Verification Suites

Run the automated test suites anytime:

### 1. Master System Audit (All 12 Core Subsystems)
```powershell
python master_system_audit.py
```
*Tests backend health, frontend preview, SQLite tables, CEO login, 401 guards, employee creation, biometric consent, frame matcher, Check-In/Check-Out, duplicate prevention, and database-to-API analytics parity.*

### 2. CEO Dashboard & Reports Suite
```powershell
python test_ceo_dashboard_suite.py
```

### 3. Face Recognition & Kiosk Workflow
```powershell
python backend/test_face_attendance_workflow.py
```

---

## 🔒 Biometric Privacy & Compliance
- Facial biometrics are processed into 128-dimensional mathematical feature vectors.
- Raw snapshots are saved locally only when authorized via the biometric consent dialog.
- Biometric registration requires affirmative consent before enrollment proceeds.

---

© Gateway Software Solutions. All rights reserved.
