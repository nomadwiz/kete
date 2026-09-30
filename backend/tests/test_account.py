"""
B16 (nomadwiz/kete#158) and S14 (#281): the account's own sensitive changes.

Changing the password, deleting the account, and changing the username or email
that the account signs in with each need the current password, because a token
alone lives twelve hours, cannot be revoked, and is readable by any script on
the page. Changing only the name does not.

Deleting the account is also the only code path that exercises the cascading
deletion section 7.2 describes, so the tests here check every table by name.
"""

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import main
import models
import storage
from security import hash_password

PASSWORD = "correct-horse"
PASSWORD_HASH = hash_password(PASSWORD)      # once: PBKDF2 is slow on purpose
WEEK = "2026-W40"


class FakeS3:
    def __init__(self):
        self.deleted = []

    def delete(self, key):
        self.deleted.append(key)


@pytest.fixture
def s3(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(storage, "delete", fake.delete)
    return fake


def _user(db, name):
    user = models.User(first_name="Test", last_name="User", username=name,
                       email=f"{name}@example.com", password_hash=PASSWORD_HASH)
    db.add(user)
    db.flush()
    return user.user_id


def _everything(db, user_id, photo=None):
    """One row in each of the four tables that hang off a user."""
    body = main.MetricsIn(weight_kg=70, height_cm=175, age=30, sex="male",
                          activity_level="moderate")
    db.add(models.Profile(user_id=user_id, **body.model_dump()))
    db.add(models.NutritionTarget(
        user_id=user_id, **main.compute_targets(**body.model_dump())))
    recipe = models.Recipe(user_id=user_id, name="Laksa", photo_url=photo)
    db.add(recipe)
    db.flush()
    db.add(models.PlanSlot(user_id=user_id, recipe_id=recipe.recipe_id,
                           week=WEEK, day_of_week="Mon", meal_position="lunch"))


def _rows(db, user_id):
    """How many rows of this user's each table holds."""
    return {table.__tablename__: db.query(table).filter_by(user_id=user_id).count()
            for table in (models.User, models.Profile, models.NutritionTarget,
                          models.Recipe, models.PlanSlot)}


def _login(db, name, password):
    return main.login(main.LoginIn(username_or_email=name, password=password),
                      db=db)


@pytest.fixture
def me(Session):
    with Session() as db:
        uid = _user(db, "me")
        db.commit()
    return uid


# --------------------------------------------------------------------------
# PUT /profile/password
# --------------------------------------------------------------------------
def test_changing_the_password_moves_login_to_the_new_one(Session, me):
    with Session() as db:
        main.change_password(main.PasswordIn(current_password=PASSWORD,
                                             new_password="battery-staple"),
                             user_id=me, db=db)

    with Session() as db:
        assert _login(db, "me", "battery-staple").user_id == me
        with pytest.raises(HTTPException) as old:
            _login(db, "me", PASSWORD)
    assert old.value.status_code == 401


def test_a_wrong_current_password_is_a_403_and_changes_nothing(Session, me):
    with Session() as db, pytest.raises(HTTPException) as err:
        main.change_password(main.PasswordIn(current_password="guess",
                                             new_password="battery-staple"),
                             user_id=me, db=db)

    assert err.value.status_code == 403
    assert err.value.detail == "Current password is incorrect"
    with Session() as db:
        assert db.get(models.User, me).password_hash == PASSWORD_HASH


def test_the_new_password_obeys_the_rule_register_does():
    with pytest.raises(ValidationError):
        main.PasswordIn(current_password=PASSWORD, new_password="short")


# --------------------------------------------------------------------------
# DELETE /profile
# --------------------------------------------------------------------------
def test_deleting_the_account_removes_every_row_in_every_table(Session, s3, me):
    """Section 7.2's cascade, observed: one DELETE, five tables emptied."""
    with Session() as db:
        _everything(db, me)
        db.commit()
        assert set(_rows(db, me).values()) == {1}      # the seed is real

    with Session() as db:
        main.delete_account(main.DeleteAccountIn(password=PASSWORD),
                            user_id=me, db=db)

    with Session() as db:
        assert _rows(db, me) == {"users": 0, "profiles": 0,
                                 "nutrition_targets": 0, "recipes": 0,
                                 "plan_slots": 0}


def test_deleting_one_account_leaves_another_untouched(Session, s3, me):
    with Session() as db:
        other = _user(db, "other")
        _everything(db, me)
        _everything(db, other)
        db.commit()

    with Session() as db:
        main.delete_account(main.DeleteAccountIn(password=PASSWORD),
                            user_id=me, db=db)

    with Session() as db:
        assert set(_rows(db, other).values()) == {1}


def test_deleting_the_account_removes_its_photographs_from_s3(Session, s3, me):
    """No foreign key reaches S3, so the cascade alone would leave these
    behind: the one part of "delete my data" the database cannot do."""
    key = f"recipes/{me}/1/abc.jpg"
    with Session() as db:
        _everything(db, me, photo=key)
        db.add(models.Recipe(user_id=me, name="No photo"))
        db.commit()

    with Session() as db:
        main.delete_account(main.DeleteAccountIn(password=PASSWORD),
                            user_id=me, db=db)

    assert s3.deleted == [key]


def test_a_wrong_password_deletes_nothing(Session, s3, me):
    with Session() as db:
        _everything(db, me, photo=f"recipes/{me}/1/abc.jpg")
        db.commit()

    with Session() as db, pytest.raises(HTTPException) as err:
        main.delete_account(main.DeleteAccountIn(password="guess"),
                            user_id=me, db=db)

    assert err.value.status_code == 403
    assert s3.deleted == []
    with Session() as db:
        assert set(_rows(db, me).values()) == {1}


def test_a_deleted_accounts_token_cannot_create_a_recipe(Session, s3, me):
    """The token outlives the account for up to twelve hours. Before B16 this
    insert failed on the users foreign key, a 500."""
    with Session() as db:
        main.delete_account(main.DeleteAccountIn(password=PASSWORD),
                            user_id=me, db=db)

    body = main.RecipeIn(name="Late", cuisine="", ingredients="", steps="",
                         servings=1, energy_kcal=0, protein_g=0, carbs_g=0,
                         fat_g=0)
    with Session() as db, pytest.raises(HTTPException) as err:
        main.create_recipe(body, user_id=me, db=db)

    assert err.value.status_code == 404


# --------------------------------------------------------------------------
# PUT /profile — S14
# --------------------------------------------------------------------------
def _edit(Session, user_id, **changes):
    fields = dict(first_name="Test", last_name="User", username="me",
                  email="me@example.com")
    fields.update(changes)
    with Session() as db:
        return main.update_profile(main.ProfileIn(**fields), user_id=user_id,
                                   db=db)


@pytest.mark.parametrize("change", [
    dict(email="thief@example.com"), dict(username="thief")],
    ids=["email", "username"])
@pytest.mark.parametrize("password", [None, "guess"], ids=["none", "wrong"])
def test_changing_what_you_sign_in_with_needs_the_password(Session, me, change,
                                                           password):
    with pytest.raises(HTTPException) as err:
        _edit(Session, me, current_password=password, **change)

    assert err.value.status_code == 403
    with Session() as db:
        user = db.get(models.User, me)
        assert (user.username, user.email) == ("me", "me@example.com")


def test_with_the_password_the_email_changes(Session, me):
    out = _edit(Session, me, email="new@example.com", current_password=PASSWORD)

    assert out.email == "new@example.com"


def test_changing_only_the_name_needs_no_password(Session, me):
    out = _edit(Session, me, first_name="Renamed")

    assert out.first_name == "Renamed"


def test_a_wrong_password_does_not_reveal_that_a_name_is_taken(Session, me):
    """The password is checked before the clash, so a 409 cannot be used to
    probe which usernames exist without knowing the password."""
    with Session() as db:
        _user(db, "taken")
        db.commit()

    with pytest.raises(HTTPException) as err:
        _edit(Session, me, username="taken", current_password="guess")

    assert err.value.status_code == 403
