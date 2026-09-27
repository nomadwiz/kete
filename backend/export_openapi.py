"""
Write the API contract to openapi.json, next to this file.

The schema FastAPI generates from main.py is the contract; there is no second,
hand-written document to drift from it. This file is a copy of that schema,
committed so the client's build and CI can read it without running the API.
Never edit openapi.json by hand — change main.py, then run this again:

    python export_openapi.py

It needs no database: generating the schema reads the code, not the tables.
"""

import json
from pathlib import Path

from main import app

OUT = Path(__file__).resolve().parent / "openapi.json"


def main() -> None:
    schema = app.openapi()
    OUT.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8", newline="\n")
    operations = sum(len(methods) for methods in schema["paths"].values())
    print(f"wrote {OUT.name}: {len(schema['paths'])} paths, {operations} operations")


if __name__ == "__main__":
    main()
