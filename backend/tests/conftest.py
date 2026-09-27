"""
Shared set-up for the backend tests.

The tests need a real PostgreSQL, because what they check is how the database's
own constraints behave — something SQLite or a mock cannot stand in for. They
run against the database named by TEST_DATABASE_URL and wipe it before every
test, so that must be a throwaway database of its own, never the one the API
uses. Unset, the whole suite is skipped.
"""

import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# The backend is a folder of modules rather than a package, so put it on the
# path the way running `uvicorn main:app` from inside it would.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import models  # noqa: E402

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


@pytest.fixture(scope="session")
def engine():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not set — see backend/README.md")
    # Every test truncates every table. Refuse outright rather than trust
    # whoever set the variable to have pointed it somewhere disposable.
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
