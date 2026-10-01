"""
Shared set-up for the backend tests.

The tests need a real PostgreSQL, because what they check is how the database's
own constraints behave — something SQLite or a mock cannot stand in for. They
run against the database named by TEST_DATABASE_URL and wipe it before every
test, so that must be a throwaway database of its own, never the one the API
uses. Unset, the database tests are skipped on a laptop and fail in CI.
"""

import os
import secrets
import sys
from pathlib import Path

# security.py refuses to import without a real JWT_SECRET, and the tests import
# main, which imports it. Give the suite a throwaway secret of its own so it
# does not depend on whatever happens to be in the developer's .env.
os.environ.setdefault("JWT_SECRET", secrets.token_hex(32))

import pytest
from sqlalchemy import create_engine, make_url, text
from sqlalchemy.orm import sessionmaker

# The backend is a folder of modules rather than a package, so put it on the
# path the way running `uvicorn main:app` from inside it would.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import database  # noqa: E402
import models  # noqa: E402

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


def _same_database(a: str, b: str) -> bool:
    """True when two URLs name the same database on the same server."""
    x, y = make_url(a), make_url(b)
    local = {"localhost", "127.0.0.1", "::1", None}
    same_host = x.host == y.host or (x.host in local and y.host in local)
    return same_host and (x.port or 5432) == (y.port or 5432) and x.database == y.database


@pytest.fixture(scope="session")
def engine():
    if not TEST_DATABASE_URL:
        # A skipped run exits 0, so in CI a missing database would look exactly
        # like a passing one (S15, #305). GitHub Actions sets CI=true.
        if os.getenv("CI"):
            pytest.fail("TEST_DATABASE_URL is not set in CI — see "
                        ".github/workflows/deploy-backend.yml", pytrace=False)
        pytest.skip("TEST_DATABASE_URL is not set — see backend/README.md")
    # Every test truncates every table. Refuse outright rather than trust
    # whoever set the variable to have pointed it somewhere disposable. The
    # likely slip is the database the API itself uses — the local `kete` you
    # develop against — so compare with that first. The RDS check is a
    # substring test and misses RDS reached through a tunnel or port-forward,
    # which the first check catches only if .env points the API there too.
    if _same_database(TEST_DATABASE_URL, database.DATABASE_URL):
        pytest.exit("TEST_DATABASE_URL is the API's own database (.env); "
                    "the tests would wipe it. Use a throwaway one.")
    if ".rds.amazonaws.com" in TEST_DATABASE_URL:
        pytest.exit("TEST_DATABASE_URL points at RDS; the tests wipe the database")

    eng = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def Session(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE plan_slots, recipes, nutrition_targets, profiles, users "
            "RESTART IDENTITY CASCADE"))
    return sessionmaker(bind=engine, autoflush=False)
