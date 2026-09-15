"""
Create the Kete tables in whichever database .env points at.

    python init_db.py

Reads schema.sql and runs it. Safe to run more than once: every statement is
CREATE ... IF NOT EXISTS, so existing tables and the data in them are untouched.

If the database itself does not exist yet (common on a fresh RDS instance where
no initial database name was set), this creates it first.

This exists so you do not need the psql command line. It talks to the database
through the same connection settings the API uses, so if this works, the API will
work too.
"""

from pathlib import Path

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

from database import DATABASE_URL, engine

SCHEMA = Path(__file__).with_name("schema.sql")

EXPECTED = ["users", "profiles", "nutrition_targets", "recipes", "plan_slots"]


def _safe(url: str) -> str:
    """The same connection string with the password replaced by ****."""
    try:
        u = make_url(url)
        return str(u.set(password="****")) if u.password else url
    except Exception:
        return "(unparseable connection string)"


def _create_database_if_missing() -> None:
    """A new RDS instance may have no 'kete' database. Create it once.

    CREATE DATABASE cannot run inside a transaction, hence AUTOCOMMIT, and it
    has to be issued while connected to some *other* database, hence 'postgres'.
    """
    url = make_url(DATABASE_URL)
    target = url.database
    try:
        with engine.connect():
            return  # it exists, nothing to do
    except OperationalError as exc:
        if f'database "{target}" does not exist' not in str(exc):
            raise  # a different problem — let it surface

    print(f'Database "{target}" does not exist yet. Creating it.')
    admin = create_engine(url.set(database="postgres"))
    with admin.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.exec_driver_sql(f'CREATE DATABASE "{target}"')
    admin.dispose()
    print(f'Created "{target}".\n')


def main() -> None:
    print(f"Target: {_safe(DATABASE_URL)}\n")

    if not SCHEMA.exists():
        raise SystemExit(f"Cannot find {SCHEMA.name} next to this script.")

    _create_database_if_missing()

    sql = SCHEMA.read_text(encoding="utf-8")

    # exec_driver_sql hands the file straight to psycopg2 instead of letting
    # SQLAlchemy scan it for bind parameters, so it runs exactly as written.
    with engine.begin() as conn:
        conn.exec_driver_sql(sql)

    found = set(inspect(engine).get_table_names())
    print("Tables now in the database:")
    for table in EXPECTED:
        print(f"  {'OK     ' if table in found else 'MISSING'} {table}")

    missing = [t for t in EXPECTED if t not in found]
    if missing:
        raise SystemExit(f"\nStill missing: {', '.join(missing)}")

    print("\nAll five tables are present. Run  python check_db.py  to confirm.")


if __name__ == "__main__":
    main()
