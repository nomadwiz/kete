"""
Does the committed openapi.json still describe the app main.py builds?

    pytest tests/test_contract.py

The only thing that made openapi.json worth committing is that it is the
contract and not a copy of one. Nothing enforced that: re-exporting after a
change to main.py was an instruction in backend/README.md, and an instruction
is not a check. Drift would otherwise be found when a generated client field
breaks at runtime, which is the failure the export was meant to prevent.

Unlike the rest of this folder these need no database, so they run whether or
not TEST_DATABASE_URL is set — they read the code, not the tables.
"""

import json
from pathlib import Path

from main import app

COMMITTED = Path(__file__).resolve().parent.parent / "openapi.json"


def test_committed_schema_matches_app():
    """Compare parsed documents, so a future reformat of the file is not a failure."""
    committed = json.loads(COMMITTED.read_text(encoding="utf-8"))
    live = json.loads(json.dumps(app.openapi()))
    assert committed == live, (
        "backend/openapi.json is out of date with main.py — "
        "run `python export_openapi.py` and commit the result"
    )


def test_every_protected_operation_declares_401():
    """A client that redirects on 401 needs the contract to admit 401 exists."""
    schema = json.loads(COMMITTED.read_text(encoding="utf-8"))
    missing = [
        f"{method.upper()} {path}"
        for path, methods in schema["paths"].items()
        for method, op in methods.items()
        if "security" in op and "401" not in op["responses"]
    ]
    assert not missing, f"protected operations with no declared 401: {missing}"
