"""
B25 (nomadwiz/kete#327): GET /recipes?q= searches the name and the cuisine.

The search box promises "Name or cuisine", and the query searched the name
only. The recipes below follow the shape of the three in the issue: each term
appears in exactly one place, so each test can tell a name match from a
cuisine match.
"""

import pytest

import main
import models


def _user(db, name):
    user = models.User(first_name="Test", last_name="User", username=name,
                       email=f"{name}@example.com", password_hash="not-a-real-hash")
    db.add(user)
    db.flush()
    return user.user_id


@pytest.fixture
def library(Session):
    """Three recipes for one user, and a stranger with an Italian recipe."""
    with Session() as db:
        uid = _user(db, "cook")
        for name, cuisine in [("Italian Meatballs", "Swedish"),
                              ("Risotto", "Italian"),
                              ("Shepherds Pie", "British")]:
            db.add(models.Recipe(user_id=uid, name=name, cuisine=cuisine))
        stranger = _user(db, "stranger")
        db.add(models.Recipe(user_id=stranger, name="Lasagne", cuisine="Italian"))
        db.commit()
    return uid


def _search(Session, user_id, q):
    with Session() as db:
        return [r.name for r in main.list_recipes(q=q, user_id=user_id, db=db)]


def test_a_term_only_in_the_cuisine_is_found(Session, library):
    """The issue's Done-when: before the fix, both of these answered []."""
    assert _search(Session, library, "Swedish") == ["Italian Meatballs"]
    assert _search(Session, library, "British") == ["Shepherds Pie"]


def test_a_term_in_one_name_and_one_cuisine_finds_both(Session, library):
    """q=italian answered only the first before the fix. Ordered by name."""
    assert _search(Session, library, "italian") == ["Italian Meatballs", "Risotto"]


def test_a_name_match_still_works(Session, library):
    assert _search(Session, library, "pie") == ["Shepherds Pie"]


def test_the_search_stays_inside_the_users_own_recipes(Session, library):
    """The stranger's Italian recipe matches by cuisine, and is not returned."""
    assert "Lasagne" not in _search(Session, library, "italian")


def test_no_term_lists_everything_the_user_owns(Session, library):
    assert _search(Session, library, "") == [
        "Italian Meatballs", "Risotto", "Shepherds Pie"]
