import requests

BASE = 'http://127.0.0.1:8000'

def run_tests():
    print("=" * 60)
    print(" GATEWAY ATTENDANCE SYSTEM — BACKEND API TEST SUITE")
    print("=" * 60)

    # 1. Health
    print("\n[Test 1] GET /api/health")
    h = requests.get(f"{BASE}/api/health").json()
    print("  -> Status:", h.get("status"))
    assert h.get("status") == "online"

    # 2. Login
    print("\n[Test 2] POST /api/auth/login (CEO Login)")
    login_res = requests.post(f"{BASE}/api/auth/login", json={
        "email": "ceo@gatewaysoftware.com",
        "password": "AdminPassword123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  -> CEO Login successful. JWT token received.")

    # 3. Access Control
    print("\n[Test 3] CEO Authentication Protection")
    unauth_emp = requests.get(f"{BASE}/api/employees")
    assert unauth_emp.status_code == 401, f"Expected 401, got {unauth_emp.status_code}"
    print("  -> Unauthenticated GET /api/employees rejected with 401 Unauthorized.")

    unauth_stats = requests.get(f"{BASE}/api/dashboard/stats")
    assert unauth_stats.status_code == 401, f"Expected 401, got {unauth_stats.status_code}"
    print("  -> Unauthenticated GET /api/dashboard/stats rejected with 401 Unauthorized.")

    # 4. Employees Database verification
    print("\n[Test 4] GET /api/employees (Protected)")
    emps_res = requests.get(f"{BASE}/api/employees", headers=headers)
    assert emps_res.status_code == 200, f"Failed: {emps_res.text}"
    emps = emps_res.json()
    print(f"  -> Total Employees in DB: {len(emps)}")
    sample = emps[0]
    required_fields = ['employee_id', 'name', 'email', 'department', 'designation', 'shift_start_time', 'shift_end_time']
    for rf in required_fields:
        assert rf in sample, f"Missing required field {rf}"
        print(f"     * {rf}: {sample[rf]}")

    # 5. POST /api/employees
    print("\n[Test 5] POST /api/employees (Protected)")
    test_id = "GSS-TEST-99"
    new_emp_payload = {
        "employee_id": test_id,
        "name": "Integration Test Specialist",
        "email": "integration.test@gatewaysoftware.com",
        "department": "Engineering",
        "designation": "Staff Automation Engineer",
        "shift_start_time": "09:00:00",
        "shift_end_time": "18:00:00",
        "phone": "+91 99999 77777"
    }
    # Clean up if existed from previous run
    existing_find = [e for e in emps if e.get("employee_id") == test_id]
    if existing_find:
        requests.delete(f"{BASE}/api/employees/{existing_find[0]['id']}", headers=headers)

    create_res = requests.post(f"{BASE}/api/employees", json=new_emp_payload, headers=headers)
    assert create_res.status_code == 201, f"Create employee failed: {create_res.text}"
    created = create_res.json()
    print(f"  -> Employee created: {created['name']} (Employee ID: {created['employee_id']})")

    # 6. Check-In & Late Arrival calculation
    print("\n[Test 6] POST /api/attendance/check-in & Late Arrival Calculation")
    cin_res = requests.post(f"{BASE}/api/attendance/check-in", json={
        "employee_id": test_id,
        "notes": "Automated verification test punch"
    })
    assert cin_res.status_code == 200, f"Check-in failed: {cin_res.text}"
    cin = cin_res.json()
    print("  -> Check-In successful:")
    print(f"     * Employee: {cin['employee_name']} ({cin['employee_code']})")
    print(f"     * Attendance Date: {cin['attendance_date']}")
    print(f"     * Check-In Time: {cin['check_in_time']}")
    print(f"     * Attendance Status: {cin['attendance_status']}")
    print(f"     * Late Minutes: {cin['late_minutes']} min")
    print(f"     * Working Hours: {cin['working_hours']} hrs")

    # 7. Prevent Duplicate Check-In
    print("\n[Test 7] Prevent Duplicate Check-In")
    dup_cin = requests.post(f"{BASE}/api/attendance/check-in", json={"employee_id": test_id})
    assert dup_cin.status_code == 400, f"Expected 400, got {dup_cin.status_code}"
    print(f"  -> Duplicate Check-In blocked: {dup_cin.json()['detail']}")

    # 8. Check-Out & Working Hours calculation
    print("\n[Test 8] POST /api/attendance/check-out & Working Hours")
    cout_res = requests.post(f"{BASE}/api/attendance/check-out", json={
        "employee_id": test_id,
        "notes": "Shift ended"
    })
    assert cout_res.status_code == 200, f"Check-out failed: {cout_res.text}"
    cout = cout_res.json()
    print("  -> Check-Out successful:")
    print(f"     * Check-Out Time: {cout['check_out_time']}")
    print(f"     * Attendance Status: {cout['attendance_status']}")
    print(f"     * Working Hours: {cout['working_hours']} hrs")

    # 9. Prevent Duplicate Check-Out
    print("\n[Test 9] Prevent Duplicate Check-Out")
    dup_cout = requests.post(f"{BASE}/api/attendance/check-out", json={"employee_id": test_id})
    assert dup_cout.status_code == 400, f"Expected 400, got {dup_cout.status_code}"
    print(f"  -> Duplicate Check-Out blocked: {dup_cout.json()['detail']}")

    # 10. GET /api/attendance/today
    print("\n[Test 10] GET /api/attendance/today")
    today_res = requests.get(f"{BASE}/api/attendance/today")
    assert today_res.status_code == 200, f"Failed: {today_res.text}"
    today_list = today_res.json()
    print(f"  -> Today's Attendances Count: {len(today_list)}")
    sample_today = today_list[0]
    required_att_fields = ['employee_id', 'employee_name', 'attendance_date', 'check_in_time', 'check_out_time', 'attendance_status', 'late_minutes', 'working_hours']
    for raf in required_att_fields:
        assert raf in sample_today, f"Missing field {raf}"
    print(f"  -> Verified Attendance fields: {', '.join(required_att_fields)}")

    # 11. GET /api/dashboard/stats
    print("\n[Test 11] GET /api/dashboard/stats (CEO Protected)")
    stats_res = requests.get(f"{BASE}/api/dashboard/stats", headers=headers)
    assert stats_res.status_code == 200, f"Failed: {stats_res.text}"
    stats = stats_res.json()
    print("  -> CEO Dashboard Statistics:")
    print(f"     * Total Workforce: {stats['total_employees']}")
    print(f"     * Present Today: {stats['present_today']}")
    print(f"     * Absent Today: {stats['absent_today']}")
    print(f"     * Late Arrivals: {stats['late_today']}")
    print(f"     * Currently Working: {stats['currently_working']}")
    print(f"     * Attendance Rate: {stats['attendance_rate']}%")
    print(f"     * Department Breakdown: {len(stats['department_stats'])} units")
    print(f"     * 7-Day Trend: {len(stats['weekly_trend'])} days")

    print("\n" + "=" * 60)
    print(" >>> ALL 11 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS! <<<")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
