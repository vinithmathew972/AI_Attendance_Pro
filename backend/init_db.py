import os
import datetime
import random
import json
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import User, Employee, Attendance, AuditLog, Department
from auth import hash_password

def initialize_database():
    """Initializes SQLite database schema and seeds initial records for Gateway Software Solutions."""
    print("=" * 65)
    print(" Gateway Software Solutions — Database Initialization Script")
    print("=" * 65)

    # 1. Recreate/ensure all tables exist
    print("[1/5] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 2. Seed CEO User from environment variables or secure defaults
        ceo_email = os.getenv("CEO_EMAIL", "ceo@gatewaysoftware.com").strip().lower()
        ceo_password = os.getenv("CEO_PASSWORD", "AdminPassword123!")
        
        print(f"[2/5] Verifying CEO Executive Account ({ceo_email})...")
        ceo = db.query(User).filter(User.email == ceo_email).first()
        if not ceo:
            # Check if there is an existing CEO with another email
            existing_ceo = db.query(User).filter(User.role == "CEO").first()
            if existing_ceo:
                existing_ceo.email = ceo_email
                existing_ceo.hashed_password = hash_password(ceo_password)
                existing_ceo.full_name = "Dr. Sabarinathan Muthu"
                db.commit()
                print(f"  -> Updated existing CEO credentials to: {ceo_email}")
            else:
                ceo = User(
                    email=ceo_email,
                    hashed_password=hash_password(ceo_password),
                    full_name="Dr.Sabarinathan Muthu",
                    role="CEO",
                    created_at=datetime.datetime.utcnow()
                )
                db.add(ceo)
                db.commit()
                print(f"  -> CEO Account Created: {ceo_email}")
        else:
            print("  -> CEO account already present.")

        # 3. Dynamic Departments Seeding (from existing employees to preserve all data)
        print("[3/5] Verifying Dynamic Departments...")
        existing_dept_names = [d[0] for d in db.query(Department.name).all()]
        emp_depts = [e[0] for e in db.query(Employee.department).distinct().all() if e[0]]
        
        # Default starting departments if database is empty
        all_initial_depts = list(dict.fromkeys(emp_depts + [
            "Software Development",
            "AI & Innovation",
            "Product & Design",
            "Data Analytics",
            "Web Development",
            "Human Resources",
            "Mobile App Development"
        ]))

        new_depts_added = 0
        for dname in all_initial_depts:
            if dname not in existing_dept_names:
                db.add(Department(
                    name=dname,
                    description=f"{dname} Department at Gateway Software Solutions",
                    is_active=True
                ))
                new_depts_added += 1
        if new_depts_added > 0:
            db.commit()
            print(f"  -> Seeded {new_depts_added} departments into database.")
        else:
            print(f"  -> {len(existing_dept_names)} departments already present.")

        # 4. Seed Gateway Software Solutions Employees
        print("[4/5] Checking Employee Directory...")
        emp_count = db.query(Employee).count()
        if emp_count == 0:
            sample_employees = [
                {
                    "employee_id": "GSS-1001",
                    "name": "Rajesh Kumar",
                    "email": "rajesh.kumar@gatewaysoftware.com",
                    "department": "Engineering",
                    "designation": "Lead Full Stack Architect",
                    "shift_start_time": "09:00:00",
                    "shift_end_time": "18:00:00",
                    "phone": "+91 98765 43210"
                },
                {
                    "employee_id": "GSS-1002",
                    "name": "Priya Sharma",
                    "email": "priya.sharma@gatewaysoftware.com",
                    "department": "Engineering",
                    "designation": "Senior React Developer",
                    "shift_start_time": "09:00:00",
                    "shift_end_time": "18:00:00",
                    "phone": "+91 98451 23456"
                },
                {
                    "employee_id": "GSS-1003",
                    "name": "Arun Prakash",
                    "email": "arun.prakash@gatewaysoftware.com",
                    "department": "Engineering",
                    "designation": "Backend Python Specialist",
                    "shift_start_time": "09:30:00",
                    "shift_end_time": "18:30:00",
                    "phone": "+91 97890 12345"
                },
                {
                    "employee_id": "GSS-1004",
                    "name": "Sarah Jenkins",
                    "email": "sarah.jenkins@gatewaysoftware.com",
                    "department": "AI & Innovation",
                    "designation": "Principal AI Scientist",
                    "shift_start_time": "09:00:00",
                    "shift_end_time": "18:00:00",
                    "phone": "+91 91234 56789"
                },
                {
                    "employee_id": "GSS-1005",
                    "name": "Karthik Subramanian",
                    "email": "karthik.s@gatewaysoftware.com",
                    "department": "AI & Innovation",
                    "designation": "Computer Vision Engineer",
                    "shift_start_time": "09:00:00",
                    "shift_end_time": "18:00:00",
                    "phone": "+91 96543 21098"
                },
                {
                    "employee_id": "GSS-1006",
                    "name": "Ananya Roy",
                    "email": "ananya.roy@gatewaysoftware.com",
                    "department": "Product & Design",
                    "designation": "Lead UI/UX Designer",
                    "shift_start_time": "09:30:00",
                    "shift_end_time": "18:30:00",
                    "phone": "+91 98111 22233"
                },
                {
                    "employee_id": "GSS-1007",
                    "name": "David Miller",
                    "email": "david.miller@gatewaysoftware.com",
                    "department": "Product & Design",
                    "designation": "Technical Product Manager",
                    "shift_start_time": "09:00:00",
                    "shift_end_time": "18:00:00",
                    "phone": "+91 95432 10987"
                },
                {
                    "employee_id": "GSS-1008",
                    "name": "Meera Nair",
                    "email": "meera.nair@gatewaysoftware.com",
                    "department": "DevOps & Cloud",
                    "designation": "Senior Cloud Reliability Engineer",
                    "shift_start_time": "09:00:00",
                    "shift_end_time": "18:00:00",
                    "phone": "+91 94321 09876"
                },
                {
                    "employee_id": "GSS-1009",
                    "name": "Rohan Verma",
                    "email": "rohan.verma@gatewaysoftware.com",
                    "department": "Quality Assurance",
                    "designation": "QA Automation Lead",
                    "shift_start_time": "09:00:00",
                    "shift_end_time": "18:00:00",
                    "phone": "+91 93210 98765"
                },
                {
                    "employee_id": "GSS-1010",
                    "name": "Shalini Gupta",
                    "email": "shalini.gupta@gatewaysoftware.com",
                    "department": "Human Resources",
                    "designation": "Director of People & Culture",
                    "shift_start_time": "09:00:00",
                    "shift_end_time": "18:00:00",
                    "phone": "+91 92109 87654"
                }
            ]

            for item in sample_employees:
                emp = Employee(
                    employee_id=item["employee_id"],
                    name=item["name"],
                    email=item["email"],
                    department=item["department"],
                    designation=item["designation"],
                    shift_start_time=item["shift_start_time"],
                    shift_end_time=item["shift_end_time"],
                    phone=item.get("phone"),
                    face_registered=False,
                    consent_given=False,
                    is_active=True,
                    created_at=datetime.datetime.utcnow() - datetime.timedelta(days=30)
                )
                db.add(emp)
            db.commit()
            print(f"  -> Added {len(sample_employees)} Gateway employees.")
        else:
            print(f"  -> {emp_count} employees already present.")

        # 4. Seed Attendance History (past 6 days and today)
        print("[4/4] Populating Attendance Records & Late Calculation...")
        att_count = db.query(Attendance).count()
        if att_count == 0:
            employees = db.query(Employee).all()
            today = datetime.date.today()

            for day_offset in range(6, -1, -1):
                cur_date = today - datetime.timedelta(days=day_offset)
                date_str = cur_date.strftime("%Y-%m-%d")
                is_today = (day_offset == 0)

                for emp in employees:
                    scenario = random.random()

                    # Shift start parsing
                    shift_parts = [int(p) for p in emp.shift_start_time.split(":")[:2]]
                    shift_hour = shift_parts[0]
                    shift_min = shift_parts[1]

                    if is_today:
                        # Today's active scenario
                        if scenario < 0.70:
                            # Checked-in today, currently working
                            is_late = random.random() < 0.25
                            if is_late:
                                hour = shift_hour
                                minute = shift_min + random.randint(18, 45)
                                if minute >= 60:
                                    hour += 1
                                    minute -= 60
                                late_mins = (hour - shift_hour) * 60 + (minute - shift_min)
                                status = "Late"
                            else:
                                hour = shift_hour if shift_min > 0 else (shift_hour - 1)
                                minute = max(0, shift_min - random.randint(2, 10))
                                late_mins = 0
                                status = "Present"

                            check_in = f"{hour:02d}:{minute:02d}:15"

                            att = Attendance(
                                employee_id=emp.id,
                                attendance_date=date_str,
                                check_in_time=check_in,
                                check_out_time=None,
                                attendance_status=status,
                                late_minutes=late_mins,
                                working_hours=0.0,
                                confidence_score=round(random.uniform(92.0, 99.5), 1),
                                verification_method="Face Recognition",
                                notes="Biometric check-in recorded via webcam kiosk."
                            )
                            db.add(att)
                        elif scenario < 0.85:
                            # Full completed shift today
                            check_in = f"{shift_hour:02d}:02:10"
                            check_out = "17:35:40"
                            att = Attendance(
                                employee_id=emp.id,
                                attendance_date=date_str,
                                check_in_time=check_in,
                                check_out_time=check_out,
                                attendance_status="Completed",
                                late_minutes=0,
                                working_hours=8.55,
                                confidence_score=round(random.uniform(94.0, 99.0), 1),
                                verification_method="Face Recognition",
                                notes="Full shift completed."
                            )
                            db.add(att)
                        # else: absent today
                    else:
                        # Historical past days
                        if scenario < 0.88:
                            is_late = random.random() < 0.20
                            if is_late:
                                hour_in = shift_hour
                                min_in = shift_min + random.randint(16, 50)
                                if min_in >= 60:
                                    hour_in += 1
                                    min_in -= 60
                                late_mins = (hour_in - shift_hour) * 60 + (min_in - shift_min)
                                status = "Late (Completed)"
                            else:
                                hour_in = shift_hour
                                min_in = max(0, shift_min - random.randint(0, 10))
                                late_mins = 0
                                status = "Completed"

                            check_in = f"{hour_in:02d}:{min_in:02d}:00"
                            check_out = f"18:{random.randint(5, 30):02d}:00"

                            # Compute hours
                            t1 = datetime.datetime.strptime(check_in, "%H:%M:%S")
                            t2 = datetime.datetime.strptime(check_out, "%H:%M:%S")
                            hours = round((t2 - t1).total_seconds() / 3600.0, 2)

                            att = Attendance(
                                employee_id=emp.id,
                                attendance_date=date_str,
                                check_in_time=check_in,
                                check_out_time=check_out,
                                attendance_status=status,
                                late_minutes=late_mins,
                                working_hours=hours,
                                confidence_score=round(random.uniform(93.0, 99.0), 1),
                                verification_method="Face Recognition"
                            )
                            db.add(att)

            db.commit()
            print("  -> Seeded attendance records with computed late minutes.")
        else:
            print(f"  -> {att_count} attendance records already present.")

        # Initial audit log
        audit = AuditLog(
            action="SYSTEM_INIT",
            details="Gateway Software Solutions AI Attendance System initialized successfully.",
            timestamp=datetime.datetime.utcnow()
        )
        db.add(audit)
        db.commit()

        print("=" * 65)
        print(" Initialization complete! Ready for CEO and Employee usage.")
        print("=" * 65)

    finally:
        db.close()

if __name__ == "__main__":
    initialize_database()
