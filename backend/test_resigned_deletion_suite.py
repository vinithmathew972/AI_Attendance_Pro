import os
import sys
import unittest
import datetime
import tempfile
import threading
import shutil
from fastapi import HTTPException
from fastapi.responses import JSONResponse

# Ensure backend directory is in path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from database import engine, SessionLocal, Base, DB_PATH
import main
from models import User, Employee, Attendance, AuditLog, Department, BackupLog
from auth import hash_password

# Dedicated non-ephemeral backup test dir
TEST_PERSISTENT_BACKUP_DIR = os.path.join(os.path.dirname(BASE_DIR), "backups", "test_persistent_backups")

class TestResignedDeletionSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.makedirs(TEST_PERSISTENT_BACKUP_DIR, exist_ok=True)
        os.environ["PERSISTENT_BACKUP_DIR"] = TEST_PERSISTENT_BACKUP_DIR
        cls.db = SessionLocal()
        cls.ceo = cls.db.query(User).filter(User.role == "CEO").first()
        if not cls.ceo:
            cls.ceo = User(
                email="ceo@gatewaysoftware.com",
                hashed_password=hash_password("AdminPassword123!"),
                full_name="Dr. Sabarinathan Muthu",
                role="CEO",
                is_active=True
            )
            cls.db.add(cls.ceo)
            cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        if os.path.exists(TEST_PERSISTENT_BACKUP_DIR):
            try:
                shutil.rmtree(TEST_PERSISTENT_BACKUP_DIR)
            except Exception:
                pass

    def setUp(self):
        os.environ["PERSISTENT_BACKUP_DIR"] = TEST_PERSISTENT_BACKUP_DIR
        # Clean any test employees with GSS-TEST- or GSS-T prefix
        test_emps = self.db.query(Employee).filter(Employee.employee_id.like("GSS-T%")).all()
        for e in test_emps:
            self.db.query(Attendance).filter(Attendance.employee_id == e.id).delete()
            self.db.delete(e)
        self.db.commit()

    def tearDown(self):
        os.environ["PERSISTENT_BACKUP_DIR"] = TEST_PERSISTENT_BACKUP_DIR
        test_emps = self.db.query(Employee).filter(Employee.employee_id.like("GSS-T%")).all()
        for e in test_emps:
            self.db.query(Attendance).filter(Attendance.employee_id == e.id).delete()
            self.db.delete(e)
        self.db.commit()

    def test_01_active_employee_strict_rejection(self):
        """Test that permanent deletion of an ACTIVE employee is strictly rejected with 400."""
        emp = Employee(
            employee_id="GSS-TACTIVE",
            name="Active Test User",
            email="active.test@gatewaysoftware.com",
            department="Engineering",
            designation="Software Engineer",
            is_active=True,
            employment_status="Active"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        # 1. Preview must reject
        with self.assertRaises(HTTPException) as ctx_prev:
            main.get_employee_deletion_preview(emp_id, db=self.db, current_ceo=self.ceo)
        self.assertEqual(ctx_prev.exception.status_code, 400)
        self.assertIn("Resigned", ctx_prev.exception.detail)

        # 2. Deletion must reject
        with self.assertRaises(HTTPException) as ctx_del:
            main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        self.assertEqual(ctx_del.exception.status_code, 400)
        self.assertIn("Resigned", ctx_del.exception.detail)
        self.assertIn("is_active == False", ctx_del.exception.detail)

        # Verify active employee remains intact
        check = self.db.query(Employee).filter(Employee.id == emp_id).first()
        self.assertIsNotNone(check)

    def test_02_resigned_status_mismatch_rejection(self):
        """Test that if employment_status is 'Resigned' but is_active is True, it is strictly rejected."""
        emp = Employee(
            employee_id="GSS-TMISMATCH",
            name="Status Mismatch User",
            email="mismatch.test@gatewaysoftware.com",
            department="Engineering",
            designation="DevOps",
            is_active=True,  # Inconsistent flag
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        with self.assertRaises(HTTPException) as ctx:
            main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("is_active == False", ctx.exception.detail)

    def test_03_missing_employee_returns_404(self):
        """Test that deleting a non-existent employee returns 404."""
        with self.assertRaises(HTTPException) as ctx:
            main.permanently_delete_resigned_employee(999999, db=self.db, current_ceo=self.ceo)
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("not found", ctx.exception.detail.lower())

    def test_04_attendance_count_accuracy_in_preview(self):
        """Test that deletion preview returns exact attendance count for resigned employee."""
        emp = Employee(
            employee_id="GSS-TPREVIEW",
            name="Preview Test User",
            email="preview.test@gatewaysoftware.com",
            department="Engineering",
            designation="QA Engineer",
            is_active=False,
            employment_status="Resigned",
            resignation_date=datetime.datetime.utcnow()
        )
        self.db.add(emp)
        self.db.commit()

        for i in range(4):
            self.db.add(Attendance(
                employee_id=emp.id,
                attendance_date=f"2026-11-0{i+1}",
                check_in_time="09:00:00",
                attendance_status="Present"
            ))
        self.db.commit()
        emp_id = emp.id

        preview = main.get_employee_deletion_preview(emp_id, db=self.db, current_ceo=self.ceo)
        self.assertEqual(preview["id"], emp_id)
        self.assertEqual(preview["employee_id"], "GSS-TPREVIEW")
        self.assertEqual(preview["attendance_count"], 4)
        self.assertEqual(preview["employment_status"], "Resigned")
        self.assertFalse(preview["is_active"])

    def test_05_persistent_backup_dir_missing_rejects_deletion_app_still_starts(self):
        """Test that missing PERSISTENT_BACKUP_DIR aborts permanent deletion with 500 without crashing app startup."""
        emp = Employee(
            employee_id="GSS-TNODIR",
            name="No Dir User",
            email="nodir.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        # Temporarily unset PERSISTENT_BACKUP_DIR
        os.environ.pop("PERSISTENT_BACKUP_DIR", None)

        try:
            # 1. App startup / import check - must not raise
            import importlib
            importlib.reload(main)
            self.assertIsNotNone(main.app)

            # 2. Permanent deletion must reject with HTTP 500
            with self.assertRaises(HTTPException) as ctx:
                main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
            self.assertEqual(ctx.exception.status_code, 500)
            self.assertIn("PERSISTENT_BACKUP_DIR environment variable is missing", ctx.exception.detail)

            # Employee must be preserved
            self.assertIsNotNone(self.db.query(Employee).filter(Employee.id == emp_id).first())
        finally:
            os.environ["PERSISTENT_BACKUP_DIR"] = TEST_PERSISTENT_BACKUP_DIR

    def test_06_ephemeral_tempdir_as_backup_rejected(self):
        """Test that setting PERSISTENT_BACKUP_DIR to system temp directory is rejected as unsafe."""
        emp = Employee(
            employee_id="GSS-TTEMPDIR",
            name="Temp Dir User",
            email="tempdir.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        temp_path = os.path.join(tempfile.gettempdir(), "test_unsafe_backup")
        os.environ["PERSISTENT_BACKUP_DIR"] = temp_path

        try:
            with self.assertRaises(HTTPException) as ctx:
                main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
            self.assertEqual(ctx.exception.status_code, 500)
            self.assertIn("cannot be located within an ephemeral or system temporary directory", ctx.exception.detail)
        finally:
            os.environ["PERSISTENT_BACKUP_DIR"] = TEST_PERSISTENT_BACKUP_DIR

    def test_07_fresh_complete_backup_db_and_files_verification(self):
        """Test complete point-in-time backup: SQLite DB, physical snapshot/photo files, and manifest recovery asset."""
        emp = Employee(
            employee_id="GSS-TFULL_BACKUP",
            name="Full Backup User",
            email="fullbackup.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        # Create dummy physical files for the employee
        faces_dir = os.path.join(main.UPLOADS_DIR, "faces")
        snaps_dir = os.path.join(main.UPLOADS_DIR, "snapshots")
        os.makedirs(faces_dir, exist_ok=True)
        os.makedirs(snaps_dir, exist_ok=True)

        photo_path = os.path.join(faces_dir, f"emp_{emp_id}_profile.jpg")
        with open(photo_path, "wb") as f:
            f.write(b"emp_photo_content_bytes")

        snap_path = os.path.join(snaps_dir, f"snap_{emp_id}_checkin.jpg")
        with open(snap_path, "wb") as f:
            f.write(b"snap_content_bytes")

        emp.photo_url = f"/uploads/faces/emp_{emp_id}_profile.jpg"
        self.db.add(Attendance(
            employee_id=emp_id,
            attendance_date="2026-11-01",
            check_in_time="09:00:00",
            snapshot_path=f"/uploads/snapshots/snap_{emp_id}_checkin.jpg"
        ))
        self.db.commit()

        backup_res = main.create_and_verify_point_in_time_backup(
            db=self.db,
            employee_id=emp_id,
            files_to_backup=[photo_path, snap_path]
        )

        self.assertTrue(backup_res["verified"])
        self.assertTrue(os.path.exists(backup_res["database_backup"]))
        self.assertGreater(os.path.getsize(backup_res["database_backup"]), 0)
        self.assertIsNotNone(backup_res["files_backup_dir"])
        self.assertTrue(os.path.exists(backup_res["files_backup_dir"]))
        self.assertEqual(backup_res["files_backed_up_count"], 2)
        self.assertTrue(os.path.exists(backup_res["manifest_path"]))
        self.assertIn("COMPLETE", backup_res["recovery_scope"])

        # Clean up created dummy test files
        if os.path.exists(photo_path):
            os.remove(photo_path)
        if os.path.exists(snap_path):
            os.remove(snap_path)

    def test_08_sqlalchemy_2_0_endpoint_transaction_success(self):
        """Test actual endpoint transactional permanent deletion with SQLAlchemy 2.0."""
        emp = Employee(
            employee_id="GSS-TSQLA_SUCCESS",
            name="SQLA Success User",
            email="sqlasuccess.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned",
            face_registered=True,
            face_image=b"fake_face_blob",
            face_encoding="[0.1, 0.2, 0.3]"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        self.db.add(Attendance(employee_id=emp_id, attendance_date="2026-11-01", check_in_time="09:00:00"))
        self.db.add(Attendance(employee_id=emp_id, attendance_date="2026-11-02", check_in_time="09:05:00"))
        self.db.commit()

        res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        # res can be a dict or JSONResponse
        if isinstance(res, JSONResponse):
            import json as json_mod
            data = json_mod.loads(res.body)
        else:
            data = res

        self.assertTrue(data["success"])
        self.assertEqual(data["deleted_attendances"], 2)
        self.assertTrue(data["biometrics_purged"])

        # Confirm employee and attendances are completely gone from DB
        self.assertIsNone(self.db.query(Employee).filter(Employee.id == emp_id).first())
        self.assertEqual(self.db.query(Attendance).filter(Attendance.employee_id == emp_id).count(), 0)

    def test_09_sqlalchemy_2_0_endpoint_transaction_rollback(self):
        """Test that any failure inside the atomic transaction rolls back all changes completely."""
        emp = Employee(
            employee_id="GSS-TROLLBACK",
            name="Rollback Candidate",
            email="rollback.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        self.db.add(Attendance(employee_id=emp_id, attendance_date="2026-11-01", check_in_time="09:00:00"))
        self.db.commit()

        from unittest.mock import patch
        # Simulate failure during db.delete(emp_to_delete)
        with patch.object(self.db, "delete", side_effect=Exception("Simulated SQLite Crash")):
            with self.assertRaises(HTTPException) as ctx:
                main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
            self.assertEqual(ctx.exception.status_code, 500)
            self.assertIn("rolled back", ctx.exception.detail)

        # Confirm employee and attendance records were preserved via rollback
        self.assertIsNotNone(self.db.query(Employee).filter(Employee.id == emp_id).first())
        self.assertEqual(self.db.query(Attendance).filter(Attendance.employee_id == emp_id).count(), 1)

    def test_10_snapshots_collected_before_attendance_deletion(self):
        """Test that snapshot paths are collected into memory before attendance rows are deleted, and deleted post-commit."""
        emp = Employee(
            employee_id="GSS-TSNAP_ORDER",
            name="Snap Order User",
            email="snaporder.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        snaps_dir = os.path.join(main.UPLOADS_DIR, "snapshots")
        os.makedirs(snaps_dir, exist_ok=True)
        snap_file = os.path.join(snaps_dir, f"snap_{emp_id}_order_test.jpg")
        with open(snap_file, "wb") as f:
            f.write(b"snapshot_content")

        self.db.add(Attendance(
            employee_id=emp_id,
            attendance_date="2026-11-01",
            check_in_time="09:00:00",
            snapshot_path=f"/uploads/snapshots/snap_{emp_id}_order_test.jpg"
        ))
        self.db.commit()

        self.assertTrue(os.path.exists(snap_file))

        res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        data = res if not isinstance(res, JSONResponse) else res.body

        # Attendances deleted from DB
        self.assertEqual(self.db.query(Attendance).filter(Attendance.employee_id == emp_id).count(), 0)
        # Snapshot deleted from disk
        self.assertFalse(os.path.exists(snap_file))

    def test_11_all_supported_prefixes_safely_removed(self):
        """Test safe removal for all supported employee prefixes (emp_, in_, out_, snap_)."""
        emp = Employee(
            employee_id="GSS-TPREFIXES",
            name="Prefix Test User",
            email="prefixes.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        uploads_dir = main.UPLOADS_DIR
        test_files = [
            os.path.join(uploads_dir, f"emp_{emp_id}_profile.jpg"),
            os.path.join(uploads_dir, f"in_{emp_id}_checkin.jpg"),
            os.path.join(uploads_dir, f"out_{emp_id}_checkout.jpg"),
            os.path.join(uploads_dir, f"snap_{emp_id}_kiosk.jpg")
        ]
        for tf in test_files:
            with open(tf, "wb") as f:
                f.write(b"content")

        emp.photo_url = f"/uploads/emp_{emp_id}_profile.jpg"
        self.db.add(Attendance(employee_id=emp_id, attendance_date="2026-11-01", snapshot_path=f"/uploads/in_{emp_id}_checkin.jpg"))
        self.db.add(Attendance(employee_id=emp_id, attendance_date="2026-11-02", snapshot_path=f"/uploads/out_{emp_id}_checkout.jpg"))
        self.db.add(Attendance(employee_id=emp_id, attendance_date="2026-11-03", snapshot_path=f"/uploads/snap_{emp_id}_kiosk.jpg"))
        self.db.commit()

        for tf in test_files:
            self.assertTrue(os.path.exists(tf))

        res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        data = res if not isinstance(res, JSONResponse) else res.body

        # All 4 prefixed files must be removed
        for tf in test_files:
            self.assertFalse(os.path.exists(tf))

    def test_12_partial_file_failure_returns_207(self):
        """Test that if a physical file cannot be removed from disk, endpoint returns HTTP 207 Multi-Status."""
        emp = Employee(
            employee_id="GSS-TPARTIAL_FAIL",
            name="Partial Fail User",
            email="partialfail.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        snaps_dir = os.path.join(main.UPLOADS_DIR, "snapshots")
        os.makedirs(snaps_dir, exist_ok=True)
        snap_file = os.path.join(snaps_dir, f"snap_{emp_id}_locked.jpg")
        with open(snap_file, "wb") as f:
            f.write(b"locked_file")

        self.db.add(Attendance(
            employee_id=emp_id,
            attendance_date="2026-11-01",
            snapshot_path=f"/uploads/snapshots/snap_{emp_id}_locked.jpg"
        ))
        self.db.commit()

        from unittest.mock import patch
        real_os_remove = os.remove
        def mock_remove(path):
            if "snap_" in str(path) and "locked" in str(path):
                raise PermissionError("File locked by process")
            return real_os_remove(path)

        # Simulate os.remove raising PermissionError on that specific snapshot file
        with patch("os.remove", side_effect=mock_remove):
            res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)

        # Must return HTTP 207 JSONResponse
        self.assertIsInstance(res, JSONResponse)
        self.assertEqual(res.status_code, 207)
        import json as json_mod
        body = json_mod.loads(res.body)
        self.assertTrue(body["partial_success"])
        self.assertEqual(body["failed_file_count"], 1)
        self.assertFalse(body["all_files_removed"])

        # Database record was still deleted
        self.assertIsNone(self.db.query(Employee).filter(Employee.id == emp_id).first())

        # Cleanup test file
        if os.path.exists(snap_file):
            os.remove(snap_file)

    def test_13_biometric_blob_and_encoding_purged_and_audited(self):
        """Test that employee face_image BLOB and face_encoding are purged from DB and recorded in audit without leaking data."""
        fake_blob = b"\xff\xd8\xff\xe0\x00\x10JFIFfakeimagebytes"
        fake_encoding = "[-0.123, 0.456, 0.789, -0.012]"

        emp = Employee(
            employee_id="GSS-TBIOMETRIC",
            name="Biometric Resigned User",
            email="biometric.test@gatewaysoftware.com",
            department="Engineering",
            designation="Biometric Engineer",
            is_active=False,
            employment_status="Resigned",
            face_registered=True,
            face_image=fake_blob,
            face_encoding=fake_encoding
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        # Verify biometric fields present
        emp_check = self.db.query(Employee).filter(Employee.id == emp_id).first()
        self.assertIsNotNone(emp_check.face_image)
        self.assertIsNotNone(emp_check.face_encoding)

        # Delete via endpoint
        res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        data = res if not isinstance(res, JSONResponse) else res.body

        # Confirm employee row and biometrics completely gone from SQLite
        self.assertIsNone(self.db.query(Employee).filter(Employee.id == emp_id).first())

        # Inspect audit log
        audit = self.db.query(AuditLog).filter(AuditLog.action == "EMPLOYEE_PERMANENT_DELETE").order_by(AuditLog.id.desc()).first()
        self.assertIsNotNone(audit)
        self.assertIn("GSS-TBIOMETRIC", audit.details)
        self.assertIn("Biometric face vectors and image BLOBs were purged from database.", audit.details)
        # Ensure NO raw bytes or encoding floats leaked into audit log text
        self.assertNotIn("fakeimagebytes", audit.details)
        self.assertNotIn("0.456", audit.details)

    def test_14_employee_with_no_face_image_clean_deletion(self):
        """Test clean deletion of an employee with no enrolled face or biometrics."""
        emp = Employee(
            employee_id="GSS-TNOFACE",
            name="No Face User",
            email="noface.test@gatewaysoftware.com",
            department="HR",
            designation="HR Assistant",
            is_active=False,
            employment_status="Resigned",
            face_registered=False,
            face_image=None,
            face_encoding=None,
            photo_url=None
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        data = res if not isinstance(res, JSONResponse) else res.body

        self.assertTrue(data["success"])
        self.assertFalse(data["biometrics_purged"])
        self.assertEqual(len(data["files_removed"]), 0)

        # Inspect audit log
        audit = self.db.query(AuditLog).filter(AuditLog.action == "EMPLOYEE_PERMANENT_DELETE").order_by(AuditLog.id.desc()).first()
        self.assertIn("No registered biometrics were present.", audit.details)

    def test_15_concurrent_deletion_attempts_lock(self):
        """Test that two simultaneous deletion requests for the same employee are prevented by concurrency lock."""
        emp = Employee(
            employee_id="GSS-TCONCURRENT",
            name="Concurrent User",
            email="concurrent.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        # Simulate concurrent in-progress deletion by adding emp_id to _active_deletions
        with main._deletion_lock:
            main._active_deletions.add(emp_id)

        try:
            with self.assertRaises(HTTPException) as ctx:
                main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
            self.assertEqual(ctx.exception.status_code, 409)
            self.assertIn("already in progress", ctx.exception.detail)
        finally:
            with main._deletion_lock:
                main._active_deletions.discard(emp_id)

        # Now normal deletion succeeds
        res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        data = res if not isinstance(res, JSONResponse) else res.body
        self.assertTrue(data["success"])

    def test_16_duplicate_deletion_after_completion_returns_404(self):
        """Test that requesting deletion a second time after successful completion returns 404."""
        emp = Employee(
            employee_id="GSS-TDUPLICATE",
            name="Duplicate Test User",
            email="duplicate.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        # First deletion succeeds
        res1 = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        data1 = res1 if not isinstance(res1, JSONResponse) else res1.body
        self.assertTrue(data1["success"])

        # Second deletion must return 404
        with self.assertRaises(HTTPException) as ctx:
            main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_17_audit_log_preservation(self):
        """Test that all existing historical audit logs remain completely preserved after deletion."""
        initial_audit_count = self.db.query(AuditLog).count()

        emp = Employee(
            employee_id="GSS-TAUDIT_TEST",
            name="Audit Test User",
            email="audit.test@gatewaysoftware.com",
            department="HR",
            designation="Manager",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        data = res if not isinstance(res, JSONResponse) else res.body
        self.assertTrue(data["success"])

        # Final audit count must be exactly initial + 1
        final_audit_count = self.db.query(AuditLog).count()
        self.assertEqual(final_audit_count, initial_audit_count + 1)

    def test_18_manifest_creation_failure_aborts_deletion(self):
        """Test that failure to write recovery manifest aborts deletion with 500 and cleans up current artifacts without touching existing backups."""
        # 1. Place a pre-existing backup file in the backup directory
        existing_backup_probe = os.path.join(TEST_PERSISTENT_BACKUP_DIR, "pre_existing_unrelated_backup.db")
        with open(existing_backup_probe, "w", encoding="utf-8") as f:
            f.write("existing_backup_data")

        emp = Employee(
            employee_id="GSS-TMANIFEST_FAIL",
            name="Manifest Fail User",
            email="manifestfail.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        from unittest.mock import patch
        # Simulate disk/IO failure during json.dump
        with patch("json.dump", side_effect=IOError("Simulated disk error writing manifest")):
            with self.assertRaises(HTTPException) as ctx:
                main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
            self.assertEqual(ctx.exception.status_code, 500)
            self.assertIn("Recovery manifest creation failed", ctx.exception.detail)

        # Confirm employee record in DB was preserved
        self.assertIsNotNone(self.db.query(Employee).filter(Employee.id == emp_id).first())

        # Confirm pre-existing backup file was NOT deleted
        self.assertTrue(os.path.exists(existing_backup_probe))
        if os.path.exists(existing_backup_probe):
            os.remove(existing_backup_probe)

    def test_19_manifest_verification_and_readability(self):
        """Test that database backup, file backups, and manifest all exist, are readable, and verified before deletion succeeds."""
        emp = Employee(
            employee_id="GSS-TMANIFEST_OK",
            name="Manifest OK User",
            email="manifestok.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        snaps_dir = os.path.join(main.UPLOADS_DIR, "snapshots")
        os.makedirs(snaps_dir, exist_ok=True)
        snap_file = os.path.join(snaps_dir, f"snap_{emp_id}_manifest_test.jpg")
        with open(snap_file, "wb") as f:
            f.write(b"manifest_test_bytes")

        self.db.add(Attendance(
            employee_id=emp_id,
            attendance_date="2026-11-01",
            snapshot_path=f"/uploads/snapshots/snap_{emp_id}_manifest_test.jpg"
        ))
        self.db.commit()

        res = main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
        data = res if not isinstance(res, JSONResponse) else res.body

        backup_info = data["backup"]
        manifest_filename = backup_info["manifest"]
        manifest_path = os.path.join(TEST_PERSISTENT_BACKUP_DIR, manifest_filename)
        self.assertTrue(os.path.isfile(manifest_path))
        self.assertGreater(os.path.getsize(manifest_path), 0)

        # Read and verify manifest JSON contents
        import json as json_mod
        with open(manifest_path, "r", encoding="utf-8") as mf:
            manifest_data = json_mod.load(mf)

        self.assertTrue(manifest_data["verified"])
        self.assertEqual(manifest_data["employee_id"], emp_id)
        self.assertIn("COMPLETE", manifest_data["recovery_scope"])
        self.assertEqual(len(manifest_data["files_backed_up"]), 1)
        self.assertEqual(manifest_data["files_backed_up"][0]["filename"], f"snap_{emp_id}_manifest_test.jpg")

        # Database record was deleted
        self.assertIsNone(self.db.query(Employee).filter(Employee.id == emp_id).first())

    def test_20_concurrent_attendance_modification_aborts_deletion(self):
        """Test that if attendances are modified between backup snapshot and deletion transaction, deletion is aborted with 409."""
        emp = Employee(
            employee_id="GSS-TCONCUR_ATT",
            name="Concur Att User",
            email="concuratt.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        self.db.add(Attendance(employee_id=emp_id, attendance_date="2026-11-01", check_in_time="09:00:00"))
        self.db.commit()

        real_backup = main.create_and_verify_point_in_time_backup
        def backup_and_inject_attendance(*args, **kwargs):
            res = real_backup(*args, **kwargs)
            # Inject concurrent attendance into DB right after backup before deletion transaction
            side_session = SessionLocal()
            side_session.add(Attendance(employee_id=emp_id, attendance_date="2026-11-02", check_in_time="09:10:00"))
            side_session.commit()
            side_session.close()
            return res

        from unittest.mock import patch
        with patch("main.create_and_verify_point_in_time_backup", side_effect=backup_and_inject_attendance):
            with self.assertRaises(HTTPException) as ctx:
                main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
            self.assertEqual(ctx.exception.status_code, 409)
            self.assertIn("Attendance records changed during processing", ctx.exception.detail)

        # Confirm rollback: employee preserved and now has 2 attendances
        self.assertIsNotNone(self.db.query(Employee).filter(Employee.id == emp_id).first())
        self.assertEqual(self.db.query(Attendance).filter(Attendance.employee_id == emp_id).count(), 2)

    def test_21_sanitized_error_handling_no_internal_paths_leaked(self):
        """Test that API error responses do not leak internal filesystem paths or raw exceptions."""
        emp = Employee(
            employee_id="GSS-TSANITIZED_ERR",
            name="Sanitized Err User",
            email="sanitizederr.test@gatewaysoftware.com",
            department="Engineering",
            designation="Dev",
            is_active=False,
            employment_status="Resigned"
        )
        self.db.add(emp)
        self.db.commit()
        emp_id = emp.id

        from unittest.mock import patch
        # Simulate database transaction error
        with patch.object(self.db, "delete", side_effect=Exception("D:\\AI_Atten_Pro\\backend\\internal_error")):
            with self.assertRaises(HTTPException) as ctx:
                main.permanently_delete_resigned_employee(emp_id, db=self.db, current_ceo=self.ceo)
            self.assertEqual(ctx.exception.status_code, 500)
            self.assertNotIn("D:\\", ctx.exception.detail)
            self.assertNotIn("internal_error", ctx.exception.detail)
            self.assertEqual(ctx.exception.detail, "Database transaction failed and was rolled back.")

if __name__ == "__main__":
    unittest.main()
