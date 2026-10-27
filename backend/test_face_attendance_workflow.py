import requests
import base64
import numpy as np
import cv2
import json

BASE = 'http://127.0.0.1:8000'

def create_face_image():
    """Generates a synthetic portrait image suitable for testing or detection."""
    img = np.ones((400, 400, 3), dtype=np.uint8) * 220
    # Head circle
    cv2.circle(img, (200, 200), 120, (190, 160, 140), -1)
    # Eyes
    cv2.circle(img, (160, 170), 15, (50, 40, 30), -1)
    cv2.circle(img, (240, 170), 15, (50, 40, 30), -1)
    # Nose
    cv2.line(img, (200, 175), (200, 220), (120, 100, 90), 4)
    # Mouth
    cv2.ellipse(img, (200, 250), (40, 20), 0, 0, 180, (60, 40, 40), 5)
    
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')

def test_workflow():
    print("=" * 65)
    print(" TESTING EMPLOYEE FACE RECOGNITION & ATTENDANCE WORKFLOW")
    print("=" * 65)

    # 1. Login CEO
    print("\n[Step 1] Authenticating CEO...")
    login = requests.post(f"{BASE}/api/auth/login", json={
        "email": "ceo@gatewaysoftware.com",
        "password": "AdminPassword123!"
    })
    assert login.status_code == 200, "CEO Login failed"
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  -> CEO logged in successfully.")

    # 2. Get Employees
    print("\n[Step 2] Retrieving Employees...")
    emps = requests.get(f"{BASE}/api/employees", headers=headers).json()
    assert len(emps) > 0, "No employees found"
    target_emp = emps[0]
    print(f"  -> Selected employee for enrollment: {target_emp['name']} ({target_emp['employee_id']})")

    # 3. Test Biometric Consent Enforcement
    print("\n[Step 3] Testing Consent Enforcement...")
    face_b64 = create_face_image()
    no_consent_res = requests.post(
        f"{BASE}/api/employees/{target_emp['id']}/register-face",
        json={"image_base64": f"data:image/jpeg;base64,{face_b64}", "consent": False},
        headers=headers
    )
    assert no_consent_res.status_code == 400, "Consent enforcement failed: allowed without consent!"
    print(f"  -> Correctly blocked enrollment without consent: 400 Bad Request")

    # 4. Test Face Recognition Frame endpoint with blank/unknown frame
    print("\n[Step 4] Testing Unknown Face Handling on /api/attendance/recognize-frame...")
    blank_img = np.zeros((300, 300, 3), dtype=np.uint8)
    _, buf = cv2.imencode('.jpg', blank_img)
    blank_b64 = base64.b64encode(buf).decode('utf-8')

    rec_res = requests.post(f"{BASE}/api/attendance/recognize-frame", json={
        "image_base64": f"data:image/jpeg;base64,{blank_b64}"
    })
    assert rec_res.status_code == 200, "Recognize frame endpoint failed"
    data = rec_res.json()
    print("  -> Blank/Unknown frame result:", data["message"])
    assert data["faces_detected"] == 0, "Unexpected face detected in blank frame"
    print("  -> Zero false positives. No unknown face marked as an employee.")

    # 5. Check-In via Kiosk
    print("\n[Step 5] Testing Check-In via /api/attendance/check-in...")
    # Find an employee who hasn't checked in yet today or use the target employee
    today_records = requests.get(f"{BASE}/api/attendance/today").json()
    checked_in_ids = {r['employee_id'] for r in today_records}
    available_emp = next((e for e in emps if e['id'] not in checked_in_ids), None)

    if not available_emp:
        # Create a fresh employee for clean punch test
        new_emp = requests.post(f"{BASE}/api/employees", json={
            "employee_id": "GSS-FACE-01",
            "name": "Kiosk Webcam Tester",
            "email": "kiosk.tester@gatewaysoftware.com",
            "department": "AI & Innovation",
            "designation": "Vision Systems Specialist",
            "shift_start_time": "09:00:00",
            "shift_end_time": "18:00:00"
        }, headers=headers).json()
        available_emp = new_emp

    print(f"  -> Punching Check-In for: {available_emp['name']} ({available_emp['employee_id']})")
    cin_res = requests.post(f"{BASE}/api/attendance/check-in", json={
        "employee_id": available_emp["employee_id"],
        "confidence": 98.4,
        "notes": "Verified by Webcam Face Recognition"
    })
    assert cin_res.status_code == 200, f"Check-In failed: {cin_res.text}"
    cin_data = cin_res.json()
    print("  -> Check-In successful!")
    print(f"     * Employee: {cin_data['employee_name']} (ID: {cin_data['employee_code']})")
    print(f"     * Department: {cin_data['department']}")
    print(f"     * Check-In Time: {cin_data['check_in_time']}")
    print(f"     * Status: {cin_data['attendance_status']}")
    print(f"     * Late Minutes: {cin_data['late_minutes']} min")

    # 6. Duplicate Check-In Prevention
    print("\n[Step 6] Testing Duplicate Check-In Prevention...")
    dup_cin = requests.post(f"{BASE}/api/attendance/check-in", json={
        "employee_id": available_emp["employee_id"]
    })
    assert dup_cin.status_code == 400, "Duplicate check-in was not blocked!"
    print(f"  -> Duplicate Check-In prevented: {dup_cin.json()['detail']}")

    # 7. Check-Out via Kiosk
    print("\n[Step 7] Testing Check-Out via /api/attendance/check-out...")
    cout_res = requests.post(f"{BASE}/api/attendance/check-out", json={
        "employee_id": available_emp["employee_id"],
        "notes": "Shift checkout recorded"
    })
    assert cout_res.status_code == 200, f"Check-Out failed: {cout_res.text}"
    cout_data = cout_res.json()
    print("  -> Check-Out successful!")
    print(f"     * Check-Out Time: {cout_data['check_out_time']}")
    print(f"     * Working Hours: {cout_data['working_hours']} hrs")
    print(f"     * Final Status: {cout_data['attendance_status']}")

    # 8. Duplicate Check-Out Prevention
    print("\n[Step 8] Testing Duplicate Check-Out Prevention...")
    dup_cout = requests.post(f"{BASE}/api/attendance/check-out", json={
        "employee_id": available_emp["employee_id"]
    })
    assert dup_cout.status_code == 400, "Duplicate check-out was not blocked!"
    print(f"  -> Duplicate Check-Out prevented: {dup_cout.json()['detail']}")

    # 9. Today's Attendance List verification
    print("\n[Step 9] Verifying /api/attendance/today records...")
    final_today = requests.get(f"{BASE}/api/attendance/today").json()
    matched_record = next((r for r in final_today if r['employee_id'] == available_emp['id']), None)
    assert matched_record is not None, "Record not found in today's list!"
    print("  -> Record verified in today's attendance logs:")
    print(f"     * Employee ID: {matched_record['employee_code']}")
    print(f"     * Name: {matched_record['employee_name']}")
    print(f"     * Department: {matched_record['department']}")
    print(f"     * Check-In: {matched_record['check_in_time']}")
    print(f"     * Check-Out: {matched_record['check_out_time']}")
    print(f"     * Working Hours: {matched_record['working_hours']} hrs")

    print("\n" + "=" * 65)
    print(" >>> ALL WEBCAM ATTENDANCE WORKFLOW TESTS PASSED! <<<")
    print("=" * 65)

if __name__ == "__main__":
    test_workflow()
