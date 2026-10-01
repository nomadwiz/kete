"""
B24 (nomadwiz/kete#307): GET /mealplan and GET /targets, as a client receives them.

Every other test in this folder calls the route function directly, which is the
right way to test what the database does but never passes through FastAPI. So
three things were tested on no endpoint at all: the `week` query pattern, the
401 that Depends(current_user_id) gives, and the response_model serialisation
that turns the Numeric columns into the integers the contract promises.
test_contract.py checks what the schema declares; this file checks what is
served. It goes through TestClient for exactly those three things and no more.

The first half needs no database, because every request in it is refused
before a query runs, and it proves that by handing the route a session that
fails the test if touched. It therefore runs in CI, where the database tests
are skipped (S15, #305). The second half needs TEST_DATABASE_URL, like the rest
of the suite.
"""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import main
import models
from security import make_token

WEEK = "2026-W40"


def _bearer(user_id):
    return {"Authorization": f"Bearer {make_token(user_id)}"}


class _Untouchable:
    """A stand-in session for requests that must be refused before any query."""

    def __getattr__(self, name):
        raise AssertionError(f"the request reached the database (db.{name})")


@pytest.fixture
def client():
    main.app.dependency_overrides[main.get_db] = lambda: _Untouchable()
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


# --------------------------------------------------------------------------
# Refused before the database: no TEST_DATABASE_URL needed
# --------------------------------------------------------------------------
# Both endpoints that read a week by query, so a test notices if the two ever
# stop validating it the same way.
@pytest.mark.parametrize("path", ["/mealplan", "/mealplan/summary"])
@pytest.mark.parametrize("week", [
    "2026-39",     # no W
    "2026-W00",    # weeks start at 01
    "2026-W54",    # and end at 53
    "2026-w39",    # lower-case w
    "26-W39",      # two-digit year
    None,          # missing altogether
])
def test_a_malformed_week_is_a_422(client, path, week):
    params = {} if week is None else {"week": week}
    resp = client.get(path, params=params, headers=_bearer(1))
    assert resp.status_code == 422
    # FastAPI's own validation answers with a list of field errors, not the
    # {"detail": str} every other error has (ErrorDetail in main.py).
    detail = resp.json()["detail"]
    assert isinstance(detail, list)
    assert [e["loc"] for e in detail] == [["query", "week"]]


@pytest.mark.parametrize("path", [f"/mealplan?week={WEEK}", "/targets"])
def test_no_bearer_token_is_a_401(client, path):
    resp = client.get(path)
    assert resp.status_code == 401
    # Only the missing-header case carries this; see the comment above AUTH.
    assert resp.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("path", [f"/mealplan?week={WEEK}", "/targets"])
def test_a_token_that_does_not_verify_is_a_401(client, path):
    resp = client.get(path, headers={"Authorization": "Bearer not-a-token"})
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Invalid or expired token"}


# --------------------------------------------------------------------------
# Served from the database: needs TEST_DATABASE_URL
# --------------------------------------------------------------------------
@pytest.fixture
def db_client(Session):
    def session():
        with Session() as db:
            yield db
    main.app.dependency_overrides[main.get_db] = session
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def _user(db, name):
    user = models.User(first_name="Test", last_name="User", username=name,
                       email=f"{name}@example.com", password_hash="not-a-real-hash")
    db.add(user)
    db.flush()
    return user.user_id


def _recipe(db, user_id, name, figures):
    recipe = models.Recipe(user_id=user_id, name=name, **figures)
    db.add(recipe)
    db.flush()
    return recipe.recipe_id


def _slot(db, user_id, recipe_id, day, meal, week=WEEK):
    slot = models.PlanSlot(user_id=user_id, recipe_id=recipe_id, week=week,
                           day_of_week=day, meal_position=meal)
    db.add(slot)
    db.flush()
    return slot.slot_id


# Whole numbers only. A fractional figure would pin whether int() truncates or
# rounds, which is ADR 007's question, not this test's.
PORRIDGE = dict(energy_kcal=500, protein_g=30, carbs_g=60, fat_g=15)
CURRY = dict(energy_kcal=700, protein_g=40, carbs_g=80, fat_g=25)
NUTRIENTS = ["energy_kcal", "protein_g", "carbs_g", "fat_g"]


def test_mealplan_serves_the_weeks_own_slots_in_the_contracts_shape(Session,
                                                                     db_client):
    with Session() as db:
        cook = _user(db, "cook")
        porridge = _recipe(db, cook, "Porridge", PORRIDGE)
        curry = _recipe(db, cook, "Curry", CURRY)
        breakfast = _slot(db, cook, porridge, "Mon", "breakfast")
        dinner = _slot(db, cook, curry, "Tue", "dinner")
        _slot(db, cook, curry, "Wed", "lunch", week="2026-W41")    # another week
        other = _user(db, "neighbour")
        feast = _recipe(db, other, "Feast", CURRY)
        _slot(db, other, feast, "Mon", "lunch")                    # another user
        db.commit()

    resp = db_client.get("/mealplan", params={"week": WEEK}, headers=_bearer(cook))

    assert resp.status_code == 200
    assert resp.json() == [
        {"slot_id": breakfast, "day_of_week": "Mon", "meal_position": "breakfast",
         "recipe": {"recipe_id": porridge, "name": "Porridge", **PORRIDGE}},
        {"slot_id": dinner, "day_of_week": "Tue", "meal_position": "dinner",
         "recipe": {"recipe_id": curry, "name": "Curry", **CURRY}},
    ]
    # == accepts 500.0 for 500. The columns are Numeric, so check the contract's
    # integers really are integers on the wire.
    for slot in resp.json():
        assert all(type(slot["recipe"][n]) is int for n in NUTRIENTS)


def test_mealplan_of_an_empty_week_is_an_empty_list(Session, db_client):
    with Session() as db:
        cook = _user(db, "cook")
        db.commit()
    resp = db_client.get("/mealplan", params={"week": WEEK}, headers=_bearer(cook))
    assert resp.status_code == 200
    assert resp.json() == []


TARGETS = dict(energy_kcal=2000, protein_g=150, carbs_g=200, fat_g=67)
COMPUTED_AT = datetime(2026, 10, 1, 9, 30, tzinfo=timezone.utc)


def test_targets_serves_the_stored_figures_as_whole_numbers(Session, db_client):
    with Session() as db:
        uid = _user(db, "cook")
        db.add(models.NutritionTarget(user_id=uid, computed_at=COMPUTED_AT,
                                      **TARGETS))
        db.commit()

    resp = db_client.get("/targets", headers=_bearer(uid))

    assert resp.status_code == 200
    body = resp.json()
    # Compared as an instant: the offset it is written with depends on the
    # database server's time zone.
    assert datetime.fromisoformat(body.pop("computed_at")) == COMPUTED_AT
    assert body == TARGETS
    assert all(type(body[n]) is int for n in NUTRIENTS)


def test_targets_before_any_are_saved_is_a_404(Session, db_client):
    with Session() as db:
        uid = _user(db, "newcomer")
        db.commit()
    resp = db_client.get("/targets", headers=_bearer(uid))
    assert resp.status_code == 404
    assert resp.json() == {"detail": "No targets yet — save your body metrics first"}


def test_targets_are_never_another_users(Session, db_client):
    with Session() as db:
        cook = _user(db, "cook")
        db.add(models.NutritionTarget(user_id=cook, **TARGETS))
        newcomer = _user(db, "newcomer")
        db.commit()
    assert db_client.get("/targets", headers=_bearer(cook)).status_code == 200
    assert db_client.get("/targets", headers=_bearer(newcomer)).status_code == 404
