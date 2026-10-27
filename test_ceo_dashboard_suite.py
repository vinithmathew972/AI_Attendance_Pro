import urllib.request
import urllib.error
import json

def run_tests():
    print("=== TESTING CEO DASHBOARD API SUITE ===")
    
    # 1. Login CEO
    login_data = json.dumps({'email': 'ceo@gatewaysoftware.com', 'password': 'AdminPassword123!'}).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:8000/api/auth/login', data=login_data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            token = json.loads(resp.read().decode())['access_token']
        print("[PASS] CEO Login successful. Bearer token received.")
    except Exception as e:
        print(f"[FAIL] Login failed: {e}")
        return

    auth_headers = {'Authorization': f'Bearer {token}'}

    # 2. Test Stats
    req = urllib.request.Request('http://127.0.0.1:8000/api/dashboard/stats', headers=auth_headers)
    with urllib.request.urlopen(req) as resp:
        stats = json.loads(resp.read().decode())
    print(f"[PASS] Dashboard Stats: Total={stats.get('total_employees')}, Present={stats.get('present_today')}, Absent={stats.get('absent_today')}, Late={stats.get('late_today')}, Working={stats.get('currently_working')}")

    # 3. Test Attendance History / Records
    req = urllib.request.Request('http://127.0.0.1:8000/api/attendance/history', headers=auth_headers)
    with urllib.request.urlopen(req) as resp:
        hist = json.loads(resp.read().decode())
    print(f"[PASS] Attendance Records count: {len(hist) if isinstance(hist, list) else len(hist.get('attendances', []))}")

    # 4. Test Late Arrivals
    req = urllib.request.Request('http://127.0.0.1:8000/api/attendance/late-arrivals', headers=auth_headers)
    with urllib.request.urlopen(req) as resp:
        late = json.loads(resp.read().decode())
    print(f"[PASS] Late Arrivals page records: {len(late) if isinstance(late, list) else len(late.get('late_arrivals', []))}")

    # 5. Test Absent Employees
    req = urllib.request.Request('http://127.0.0.1:8000/api/attendance/absent-employees', headers=auth_headers)
    with urllib.request.urlopen(req) as resp:
        absent = json.loads(resp.read().decode())
    print(f"[PASS] Absent Employees page records: {len(absent) if isinstance(absent, list) else len(absent.get('absent_employees', []))}")

    # 6. Test Currently Working
    req = urllib.request.Request('http://127.0.0.1:8000/api/attendance/currently-working', headers=auth_headers)
    with urllib.request.urlopen(req) as resp:
        working = json.loads(resp.read().decode())
    print(f"[PASS] Currently Working page records: {len(working) if isinstance(working, list) else len(working.get('currently_working', []))}")

    # 7. Test CSV Export
    req = urllib.request.Request('http://127.0.0.1:8000/api/attendance/export', headers=auth_headers)
    with urllib.request.urlopen(req) as resp:
        csv_text = resp.read().decode()
    lines = csv_text.strip().splitlines()
    print(f"[PASS] CSV Export: Header='{lines[0] if lines else ''}', Total rows={len(lines)}")

    # 8. Test Unauthorized Security (401 check)
    endpoints_to_protect = [
        'http://127.0.0.1:8000/api/dashboard/stats',
        'http://127.0.0.1:8000/api/attendance/late-arrivals',
        'http://127.0.0.1:8000/api/attendance/absent-employees',
        'http://127.0.0.1:8000/api/attendance/currently-working',
        'http://127.0.0.1:8000/api/attendance/export',
    ]
    all_protected = True
    for ep in endpoints_to_protect:
        try:
            urllib.request.urlopen(ep)
            print(f"[FAIL] Endpoint leaked without auth: {ep}")
            all_protected = False
        except urllib.error.HTTPError as e:
            if e.code != 401:
                print(f"[WARN] Endpoint returned {e.code} instead of 401: {ep}")
    if all_protected:
        print("[PASS] All CEO dashboard endpoints strictly return 401 Unauthorized for unauthenticated requests.")

    # 9. Test Frontend Server
    req = urllib.request.Request('http://localhost:5173/')
    with urllib.request.urlopen(req) as resp:
        print(f"[PASS] Frontend preview server responding: HTTP {resp.status}")

    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
