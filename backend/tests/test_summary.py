"""
B23 (nomadwiz/kete#229): GET /mealplan/summary, each day against the targets.

The week below is small enough to check by hand, and the expected figures are
worked in the comments beside them rather than computed by the test, so a
reader can verify the arithmetic without trusting the code under test.
"""

import pytest
from fastapi import HTTPException

import main
import models

WEEK = "2026-W40"

# Stored targets: energy 2000 kcal, protein 150 g, carbs 200 g, fat 67 g.
TARGETS = dict(energy_kcal=2000, protein_g=150, carbs_g=200, fat_g=67)

# Per-serving figures of the two recipes.
PORRIDGE = dict(energy_kcal=500, protein_g=30, carbs_g=60, fat_g=15)
CURRY = dict(energy_kcal=700, protein_g=40, carbs_g=80, fat_g=25)


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
    db.add(models.PlanSlot(user_id=user_id, recipe_id=recipe_id, week=week,
                           day_of_week=day, meal_position=meal))


def _summary(db, user_id, week=WEEK):
    return main.get_mealplan_summary(week=week, user_id=user_id, db=db)


def _day(summary, day):
    return next(d for d in summary.days if d.day_of_week == day)


@pytest.fixture
def cook(Session):
    """A user with targets, two recipes and three planned slots.

    Mon: porridge (breakfast) + curry (lunch)
    Tue: curry (dinner)
    Wed to Sun: nothing
    """
    with Session() as db:
        uid = _user(db, "cook")
        db.add(models.NutritionTarget(user_id=uid, **TARGETS))
        porridge = _recipe(db, uid, "Porridge", PORRIDGE)
        curry = _recipe(db, uid, "Curry", CURRY)
        _slot(db, uid, porridge, "Mon", "breakfast")
        _slot(db, uid, curry, "Mon", "lunch")
        _slot(db, uid, curry, "Tue", "dinner")
        db.commit()
    return uid


def test_a_known_week_reproduced_by_hand(Session, cook):
    with Session() as db:
        s = _summary(db, cook)

    assert s.week == WEEK
    assert [d.day_of_week for d in s.days] == main.DAYS   # seven, Mon to Sun

    mon = _day(s, "Mon")
    # energy: 500 + 700 = 1200; 1200 - 2000 = -800; 1200 / 2000 = 60 %
    assert mon.energy_kcal.model_dump() == dict(total=1200, target=2000,
                                                difference=-800, percent=60)
    # protein: 30 + 40 = 70; 70 - 150 = -80; 70 / 150 = 46.67 % -> 47
    assert mon.protein_g.model_dump() == dict(total=70, target=150,
                                              difference=-80, percent=47)
    # carbs: 60 + 80 = 140; 140 - 200 = -60; 140 / 200 = 70 %
    assert mon.carbs_g.model_dump() == dict(total=140, target=200,
                                            difference=-60, percent=70)
    # fat: 15 + 25 = 40; 40 - 67 = -27; 40 / 67 = 59.70 % -> 60
    assert mon.fat_g.model_dump() == dict(total=40, target=67,
                                          difference=-27, percent=60)

    tue = _day(s, "Tue")
    # energy: 700 alone; 700 - 2000 = -1300; 700 / 2000 = 35 %
    assert tue.energy_kcal.model_dump() == dict(total=700, target=2000,
                                                difference=-1300, percent=35)
    # fat: 25 alone; 25 / 67 = 37.31 % -> 37
    assert tue.fat_g.percent == 37


def test_an_empty_day_is_returned_with_zero_totals(Session, cook):
    with Session() as db:
        wed = _day(_summary(db, cook), "Wed")
    # Nothing planned: 0 against 2000 is the whole target short, and 0 %.
    assert wed.energy_kcal.model_dump() == dict(total=0, target=2000,
                                                difference=-2000, percent=0)
    assert wed.fat_g.model_dump() == dict(total=0, target=67,
                                          difference=-67, percent=0)


def test_an_empty_week_still_has_seven_days(Session, cook):
    with Session() as db:
        s = _summary(db, cook, week="2026-W41")
    assert [d.day_of_week for d in s.days] == main.DAYS
    assert all(d.energy_kcal.total == 0 for d in s.days)


def test_no_targets_is_a_404_like_get_targets(Session):
    with Session() as db:
        uid = _user(db, "newcomer")
        db.commit()
    with Session() as db, pytest.raises(HTTPException) as err:
        _summary(db, uid)
    assert err.value.status_code == 404
    with Session() as db, pytest.raises(HTTPException) as same:
        main.get_targets(user_id=uid, db=db)
    assert same.value.detail == err.value.detail


def test_another_users_slots_are_not_counted(Session, cook):
    with Session() as db:
        other = _user(db, "neighbour")
        feast = _recipe(db, other, "Feast", dict(energy_kcal=5000, protein_g=1,
                                                 carbs_g=1, fat_g=1))
        _slot(db, other, feast, "Mon", "dinner")   # the cook's Mon dinner is free
        db.commit()
    with Session() as db:
        assert _day(_summary(db, cook), "Mon").energy_kcal.total == 1200


def test_other_weeks_are_not_counted(Session, cook):
    with Session() as db:
        curry = db.query(models.Recipe).filter_by(user_id=cook, name="Curry").one()
        _slot(db, cook, curry.recipe_id, "Mon", "dinner", week="2026-W41")
        db.commit()
    with Session() as db:
        assert _day(_summary(db, cook), "Mon").energy_kcal.total == 1200


def test_going_over_target_is_a_positive_difference(Session, cook):
    with Session() as db:
        big = _recipe(db, cook, "Big", dict(energy_kcal=1100, protein_g=0,
                                            carbs_g=0, fat_g=0))
        _slot(db, cook, big, "Mon", "dinner")
        db.commit()
    with Session() as db:
        energy = _day(_summary(db, cook), "Mon").energy_kcal
    # 500 + 700 + 1100 = 2300; 2300 - 2000 = +300; 2300 / 2000 = 115 %
    assert energy.model_dump() == dict(total=2300, target=2000,
                                       difference=300, percent=115)


@pytest.mark.parametrize("total, target, expected", [
    (1850, 2100, 88),   # ADR 001's own example: 88.10 %
    (1, 200, 1),        # exactly 0.5 %: half up, where round() would give 0
    (5, 1000, 1),       # exactly 0.5 % again
    (4, 1000, 0),       # 0.4 % rounds down
    (0, 150, 0),
    (150, 150, 100),
])
def test_percent_rounds_half_up(total, target, expected):
    assert main._percent(total, target) == expected
