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
                    full_name="Dr. Sabarinathan Muthu",
                    role="CEO",
                    created_at=datetime.datetime.utcnow()
                )
                db.add(ceo)
                db.commit()
                print(f"  -> CEO Account Created: {ceo_email}")
        else:
            if ceo.full_name != "Dr. Sabarinathan Muthu":
                ceo.full_name = "Dr. Sabarinathan Muthu"
                db.commit()
                print("  -> CEO full_name updated to: Dr. Sabarinathan Muthu")
            else:
                print("  -> CEO account already present and verified.")

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

        # 4. Employee Directory (Automatic Demo Seeding Disabled)
        print("[4/5] Checking Employee Directory...")
        emp_count = db.query(Employee).count()
        print(f"  -> Employee Directory contains {emp_count} registered employee(s). (Automatic demo seeding permanently disabled).")

        # 5. Attendance Records (Automatic Demo Seeding Disabled)
        print("[5/5] Checking Attendance Records...")
        att_count = db.query(Attendance).count()
        print(f"  -> Attendance table contains {att_count} record(s). (Automatic demo seeding permanently disabled).")

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
