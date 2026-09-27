# Kete backend

RESTful API for the Kete meal planner, implemented in Python with the FastAPI
framework. INFS803 A02, Choice B.

## Status

All 17 endpoints run real queries against PostgreSQL. Accounts, JWT auth, the
recipe library, the weekly plan and the nutrition engine are implemented, and
recipe photographs upload to S3 — that endpoint answers 503 when `S3_BUCKET`
is not configured rather than pretending to have stored anything.

**The request and response shapes are the contract the client is built
against.** If a field has to change, tell the team before you commit it.

Known gaps, each tracked as an issue rather than left in this file:

| Gap | Issue |
| --- | --- |
| Only the conflict tests exist — none yet for the nutrition engine or cross-user access | B10 (#160), B11 (#164) |
| Numeric inputs are unbounded — a bad value can be a 500, not a 422 | B14 (#153) |
| `requirements.txt` pins minimum versions, not exact ones | B7 (#159) |
| `JWT_SECRET` falls back to a published default instead of refusing to start | B9 (#162) |
| `allow_origins=["*"]` | B8 (#161) |
| A week view costs 22 queries, and plan slots carry no nutrition | B2 (#151) |
| Saved measurements cannot be read back | B3 (#152) |

## Run it

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # then put your real values in .env
python init_db.py                # creates the five tables
python check_db.py               # confirms the connection and the schema

uvicorn main:app --reload
```

The `.env` step is not optional — every endpoint reads and writes a database,
so the API will not serve a request without one. `.env` is gitignored;
`.env.example` is the committed template and explains each key, including how
the same keys point at either local PostgreSQL or RDS.

Then open **http://localhost:8000/docs** for the interactive Swagger page. This
is also how markers test the backend without the client: register or log in
there, copy the token, press **Authorize**, then call the protected endpoints.

## Test it

The tests need a real PostgreSQL, because they check how the database's own
constraints behave. They **wipe the database they run against**, so give them
a throwaway one of their own — never the one in `.env`, and never RDS (the
suite refuses an RDS address). Without `TEST_DATABASE_URL` they are skipped.

```bash
pip install -r requirements-dev.txt
createdb kete_test               # or CREATE DATABASE kete_test; in pgAdmin

# Windows PowerShell: $env:TEST_DATABASE_URL = "postgresql+psycopg2://..."
export TEST_DATABASE_URL="postgresql+psycopg2://postgres:<password>@localhost:5432/kete_test"
pytest
```

`tests/test_conflicts.py` covers B15 (#157): two requests racing for the same
username, email or plan slot get a 409, not a 500. Each test holds the clashing
row open in one session so the endpoint's own check misses it, then lets it
commit — the race is forced, not left to timing.

## Endpoints (17 total, 7 POST)

| # | Method | Path | Auth |
|---|--------|------|------|
| 1 | POST | `/register` | public |
| 2 | POST | `/login` | public |
| 3 | GET | `/profile` | bearer |
| 4 | PUT | `/profile` | bearer |
| 5 | POST | `/profile/metrics` | bearer |
| 6 | GET | `/targets` | bearer |
| 7 | GET | `/recipes?q=` | bearer |
| 8 | GET | `/recipes/{id}` | bearer |
| 9 | POST | `/recipes` | bearer |
| 10 | POST | `/recipes/{id}/photo` | bearer |
| 11 | PUT | `/recipes/{id}` | bearer |
| 12 | DELETE | `/recipes/{id}` | bearer |
| 13 | GET | `/mealplan?week=` | bearer |
| 14 | POST | `/mealplan` | bearer |
| 15 | DELETE | `/mealplan/{slot_id}` | bearer |
| 16 | POST | `/mealplan/generate` | bearer |
| 17 | DELETE | `/mealplan/week/{week}` | bearer |

Every endpoint except `/register` and `/login` needs an
`Authorization: Bearer <token>` header. The API reads `user_id` out of the token
and scopes every query by it, so the client never sends a user id.

## Fixed values — do not vary the spelling

- `sex`: `male`, `female`
- `activity_level`: `sedentary`, `light`, `moderate`, `active`, `very_active`
- `meal_position`: `breakfast`, `lunch`, `dinner`
- `day_of_week`: `Mon` … `Sun`
- errors are always `{"detail": "message"}`

## Database

`schema.sql` defines the five tables. You do not run it by hand — `init_db.py`
reads it and applies it to whichever database `.env` points at, creating the
database first if it does not exist. Every statement is `CREATE … IF NOT
EXISTS`, so it is safe to run repeatedly and leaves existing data alone. That
is also why it needs no psql on your machine.

Note the unique constraint on `plan_slots` — one recipe per day/meal slot per
user — and `ON DELETE CASCADE` throughout, so deleting a user cleans up their
profile, targets, recipes and plan slots.

The unique constraints are what finally stop a duplicate. Each endpoint checks
first, for a friendly message, but two requests can both pass that check;
`_commit_or_409` in `main.py` turns the constraint's refusal of the second into
the same 409 rather than a 500.

`check_db.py` reports what the connection and schema actually look like, and
`check_s3.py` does the same for the photo bucket.

## Before deploying to EC2

Three things, all tracked so none of them lives only here: generate a real
`JWT_SECRET` and refuse to start without it (B9, #162), replace
`allow_origins=["*"]` with the client's S3 origin (B8, #161), and run behind
nginx rather than exposing uvicorn directly (B13, #163).
