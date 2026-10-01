"""
B11 (nomadwiz/kete#164): one user cannot reach another user's data (FR-15).

Every protected endpoint takes the user id from the bearer token and scopes its
queries by it, and one that is asked for another account's record answers
404, never 403, so it does not even confirm the record exists. That is
asserted in main.py's docstring. This file demonstrates it, endpoint by
endpoint, through TestClient so the id really does come from the token.

Two accounts: Alice owns a recipe, a planned slot, saved measurements and
targets; Mallory has a recipe and a slot of her own, and acts against Alice.
Every test ends by comparing all of Alice's rows, in all five tables, with
what they were before Mallory's request.

Six endpoints already had a cross-user test elsewhere when this file was
written. COVERED, at the bottom, names where each protected endpoint's test
lives, and a test checks that list against the protected operations the app
actually serves, so a new endpoint without one fails here.
"""

from pathlib import Path
from types import SimpleNamespace

import pytest

import main
import models
from security import hash_password, make_token

PASSWORD = "correct-horse"
PASSWORD_HASH = hash_password(PASSWORD)      # once: PBKDF2 is slow on purpose
WEEK = "2026-W40"
MISSING = 2_000_000_000                      # an id no row has

METRICS = dict(weight_kg=70, height_cm=175, age=30, sex="male",
               activity_level="moderate")
RECIPE = dict(name="Toast", cuisine="", ingredients="bread", steps="toast it",
              servings=1, energy_kcal=200, protein_g=6, carbs_g=30, fat_g=4)
TABLES = (models.User, models.Profile, models.NutritionTarget, models.Recipe,
          models.PlanSlot)


def _bearer(user_id):
    return {"Authorization": f"Bearer {make_token(user_id)}"}


def _user(db, name):
    user = models.User(first_name="Test", last_name="User", username=name,
                       email=f"{name}@example.com", password_hash=PASSWORD_HASH)
    db.add(user)
    db.flush()
    return user.user_id


def _recipe(db, user_id, name):
    recipe = models.Recipe(user_id=user_id, name=name, energy_kcal=500,
                           protein_g=30, carbs_g=60, fat_g=15)
    db.add(recipe)
    db.flush()
    return recipe.recipe_id


def _slot(db, user_id, recipe_id):
    slot = models.PlanSlot(user_id=user_id, recipe_id=recipe_id, week=WEEK,
                           day_of_week="Mon", meal_position="lunch")
    db.add(slot)
    db.flush()
    return slot.slot_id


def _snapshot(Session, user_id):
    """Every column of every row this user owns, in all five tables."""
    with Session() as db:
        return {
            table.__tablename__: [
                {c.key: getattr(row, c.key) for c in table.__table__.columns}
                for row in db.query(table).filter_by(user_id=user_id)
                             .order_by(*table.__table__.primary_key.columns)
            ]
            for table in TABLES
        }


@pytest.fixture
def two(Session):
    with Session() as db:
        alice = _user(db, "alice")
        db.add(models.Profile(user_id=alice, **METRICS))
        db.add(models.NutritionTarget(user_id=alice,
                                      **main.compute_targets(**METRICS)))
        alice_recipe = _recipe(db, alice, "Laksa")
        alice_slot = _slot(db, alice, alice_recipe)

        mallory = _user(db, "mallory")
        _slot(db, mallory, _recipe(db, mallory, "Porridge"))
        db.commit()
    return SimpleNamespace(alice=alice, alice_recipe=alice_recipe,
                           alice_slot=alice_slot, mallory=mallory)


# --------------------------------------------------------------------------
# Naming Alice's record: the same 404 as a record that does not exist
# --------------------------------------------------------------------------
# Keyed as openapi.json writes each operation, so COVERED can reuse the keys.
BY_ID = {
    "GET /recipes/{recipe_id}":
        lambda recipe, slot: ("GET", f"/recipes/{recipe}", None),
    "PUT /recipes/{recipe_id}":
        lambda recipe, slot: ("PUT", f"/recipes/{recipe}", RECIPE),
    "DELETE /recipes/{recipe_id}":
        lambda recipe, slot: ("DELETE", f"/recipes/{recipe}", None),
    "POST /mealplan":
        lambda recipe, slot: ("POST", "/mealplan",
                              dict(recipe_id=recipe, week=WEEK,
                                   day_of_week="Tue", meal_position="dinner")),
    "DELETE /mealplan/{slot_id}":
        lambda recipe, slot: ("DELETE", f"/mealplan/{slot}", None),
}


