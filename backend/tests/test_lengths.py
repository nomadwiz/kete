"""
B31 (nomadwiz/kete#400): over-long text is refused with 422, not 500.

The names had no length limit in the request models, but their columns do:
first_name and last_name are String(80) and username String(50). A longer value
passed validation and failed at the database, so the API answered 500 where a
422 belongs. Every password field and the recipe's ingredients and steps were
unbounded too. Each now carries a max_length; the names' caps are read from
the columns, so the two cannot drift apart.

Like test_bounds.py these need no database, so they run in CI. They read the
request models and the tables' declared lengths, not the tables.
"""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import main
import models

PASSWORD = "correct-horse"

# A valid body for each request model, so one field at a time can be stretched.
VALID = {
    main.RegisterIn: dict(first_name="Ana", last_name="Lay", username="ana",
                          email="ana@example.com", password=PASSWORD),
    main.LoginIn: dict(username_or_email="ana", password=PASSWORD),
    main.ProfileIn: dict(first_name="Ana", last_name="Lay", username="ana",
                         email="ana@example.com", current_password=PASSWORD),
    main.PasswordIn: dict(current_password=PASSWORD, new_password=PASSWORD),
    main.DeleteAccountIn: dict(password=PASSWORD),
    main.RecipeIn: dict(name="Laksa", cuisine="Malaysian", ingredients="",
                        steps="", servings=2, energy_kcal=500, protein_g=30,
                        carbs_g=60, fat_g=15),
}

CAPS = [
    (main.RegisterIn, "first_name", main.NAME_MAX),
    (main.RegisterIn, "last_name", main.NAME_MAX),
    (main.RegisterIn, "username", main.USERNAME_MAX),
    (main.RegisterIn, "password", main.PASSWORD_MAX),
    (main.LoginIn, "username_or_email", 254),
    (main.LoginIn, "password", main.PASSWORD_MAX),
    (main.ProfileIn, "first_name", main.NAME_MAX),
    (main.ProfileIn, "last_name", main.NAME_MAX),
    (main.ProfileIn, "username", main.USERNAME_MAX),
    (main.ProfileIn, "current_password", main.PASSWORD_MAX),
    (main.PasswordIn, "current_password", main.PASSWORD_MAX),
    (main.PasswordIn, "new_password", main.PASSWORD_MAX),
    (main.DeleteAccountIn, "password", main.PASSWORD_MAX),
    (main.RecipeIn, "ingredients", main.RECIPE_TEXT_MAX),
    (main.RecipeIn, "steps", main.RECIPE_TEXT_MAX),
]
IDS = [f"{model.__name__}.{field}" for model, field, _ in CAPS]


def _with(model, field, length):
    return model(**{**VALID[model], field: "a" * length})


@pytest.mark.parametrize("model, field, cap", CAPS, ids=IDS)
def test_a_value_at_the_cap_is_accepted(model, field, cap):
    assert len(getattr(_with(model, field, cap), field)) == cap


@pytest.mark.parametrize("model, field, cap", CAPS, ids=IDS)
def test_one_character_over_the_cap_is_refused(model, field, cap):
    with pytest.raises(ValidationError) as err:
        _with(model, field, cap + 1)
    assert err.value.errors()[0]["loc"] == (field,)


def test_the_name_caps_are_the_column_lengths():
    """If a column is widened or narrowed, this fails until the cap follows."""
    columns = models.User.__table__.c
    assert main.NAME_MAX == columns.first_name.type.length
    assert main.NAME_MAX == columns.last_name.type.length
    assert main.USERNAME_MAX == columns.username.type.length


@pytest.mark.parametrize("model", [main.RegisterIn, main.ProfileIn])
def test_an_email_over_254_characters_is_refused(model):
    """EmailStr carries its own limit, inside users.email's String(255), so
    email needs no max_length of its own."""
    assert models.User.__table__.c.email.type.length == 255
    domain = ".".join(["b" * 63] * 3)                      # 191 characters
    at_limit = f"{'a' * 58}@{domain}.com"                  # 254
    assert len(at_limit) == 254
    model(**{**VALID[model], "email": at_limit})
    with pytest.raises(ValidationError):
        model(**{**VALID[model], "email": "a" + at_limit})


def test_an_over_long_name_answers_422_through_the_api():
    """The point of the caps: the client gets a 422 naming the field, where
    the database's refusal used to surface as a 500. FastAPI resolves get_db
    before it validates the body, so the override hands over a session that
    fails on first use: the route itself must never run."""
    class Unused:
        def __getattr__(self, name):
            raise AssertionError("validation should refuse this before any query")

    def no_database():
        yield Unused()

    main.app.dependency_overrides[main.get_db] = no_database
    try:
        body = {**VALID[main.RegisterIn], "first_name": "a" * (main.NAME_MAX + 1)}
        response = TestClient(main.app).post("/register", json=body)
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "first_name"]
