"""
B19 (nomadwiz/kete#263): schema.sql and models.py build the same tables.

The server's database is built from schema.sql (init_db.py), and the tests'
from models.py (conftest.py's create_all). models.py says the two match, and on
01-10-2026 they did not: six checks named on one side only, five timestamps and
servings with no database default on the other, and an index each side lacked.
Every test in this suite ran against the models.py version, so none of them
could see it.

Each file is built into a PostgreSQL schema of its own inside the test
database, and the catalogue is compared: every column with its type, nullability
and default, every constraint with its definition, and every index.
"""

import re
from pathlib import Path

import pytest
from sqlalchemy import text

import models

SCHEMA_SQL = Path(__file__).resolve().parent.parent / "schema.sql"
FROM_SQL, FROM_MODELS = "b19_from_sql", "b19_from_models"

COLUMNS = """
    SELECT table_name, column_name, data_type, character_maximum_length,
           numeric_precision, numeric_scale, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = :s"""
CONSTRAINTS = """
    SELECT c.conrelid::regclass::text, c.conname, c.contype,
           pg_get_constraintdef(c.oid)
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = :s"""
INDEXES = "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = :s"


@pytest.fixture(scope="module")
def built(engine):
    """One schema built by each file, dropped again afterwards."""
    with engine.begin() as conn:
        for s in (FROM_SQL, FROM_MODELS):
            conn.execute(text(f"DROP SCHEMA IF EXISTS {s} CASCADE"))
            conn.execute(text(f"CREATE SCHEMA {s}"))
        conn.execute(text(f"SET LOCAL search_path TO {FROM_SQL}"))
        conn.exec_driver_sql(SCHEMA_SQL.read_text(encoding="utf-8"))
    with engine.begin() as conn:
        models.Base.metadata.create_all(
            conn.execution_options(schema_translate_map={None: FROM_MODELS}))
    yield engine
    with engine.begin() as conn:
        for s in (FROM_SQL, FROM_MODELS):
            conn.execute(text(f"DROP SCHEMA {s} CASCADE"))


def _catalogue(engine, query, schema):
    """The rows a query returns for one schema, with the schema's name taken out."""
    with engine.connect() as conn:
        rows = conn.execute(text(query), {"s": schema}).all()
    strip = re.compile(rf"\b{schema}\.")
    return {tuple(strip.sub("", str(v)) for v in row) for row in rows}


@pytest.mark.parametrize("what, query", [("columns", COLUMNS),
                                          ("constraints", CONSTRAINTS),
                                          ("indexes", INDEXES)])
def test_schema_sql_and_models_build_the_same(built, what, query):
    from_sql = _catalogue(built, query, FROM_SQL)
    from_models = _catalogue(built, query, FROM_MODELS)
    assert from_sql, f"schema.sql built no {what}"
    assert sorted(from_sql - from_models) == [], f"{what} only schema.sql builds"
    assert sorted(from_models - from_sql) == [], f"{what} only models.py builds"
