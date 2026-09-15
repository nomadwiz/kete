"""Find out what /register is actually throwing.

Runs the same work the endpoint does, one stage at a time, and writes the full
traceback to debug_register.log so it can be read without scrolling a terminal.

    python debug_register.py
"""

import traceback
import sys
from datetime import datetime

LOG = open("debug_register.log", "w", encoding="utf-8")


def say(*parts):
    line = " ".join(str(p) for p in parts)
    print(line)
    LOG.write(line + "\n")
    LOG.flush()


def stage(label, fn):
    try:
        result = fn()
    except Exception:
        say(f"FAIL  {label}")
        say("-" * 70)
        say(traceback.format_exc())
        say("-" * 70)
        LOG.close()
        sys.exit(1)
    say(f"OK    {label}")
    return result


say("debug_register", datetime.now().isoformat(timespec="seconds"))

# 1. Can we even import the app?
stage("import database", lambda: __import__("database"))
import database

masked = database.DATABASE_URL
if "@" in masked:                     # hide the password
    head, tail = masked.split("@", 1)
    masked = head.split("//")[0] + "//" + head.split("//")[1].split(":")[0] + ":***@" + tail
say("      url:", masked)

stage("import models", lambda: __import__("models"))
stage("import security", lambda: __import__("security"))
import models, security

# 2. Does the connection work at all?
from sqlalchemy import text
stage("connect to the database",
      lambda: database.engine.connect().execute(text("SELECT 1")).scalar())

# 3. Does the users table exist, and what columns does it really have?
def describe():
    with database.engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT column_name, data_type, is_nullable "
            "FROM information_schema.columns WHERE table_name='users' "
            "ORDER BY ordinal_position")).all()
    return rows

cols = stage("read the users table definition", describe)
if not cols:
    say("      users table DOES NOT EXIST — run: python init_db.py")
else:
    for name, dtype, nullable in cols:
        say(f"      {name:<15} {dtype:<28} {'NULL' if nullable=='YES' else 'NOT NULL'}")

# 4. Does password hashing work?
h = stage("hash a password", lambda: security.hash_password("Infs803$"))
say(f"      hash is {len(h)} characters")

# 5. The actual insert, in a transaction we roll back.
def insert():
    db = database.SessionLocal()
    try:
        u = models.User(first_name="debug", last_name="probe",
                        username="__debug_probe__", email="__debug_probe__@example.com",
                        password_hash=h)
        db.add(u)
        db.flush()            # sends the INSERT without committing
        db.rollback()         # leave no trace
        return "insert accepted"
    finally:
        db.close()

stage("insert a user row (rolled back)", insert)

say("\nEverything the endpoint does works in isolation.")
say("If /register still 500s, the traceback in the uvicorn terminal is the answer.")
LOG.close()
