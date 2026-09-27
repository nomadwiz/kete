"""
B15 (nomadwiz/kete#157): a clash is a 409 even when two requests race.

Each endpoint here checks for a clash, then writes. Two requests can both pass
the check before either commits, and then the database's unique constraint is
what refuses the second one. These tests make that race happen on purpose
rather than hoping for it:

1. Session A writes the clashing row and flushes it without committing, so it
   holds the unique-index entry.
2. The endpoint runs in a thread on session B. Its check cannot see A's
   uncommitted row, so it passes, and its write then waits on A's lock.
3. Once B is seen waiting in pg_stat_activity, A commits and B's write fails
   on the constraint.

Before the fix, B raised the bare IntegrityError that reaches the client as a
500. The endpoint must answer 409, in the same words as its own check.
"""

import threading
import time

import pytest
from fastapi import HTTPException
from sqlalchemy import text

import main
import models

WEEK = "2026-W40"


def _user(db, username, email):
    user = models.User(first_name="Test", last_name="User", username=username,
                       email=email, password_hash="not-a-real-hash")
    db.add(user)
    db.flush()
    return user


def _seed_user_with_recipe(Session):
    with Session() as db:
        user = _user(db, "cook", "cook@example.com")
        recipe = models.Recipe(user_id=user.user_id, name="Porridge")
        db.add(recipe)
        db.commit()
        return user.user_id, recipe.recipe_id


def _wait_until_blocked(engine, thread, timeout=10.0):
    """Return once some connection is waiting on a lock in the test database."""
    deadline = time.monotonic() + timeout
    with engine.connect() as watcher:
        while time.monotonic() < deadline:
            waiting = watcher.execute(text(
                "SELECT count(*) FROM pg_stat_activity "
                "WHERE datname = current_database() AND wait_event_type = 'Lock'"
            )).scalar()
            if waiting:
                return
            if not thread.is_alive():
                pytest.fail("the endpoint finished without waiting on the "
                            "constraint, so the race never happened")
            time.sleep(0.02)
    pytest.fail("the endpoint never reached the constraint")


def _race(engine, Session, hold, act):
    """Run act(session_b) while session A holds the row hold(session_a) wrote."""
    a, b = Session(), Session()
    outcome = {}

    def run():
        try:
            outcome["value"] = act(b)
        except BaseException as exc:  # noqa: BLE001 — the test inspects it
            outcome["error"] = exc

    try:
        hold(a)
        a.flush()
        thread = threading.Thread(target=run)
        thread.start()
        _wait_until_blocked(engine, thread)
        a.commit()
        thread.join(10)
        assert not thread.is_alive(), "the endpoint hung after the commit"
    finally:
        a.close()
        b.close()
    return outcome


def _assert_409(outcome, detail):
    error = outcome.get("error")
    assert isinstance(error, HTTPException), f"expected a 409, got {error!r}"
    assert error.status_code == 409
    assert error.detail == detail


# --------------------------------------------------------------------------
# POST /register
# --------------------------------------------------------------------------
def test_register_race_on_username_is_409(engine, Session):
    outcome = _race(
        engine, Session,
        hold=lambda a: _user(a, "kiri", "first@example.com"),
        act=lambda b: main.register(main.RegisterIn(
            first_name="K", last_name="R", username="kiri",
            email="second@example.com", password="long-enough"), db=b))

    _assert_409(outcome, "That username is already taken")


def test_register_race_on_email_is_409(engine, Session):
    outcome = _race(
        engine, Session,
        hold=lambda a: _user(a, "first", "kiri@example.com"),
        act=lambda b: main.register(main.RegisterIn(
            first_name="K", last_name="R", username="second",
            email="kiri@example.com", password="long-enough"), db=b))

    _assert_409(outcome, "That email is already taken")


