"""
B29 (nomadwiz/kete#376): recalc_targets.py rewrites targets stored before the
20 / 50 / 30 split, and only those.

The man of 30, 70 kg and 175 cm at a moderate activity level is ADR 009's own
worked example, so the figures below can be checked against it:

    REE  = 10 x 70 + 6.25 x 175 - 5 x 30 + 5 = 1648.75
    TDEE = 1648.75 x 1.55                    = 2555.56  -> 2556 kcal
    old 30 / 40 / 30:  protein 2555.56 x 0.30 / 4 = 191.67 -> 192 g
                       carbs   2555.56 x 0.40 / 4 = 255.56 -> 256 g
    new 20 / 50 / 30:  protein 2555.56 x 0.20 / 4 = 127.78 -> 128 g
                       carbs   2555.56 x 0.50 / 4 = 319.45 -> 319 g
    fat, both:         2555.56 x 0.30 / 9         =  85.19 ->  85 g
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

import models
import recalc_targets
from security import hash_password

PASSWORD_HASH = hash_password("correct-horse")
METRICS = dict(weight_kg=70, height_cm=175, age=30, sex="male",
               activity_level="moderate")
OLD = dict(energy_kcal=2556, protein_g=192, carbs_g=256, fat_g=85)
NEW = dict(energy_kcal=2556, protein_g=128, carbs_g=319, fat_g=85)
LAST_WEEK = datetime.now(timezone.utc) - timedelta(days=7)


def _user(db, name, target=None):
    """A user with METRICS saved, and the given target stored, if any."""
    user = models.User(first_name="Test", last_name="User", username=name,
                       email=f"{name}@example.com", password_hash=PASSWORD_HASH)
    db.add(user)
    db.flush()
    db.add(models.Profile(user_id=user.user_id, **METRICS))
    if target is not None:
        db.add(models.NutritionTarget(user_id=user.user_id,
                                      computed_at=LAST_WEEK, **target))
    db.flush()
    return user.user_id


def _stored(db, user_id):
    target = db.query(models.NutritionTarget).filter_by(user_id=user_id).one()
    return {f: int(getattr(target, f)) for f in recalc_targets.FIELDS}, target.computed_at


@pytest.fixture
def run(Session, monkeypatch, capsys):
    """recalc_targets.main against the test database; returns its output."""
    monkeypatch.setattr(recalc_targets, "SessionLocal", Session)

    def call(*argv):
        assert recalc_targets.main(list(argv)) == 0
        return capsys.readouterr().out
    return call


def test_a_target_on_the_old_split_is_rewritten(Session, run):
    with Session() as db:
        uid = _user(db, "old", OLD)
        db.commit()

    out = run("--apply")

    assert f"user {uid}: 2556 kcal, 192 g protein, 256 g carbs, 85 g fat  ->  " \
           "2556 kcal, 128 g protein, 319 g carbs, 85 g fat" in out
    assert "1 of 1 targets rewritten." in out
    with Session() as db:
        figures, computed_at = _stored(db, uid)
    assert figures == NEW
    assert computed_at > LAST_WEEK


def test_a_second_run_finds_nothing_left_to_do(Session, run):
    with Session() as db:
        _user(db, "old", OLD)
        db.commit()

    run("--apply")

    assert "0 of 1 targets differ from their profile." in run()


def test_a_dry_run_writes_nothing(Session, run):
    with Session() as db:
        uid = _user(db, "old", OLD)
        db.commit()

    out = run()

    assert "1 of 1 targets differ from their profile. Nothing written" in out
    with Session() as db:
        assert _stored(db, uid) == (OLD, LAST_WEEK)


def test_a_target_already_current_is_left_alone(Session, run):
    """Not even computed_at moves: the run touches only the rows that differ."""
    with Session() as db:
        current = _user(db, "current", NEW)
        old = _user(db, "old", OLD)
        db.commit()

    out = run("--apply")

    assert f"user {current}:" not in out
    assert f"user {old}:" in out
    assert "1 of 2 targets rewritten." in out
    with Session() as db:
        assert _stored(db, current) == (NEW, LAST_WEEK)


def test_a_profile_with_no_target_gets_one(Session, run):
    with Session() as db:
        uid = _user(db, "bare")
        db.commit()

    out = run("--apply")

    assert f"user {uid}: no target  ->  2556 kcal, 128 g protein" in out
    with Session() as db:
        assert _stored(db, uid)[0] == NEW


def test_apply_holds_each_profile_until_it_commits(Session):
    """A save arriving mid-run waits, so it cannot be overwritten by the run.

    The run's session reads with the lock and does not commit. A second
    session then tries to change that profile, as save_metrics's upsert would,
    and gives up after lock_timeout instead of going through.
    """
    with Session() as db:
        uid = _user(db, "old", OLD)
        db.commit()

    with Session() as run_db, Session() as save_db:
        recalc_targets.find_stale(run_db, lock=True)
        save_db.execute(text("SET lock_timeout = '200ms'"))
        with pytest.raises(OperationalError, match="lock timeout"):
            save_db.execute(text("UPDATE profiles SET age = 31 WHERE user_id = :u"),
                            {"u": uid})
        save_db.rollback()
        run_db.rollback()


def test_a_dry_run_takes_no_lock(Session):
    with Session() as db:
        uid = _user(db, "old", OLD)
        db.commit()

    with Session() as run_db, Session() as save_db:
        recalc_targets.find_stale(run_db)
        save_db.execute(text("SET lock_timeout = '200ms'"))
        save_db.execute(text("UPDATE profiles SET age = 31 WHERE user_id = :u"),
                        {"u": uid})
        save_db.rollback()
        run_db.rollback()
