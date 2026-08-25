"""
Quick connection check. Run this after setting up PostgreSQL:

    python check_db.py

It tells you whether the app can reach the database and which tables it found.
"""

from sqlalchemy import inspect, text

from database import DATABASE_URL, engine

# Hide the password when printing the connection string
safe = DATABASE_URL
if "@" in safe and "//" in safe:
    head, tail = safe.split("//", 1)
    creds, host = tail.split("@", 1)
    user = creds.split(":")[0]
    safe = f"{head}//{user}:****@{host}"

print(f"Connecting to: {safe}\n")

try:
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version()")).scalar()
    print("Connected.")
    print(f"  {version.split(',')[0]}\n")
except Exception as e:
    print("Could NOT connect.\n")
    print(f"  {type(e).__name__}: {e}\n")
    print("Common causes:")
    print("  - PostgreSQL is not running (check Services on Windows)")
    print("  - wrong password in .env")
    print("  - the 'kete' database has not been created yet")
    raise SystemExit(1)

expected = {"users", "profiles", "nutrition_targets", "recipes", "plan_slots"}
found = set(inspect(engine).get_table_names())

print("Tables found:")
for t in sorted(found):
    print(f"  {t}")

missing = expected - found
if missing:
    print(f"\nMissing: {', '.join(sorted(missing))}")
    print("Run schema.sql against the database (see DATABASE_SETUP.md step 4).")
else:
    print("\nAll five tables present. You are ready.")