def test_register_ordinary_duplicate_is_still_409(Session):
    with Session() as db:
        _user(db, "kiri", "kiri@example.com")
        db.commit()

    with Session() as db, pytest.raises(HTTPException) as caught:
        main.register(main.RegisterIn(
            first_name="K", last_name="R", username="kiri",
            email="other@example.com", password="long-enough"), db=db)

    assert caught.value.status_code == 409
    assert caught.value.detail == "That username is already taken"


# --------------------------------------------------------------------------
# PUT /profile
# --------------------------------------------------------------------------
def test_update_profile_race_on_username_is_409(engine, Session):
    with Session() as db:
        me = _user(db, "me", "me@example.com").user_id
        db.commit()

    outcome = _race(
        engine, Session,
        hold=lambda a: _user(a, "wanted", "someone@example.com"),
        act=lambda b: main.update_profile(main.ProfileIn(
            first_name="M", last_name="E", username="wanted",
            email="me@example.com"), user_id=me, db=b))

    _assert_409(outcome, "That username is already taken")


def test_update_profile_ordinary_duplicate_is_still_409(Session):
    with Session() as db:
        me = _user(db, "me", "me@example.com").user_id
        _user(db, "other", "other@example.com")
        db.commit()

    with Session() as db, pytest.raises(HTTPException) as caught:
        main.update_profile(main.ProfileIn(
            first_name="M", last_name="E", username="me",
            email="other@example.com"), user_id=me, db=db)

    assert caught.value.status_code == 409
    assert caught.value.detail == "That email is already taken"


# --------------------------------------------------------------------------
# POST /mealplan
# --------------------------------------------------------------------------
def test_add_plan_slot_race_is_409(engine, Session):
    user_id, recipe_id = _seed_user_with_recipe(Session)

    outcome = _race(
        engine, Session,
        hold=lambda a: a.add(models.PlanSlot(
            user_id=user_id, recipe_id=recipe_id, week=WEEK,
            day_of_week="Mon", meal_position="breakfast")),
        act=lambda b: main.add_plan_slot(main.PlanSlotIn(
            recipe_id=recipe_id, week=WEEK, day_of_week="Mon",
            meal_position="breakfast"), user_id=user_id, db=b))

    _assert_409(outcome, "Mon breakfast is already filled")


def test_add_plan_slot_ordinary_duplicate_is_still_409(Session):
    user_id, recipe_id = _seed_user_with_recipe(Session)
    body = main.PlanSlotIn(recipe_id=recipe_id, week=WEEK, day_of_week="Mon",
                           meal_position="breakfast")

    with Session() as db:
        main.add_plan_slot(body, user_id=user_id, db=db)

    with Session() as db, pytest.raises(HTTPException) as caught:
        main.add_plan_slot(body, user_id=user_id, db=db)

    assert caught.value.status_code == 409
    assert caught.value.detail == "Mon breakfast is already filled"


# --------------------------------------------------------------------------
# POST /mealplan/generate — pressing Generate week twice
# --------------------------------------------------------------------------
def test_generate_week_race_is_409(engine, Session):
    user_id, recipe_id = _seed_user_with_recipe(Session)

    outcome = _race(
        engine, Session,
        hold=lambda a: a.add(models.PlanSlot(
            user_id=user_id, recipe_id=recipe_id, week=WEEK,
            day_of_week="Wed", meal_position="lunch")),
        act=lambda b: main.generate_week(
            main.GenerateIn(week=WEEK), user_id=user_id, db=b))

    _assert_409(outcome,
                "That week changed while it was being generated — try again")


def test_generate_week_twice_in_turn_refills_the_week(Session):
    user_id, _ = _seed_user_with_recipe(Session)

    with Session() as db:
        main.generate_week(main.GenerateIn(week=WEEK), user_id=user_id, db=db)
    with Session() as db:
        again = main.generate_week(main.GenerateIn(week=WEEK), user_id=user_id,
                                   db=db)
        stored = db.query(models.PlanSlot).filter_by(user_id=user_id,
                                                     week=WEEK).count()

    assert again.created == 21
    assert stored == 21