@pytest.mark.parametrize("operation", BY_ID)
def test_naming_another_users_record_is_the_404_a_missing_one_gets(
        Session, db_client, two, operation):
    before = _snapshot(Session, two.alice)

    method, path, body = BY_ID[operation](two.alice_recipe, two.alice_slot)
    theirs = db_client.request(method, path, json=body,
                               headers=_bearer(two.mallory))
    method, path, body = BY_ID[operation](MISSING, MISSING)
    missing = db_client.request(method, path, json=body,
                                headers=_bearer(two.mallory))

    assert theirs.status_code == 404
    # Identical to a missing record, so the answer does not reveal that
    # Alice's exists.
    assert theirs.json() == missing.json()
    assert _snapshot(Session, two.alice) == before


# --------------------------------------------------------------------------
# Writing "my own" data: Mallory's changes, Alice's does not
# --------------------------------------------------------------------------
OWN_WRITES = {
    "PUT /profile":
        ("PUT", "/profile", dict(first_name="M", last_name="X",
                                 username="mallory2",
                                 email="mallory2@example.com",
                                 current_password=PASSWORD)),
    "PUT /profile/password":
        ("PUT", "/profile/password", dict(current_password=PASSWORD,
                                          new_password="battery-staple")),
    "POST /profile/metrics": ("POST", "/profile/metrics", METRICS),
    "POST /recipes": ("POST", "/recipes", RECIPE),
    "POST /mealplan/generate": ("POST", "/mealplan/generate", dict(week=WEEK)),
    "DELETE /mealplan/week/{week}": ("DELETE", f"/mealplan/week/{WEEK}", None),
}


@pytest.mark.parametrize("operation", OWN_WRITES)
def test_a_write_to_your_own_data_leaves_another_users_untouched(
        Session, db_client, two, operation):
    alice_before = _snapshot(Session, two.alice)
    mallory_before = _snapshot(Session, two.mallory)

    method, path, body = OWN_WRITES[operation]
    resp = db_client.request(method, path, json=body,
                             headers=_bearer(two.mallory))

    assert resp.status_code < 300
    # The write landed, and on Mallory: without this a request that changed
    # nothing at all would pass.
    assert _snapshot(Session, two.mallory) != mallory_before
    assert _snapshot(Session, two.alice) == alice_before


# --------------------------------------------------------------------------
# Reading "my own" data: never Alice's
# --------------------------------------------------------------------------
def test_get_profile_answers_with_your_own_account(Session, db_client, two):
    resp = db_client.get("/profile", headers=_bearer(two.mallory))
    assert resp.status_code == 200
    assert resp.json() == dict(first_name="Test", last_name="User",
                               username="mallory",
                               email="mallory@example.com")


def test_get_metrics_is_a_404_when_only_someone_else_has_saved_any(
        Session, db_client, two):
    # Alice has measurements; Mallory has none.
    resp = db_client.get("/profile/metrics", headers=_bearer(two.mallory))
    assert resp.status_code == 404
    assert db_client.get("/profile/metrics",
                         headers=_bearer(two.alice)).status_code == 200


# --------------------------------------------------------------------------
# Every protected endpoint has one (no database needed)
# --------------------------------------------------------------------------
HERE = "test_isolation.py::"
COVERED = {
    **{op: HERE + "test_naming_another_users_record_is_the_404_a_missing_one_gets"
       for op in BY_ID},
    **{op: HERE + "test_a_write_to_your_own_data_leaves_another_users_untouched"
       for op in OWN_WRITES},
    "GET /profile": HERE + "test_get_profile_answers_with_your_own_account",
    "GET /profile/metrics":
        HERE + "test_get_metrics_is_a_404_when_only_someone_else_has_saved_any",
    # Written before this file, each for its own issue.
    "DELETE /profile":
        "test_account.py::test_deleting_one_account_leaves_another_untouched",
    "GET /targets": "test_served.py::test_targets_are_never_another_users",
    "GET /recipes":
        "test_search.py::test_the_search_stays_inside_the_users_own_recipes",
    "POST /recipes/{recipe_id}/photo":
        "test_photo.py::test_another_users_recipe_is_a_404_and_nothing_is_stored",
    "GET /mealplan":
        "test_served.py::test_mealplan_serves_the_weeks_own_slots_in_the_contracts_shape",
    "GET /mealplan/summary":
        "test_summary.py::test_another_users_slots_are_not_counted",
}


def test_every_protected_endpoint_has_a_cross_user_test():
    protected = {
        f"{method.upper()} {path}"
        for path, methods in main.app.openapi()["paths"].items()
        for method, op in methods.items()
        if "security" in op
    }
    assert set(COVERED) == protected, (
        f"no cross-user test named: {sorted(protected - set(COVERED))}; "
        f"named but not protected: {sorted(set(COVERED) - protected)}")

    tests = Path(__file__).resolve().parent
    for operation, where in COVERED.items():
        file, name = where.split("::")
        assert f"def {name}(" in (tests / file).read_text(encoding="utf-8"), (
            f"{operation}: {where} does not exist")
