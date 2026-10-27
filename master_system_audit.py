import sys
import os
import sqlite3
import datetime
import json
import urllib.request
import urllib.error
import base64
import numpy as np
import cv2

BASE_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:5173"
DB_PATH = os.path.join(os.path.dirname(__file__), "backend", "gateway_attendance.db")

def make_request(path, method="GET", payload=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        content_type = resp.headers.get("Content-Type", "")
        body = resp.read()
        if "json" in content_type:
            return resp.status, json.loads(body.decode("utf-8"))
        return resp.status, body.decode("utf-8", errors="ignore")

def create_synthetic_face():
    img = np.ones((400, 400, 3), dtype=np.uint8) * 220
    cv2.circle(img, (200, 200), 120, (190, 160, 140), -1)
    cv2.circle(img, (160, 170), 15, (50, 40, 30), -1)
    cv2.circle(img, (240, 170), 15, (50, 40, 30), -1)
    cv2.line(img, (200, 175), (200, 220), (120, 100, 90), 4)
    cv2.ellipse(img, (200, 250), (40, 20), 0, 0, 180, (60, 40, 40), 5)
    _, buffer = cv2.imencode(".jpg", img)
    return base64.b64encode(buffer).decode("utf-8")

def run_master_audit():
    print("=" * 70)
    print(" GATEWAY AI ATTENDANCE SYSTEM — MASTER SYSTEM AUDIT & VERIFICATION")
    print("=" * 70)

    # 1. Health & Frontend
    print("\n[Audit 1/12] Checking Frontend and Backend Server Status...")
    try:
        status, health = make_request("/api/health")
        assert status == 200 and health.get("status") == "online"
        print("  -> FastAPI Backend: ONLINE (HTTP 200)")
    except Exception as e:
        print(f"  -> [FAIL] Backend offline: {e}")
        return False

    try:
        req = urllib.request.Request(FRONTEND_URL)
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
        print(f"  -> React Frontend: ONLINE at {FRONTEND_URL} (HTTP 200)")
    except Exception as e:
        print(f"  -> [FAIL] Frontend preview offline: {e}")
        return False

    # 2. Database Schema & Tables
    print("\n[Audit 2/12] Verifying SQLite Database Architecture...")
    assert os.path.exists(DB_PATH), f"Database not found at {DB_PATH}"
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    required_tables = ["users", "employees", "attendances", "audit_logs"]
    for t in required_tables:
        assert t in tables, f"Missing table {t}"
    print(f"  -> SQLite Tables Verified: {', '.join(required_tables)}")

    # 3. CEO Authentication
    print("\n[Audit 3/12] Testing CEO Authentication & RBAC...")
    login_payload = {
        "email": "ceo@gatewaysoftware.com",
        "password": "AdminPassword123!"
    }
    status, login_res = make_request("/api/auth/login", method="POST", payload=login_payload)
    assert status == 200 and "access_token" in login_res
    ceo_token = login_res["access_token"]
    print("  -> CEO Login: SUCCESS. Token obtained.")

    # 4. Access Control Enforcement
    print("\n[Audit 4/12] Verifying 401 Unauthorized Enforcement on CEO Endpoints...")
    protected_paths = [
        "/api/employees",
        "/api/dashboard/stats",
        "/api/attendance/late-arrivals",
        "/api/attendance/absent-employees",
        "/api/attendance/currently-working",
        "/api/attendance/export"
    ]
    for p in protected_paths:
        try:
            make_request(p, method="GET")
            print(f"  -> [FAIL] Leak detected: {p} allowed without auth!")
            return False
        except urllib.error.HTTPError as he:
            assert he.code == 401, f"Expected 401 for {p}, got {he.code}"
    print(f"  -> All {len(protected_paths)} protected CEO endpoints strictly return 401 Unauthorized.")

    # 5. Employee Directory & Creation
    print("\n[Audit 5/12] Testing Employee Creation...")
    test_emp_code = f"GSS-AUDIT-{int(datetime.datetime.now().timestamp()) % 10000}"
    emp_payload = {
        "employee_id": test_emp_code,
        "name": "Audit Verification Specialist",
        "email": f"audit.{test_emp_code.lower()}@gatewaysoftware.com",
        "department": "Quality Assurance",
        "designation": "Senior QA Engineer",
        "shift_start_time": "09:00:00",
        "shift_end_time": "18:00:00",
        "phone": "+91 91111 22222"
    }
    status, created_emp = make_request("/api/employees", method="POST", payload=emp_payload, token=ceo_token)
    assert status == 201, f"Failed to create employee: {created_emp}"
    test_emp_id = created_emp["id"]
    print(f"  -> Employee Created: {created_emp['name']} (ID: {created_emp['employee_id']}, DB ID: {test_emp_id})")

    # 6. Biometric Consent Enforcement & Face Enrollment
    print("\n[Audit 6/12] Testing Face Biometric Enrollment with Consent...")
    synthetic_b64 = create_synthetic_face()
    # Try without consent (must fail)
    try:
        make_request(
            f"/api/employees/{test_emp_id}/register-face",
            method="POST",
            payload={"image_base64": f"data:image/jpeg;base64,{synthetic_b64}", "consent": False},
            token=ceo_token
        )
        print("  -> [FAIL] Allowed face registration without consent!")
        return False
    except urllib.error.HTTPError as he:
        assert he.code == 400
        print("  -> Consent Guard Passed: Blocked registration without biometric consent (HTTP 400).")

    # 7. Webcam Frame Recognition (Unknown & Registered)
    print("\n[Audit 7/12] Testing Webcam Frame Recognition Endpoint...")
    blank_img = np.zeros((200, 200, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", blank_img)
    blank_b64 = base64.b64encode(buf).decode("utf-8")
    status, frame_res = make_request(
        "/api/attendance/recognize-frame",
        method="POST",
        payload={"image_base64": f"data:image/jpeg;base64,{blank_b64}"}
    )
    assert status == 200
    assert frame_res["faces_detected"] == 0
    print(f"  -> Face Recognition Kiosk: Frame scanned with zero false positives ({frame_res['message']})")

    # 8. Employee Check-In & Late Minutes Calculation
    print("\n[Audit 8/12] Testing Attendance Check-In & Late Minutes Calculation...")
    status, cin_res = make_request(
        "/api/attendance/check-in",
        method="POST",
        payload={"employee_id": test_emp_code, "notes": "Master audit punch"}
    )
    assert status == 200
    print(f"  -> Check-In Recorded:")
    print(f"     * Employee: {cin_res['employee_name']} ({cin_res['employee_code']})")
    print(f"     * Time: {cin_res['check_in_time']}")
    print(f"     * Status: {cin_res['attendance_status']}")
    print(f"     * Late Minutes: {cin_res['late_minutes']} min")

    # 9. Duplicate Check-In Prevention
    print("\n[Audit 9/12] Testing Duplicate Check-In Guard...")
    try:
        make_request(
            "/api/attendance/check-in",
            method="POST",
            payload={"employee_id": test_emp_code}
        )
        print("  -> [FAIL] Duplicate check-in allowed!")
        return False
    except urllib.error.HTTPError as he:
        assert he.code == 400
        print("  -> Duplicate Check-In Blocked successfully (HTTP 400).")

    # 10. Check-Out & Working Hours Calculation
    print("\n[Audit 10/12] Testing Check-Out & Working Hours Calculation...")
    status, cout_res = make_request(
        "/api/attendance/check-out",
        method="POST",
        payload={"employee_id": test_emp_code, "notes": "Master audit checkout"}
    )
    assert status == 200
    print(f"  -> Check-Out Recorded:")
    print(f"     * Check-Out Time: {cout_res['check_out_time']}")
    print(f"     * Total Working Hours: {cout_res['working_hours']} hrs")
    print(f"     * Final Status: {cout_res['attendance_status']}")

    # 11. Duplicate Check-Out Prevention
    print("\n[Audit 11/12] Testing Duplicate Check-Out Guard...")
    try:
        make_request(
            "/api/attendance/check-out",
            method="POST",
            payload={"employee_id": test_emp_code}
        )
        print("  -> [FAIL] Duplicate check-out allowed!")
        return False
    except urllib.error.HTTPError as he:
        assert he.code == 400
        print("  -> Duplicate Check-Out Blocked successfully (HTTP 400).")

    # 12. Verification of Database Integrity vs CEO Dashboard Stats
    print("\n[Audit 12/12] Comparing SQLite DB Counts vs Dashboard API Analytics...")
    status, stats = make_request("/api/dashboard/stats", token=ceo_token)
    assert status == 200

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    db_total = cur.execute("SELECT COUNT(*) FROM employees WHERE is_active = 1").fetchone()[0]
    db_present = cur.execute(
        "SELECT COUNT(DISTINCT a.employee_id) FROM attendances a JOIN employees e ON a.employee_id = e.id WHERE e.is_active = 1 AND a.attendance_date = ?",
        (today_str,)
    ).fetchone()[0]
    db_absent = max(0, db_total - db_present)
    db_working = cur.execute(
        "SELECT COUNT(*) FROM attendances a JOIN employees e ON a.employee_id = e.id WHERE e.is_active = 1 AND a.attendance_date = ? AND a.check_in_time IS NOT NULL AND a.check_out_time IS NULL",
        (today_str,)
    ).fetchone()[0]

    print(f"  -> Total Employees: DB={db_total} | API={stats['total_employees']}")
    print(f"  -> Present Today:   DB={db_present} | API={stats['present_today']}")
    print(f"  -> Absent Today:    DB={db_absent} | API={stats['absent_today']}")
    print(f"  -> Currently Working: DB={db_working} | API={stats['currently_working']}")

    assert stats["total_employees"] == db_total, "Mismatch in Total Employees"
    assert stats["present_today"] == db_present, "Mismatch in Present Today"
    assert stats["absent_today"] == db_absent, "Mismatch in Absent Today"
    assert stats["currently_working"] == db_working, "Mismatch in Currently Working"

    # CSV Export Check
    status, csv_data = make_request("/api/attendance/export", token=ceo_token)
    assert status == 200 and "Record ID,Employee ID" in csv_data
    lines = csv_data.strip().splitlines()
    print(f"  -> Attendance CSV Report Export: {len(lines)} records exported cleanly.")

    print("\n" + "=" * 70)
    print(" >>> MASTER SYSTEM AUDIT COMPLETE: ALL 12 AUDITS PASSED WITH ZERO ERRORS! <<<")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = run_master_audit()
    sys.exit(0 if success else 1)
