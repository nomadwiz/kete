"""
Races that a check cannot win: B15 (nomadwiz/kete#157) and B20 (#264).

B15 is the clash: a 409 even when two requests race. B20 is the recipe that
disappears between the check and the insert: a deliberate code rather than a
500. Both have
the same shape, which is why they share a file -- an endpoint checks, then
writes, and the database is what refuses the write.

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

Before either fix, B raised the bare IntegrityError that reaches the client as
a 500. For B15 the endpoint must answer 409, in the same words as its own
check. For B20, POST /mealplan must answer the 404 its check would have given.
POST /mealplan/generate answers 409 instead, because it re-reads the library
on every request and a retry succeeds, and it says what happened rather than
naming a recipe the caller never chose.
"""

import threading
import time

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

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


def _assert_404(outcome, detail):
    error = outcome.get("error")
    assert isinstance(error, HTTPException), f"expected a 404, got {error!r}"
    assert error.status_code == 404
    assert error.detail == detail


def _delete_recipe(db, recipe_id):
    """Session A's half of B20's race: the recipe goes while B is inserting."""
    db.delete(db.get(models.Recipe, recipe_id))


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


# Not a copy of the register email race: update_profile's own check works out
# the field differently (it compares only the username), so the constraint's
# name is the only thing that can get this message right.
def test_update_profile_race_on_email_is_409(engine, Session):
    with Session() as db:
        me = _user(db, "me", "me@example.com").user_id
        db.commit()

    outcome = _race(
        engine, Session,
        hold=lambda a: _user(a, "someone", "wanted@example.com"),
        act=lambda b: main.update_profile(main.ProfileIn(
            first_name="M", last_name="E", username="me",
            email="wanted@example.com"), user_id=me, db=b))

    _assert_409(outcome, "That email is already taken")


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


# B20 (nomadwiz/kete#264). The endpoint's own check sees the recipe, because
# A's delete is not committed. Its insert then waits on A's lock on the recipe
# row, and fails on plan_slots_recipe_id_fkey once A commits. Before the fix
# that failure was a bare IntegrityError: a 500.
def test_add_plan_slot_recipe_deleted_mid_request_is_404(engine, Session):
    user_id, recipe_id = _seed_user_with_recipe(Session)

    outcome = _race(
        engine, Session,
        hold=lambda a: _delete_recipe(a, recipe_id),
        act=lambda b: main.add_plan_slot(main.PlanSlotIn(
            recipe_id=recipe_id, week=WEEK, day_of_week="Mon",
            meal_position="breakfast"), user_id=user_id, db=b))

    _assert_404(outcome, "Recipe not found")


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


def test_generate_week_recipe_deleted_mid_request_is_409(engine, Session):
    user_id, recipe_id = _seed_user_with_recipe(Session)

    outcome = _race(
        engine, Session,
        hold=lambda a: _delete_recipe(a, recipe_id),
        act=lambda b: main.generate_week(
            main.GenerateIn(week=WEEK), user_id=user_id, db=b))

    _assert_409(outcome,
                "A recipe was deleted while the week was being generated — "
                "try again")


def test_generate_week_recipe_deleted_mid_request_keeps_the_planned_week(
        engine, Session):
    """The 409 undoes the clear as well as the inserts, so the week survives.

    generate_week empties the week before it refills it, and both happen in one
    transaction. If the clear were ever to commit separately from the inserts,
    this race would cost the user the week they were looking at -- the worst
    outcome in nomadwiz/kete#264, and the only clause in it that no other test
    observes.

    The slots already in the week point at a recipe that is not the one being
    deleted, and that is the whole difficulty of writing this. recipe_id is ON
    DELETE CASCADE, so slots pointing at the doomed recipe would be swept away
    by the cascade when session A commits, and the test would then be watching
    the cascade rather than the rollback and would pass for the wrong reason.
    """
    user_id, doomed = _seed_user_with_recipe(Session)
    with Session() as db:
        keeper = models.Recipe(user_id=user_id, name="Curry")
        db.add(keeper)
        db.commit()
        keeper_id = keeper.recipe_id
        for meal in main.MEALS:
            db.add(models.PlanSlot(user_id=user_id, recipe_id=keeper_id,
                                   week=WEEK, day_of_week="Mon",
                                   meal_position=meal))
        db.commit()

    # recipes are dealt in recipe_id order, so the first slot generate builds
    # points at the doomed recipe and it is the first insert to fail.
    outcome = _race(
        engine, Session,
        hold=lambda a: _delete_recipe(a, doomed),
        act=lambda b: main.generate_week(
            main.GenerateIn(week=WEEK), user_id=user_id, db=b))

    _assert_409(outcome,
                "A recipe was deleted while the week was being generated — "
                "try again")

    with Session() as db:
        survived = db.query(models.PlanSlot).filter_by(
            user_id=user_id, week=WEEK).all()
    assert sorted(s.meal_position for s in survived) == sorted(main.MEALS)
    assert {s.recipe_id for s in survived} == {keeper_id}

# --------------------------------------------------------------------------
# _commit_or_409 and _commit_slots — the promises no endpoint test observes
# --------------------------------------------------------------------------
def test_a_clash_leaves_the_session_usable(Session):
    """After a 409 the session has been rolled back, not left aborted.

    PostgreSQL refuses every later statement in a transaction that has failed,
    so without the rollback the next query on this session would raise too.
    """
    user_id, recipe_id = _seed_user_with_recipe(Session)
    slot = dict(user_id=user_id, recipe_id=recipe_id, week=WEEK,
                day_of_week="Mon", meal_position="breakfast")
    with Session() as db:
        db.add(models.PlanSlot(**slot))
        db.commit()

    with Session() as db:
        db.add(models.PlanSlot(**slot))
        with pytest.raises(HTTPException) as caught:
            main._commit_or_409(db, "taken")

        assert caught.value.status_code == 409
        assert db.execute(text("SELECT 1")).scalar() == 1


def test_a_failure_that_is_not_a_clash_is_not_a_409(Session):
    """A check-constraint failure is a bug and must still surface as one.

    Answering it 409 would tell the user they had done something wrong, and a
    409 looks enough like user error that nobody would go looking for the bug.
    """
    user_id, recipe_id = _seed_user_with_recipe(Session)

    with Session() as db:
        db.add(models.PlanSlot(user_id=user_id, recipe_id=recipe_id, week=WEEK,
                               day_of_week="Mon", meal_position="brunch"))
        with pytest.raises(IntegrityError) as caught:
            main._commit_or_409(db, "taken")

        assert "ck_slot_meal" in str(caught.value)
        assert db.execute(text("SELECT 1")).scalar() == 1


def test_a_foreign_key_failure_on_another_column_is_not_a_404(Session):
    """Only a missing recipe is a 404. A slot pointing at a missing user is a
    bug — the user id comes from the token, never from the client — and must
    still surface as one."""
    _, recipe_id = _seed_user_with_recipe(Session)

    with Session() as db:
        db.add(models.PlanSlot(user_id=999999, recipe_id=recipe_id, week=WEEK,
                               day_of_week="Mon", meal_position="breakfast"))
        with pytest.raises(IntegrityError) as caught:
            main._commit_slots(db, "taken")

        assert "plan_slots_user_id_fkey" in str(caught.value)
        assert db.execute(text("SELECT 1")).scalar() == 1
