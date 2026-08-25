# Kete backend

RESTful API for the Kete meal planner, implemented in Python with the FastAPI
framework. INFS803 A02, Choice B.

## Status: stub

All 17 endpoints exist with their final request and response shapes but return
sample data. This lets the front end be built in parallel with the real logic.

**The rule: the shape must not change when real logic lands.** If a field has to
change, tell the team before you commit it — the front end is built against it.

## Run it

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Then open **http://localhost:8000/docs** for the interactive Swagger page. This
is also how markers test the backend without the client: register or log in
there, copy the token, press **Authorize**, then call the protected endpoints.

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

`schema.sql` creates the five tables in RDS PostgreSQL. Run it once against the
instance. Note the unique constraint on `plan_slots` — one recipe per day/meal
slot per user — and `ON DELETE CASCADE` throughout, so deleting a user cleans up
their profile, targets, recipes and plan slots.

## What to replace, in order

1. Connect SQLAlchemy to RDS, swap `/register` and `/login` for real inserts and
   password hashing.
2. `/profile/metrics` — the engine already computes correctly; add the two
   upserts (profiles, then nutrition_targets).
3. Recipes CRUD, then the S3 photo upload.
4. Meal plan CRUD, then `generate`.

Each `# TODO:` in `main.py` marks the exact spot.

## Before deploying to EC2

- Move `JWT_SECRET` to an environment variable.
- Replace `allow_origins=["*"]` with the real S3 site URL.
- Run behind nginx rather than exposing uvicorn directly.
