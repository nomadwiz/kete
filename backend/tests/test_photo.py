"""
B6 (nomadwiz/kete#156): POST /recipes/{recipe_id}/photo.

S3 is replaced by a fake that records what it was asked to do, so these tests
need no AWS account and no network. What they check is the endpoint's own
decisions: whose recipe it is, what it accepts, what key it writes, and what it
cleans up. That the real bucket accepts the object is check_s3.py's job, run on
the instance, not this file's.
"""

import io

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

import main
import models
import storage

JPEG = b"\xff\xd8\xff\xe0" + b"x" * 100     # enough bytes to be non-empty


class FakeS3:
    """Stands in for storage.upload, link_for and delete."""

    def __init__(self):
        self.objects = {}        # key -> bytes
        self.deleted = []
        self.fail_upload = False
        self.fail_link = False   # S3 stores, then will not sign a link

    def upload(self, key, data, content_type):
        if self.fail_upload:
            raise RuntimeError("S3 refused the object")
        self.objects[key] = data
        return key

    def link_for(self, key):
        # The real one answers None on a failed presign, never raises.
        if self.fail_link or not key:
            return None
        return f"https://signed.test/{key}?signature=abc"

    def delete(self, key):
        self.deleted.append(key)
        self.objects.pop(key, None)


@pytest.fixture
def s3(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(storage, "BUCKET", "test-photos")
    monkeypatch.setattr(storage, "upload", fake.upload)
    monkeypatch.setattr(storage, "link_for", fake.link_for)
    monkeypatch.setattr(storage, "delete", fake.delete)
    return fake


def _user(db, name):
    user = models.User(first_name="Test", last_name="User", username=name,
                       email=f"{name}@example.com", password_hash="not-a-real-hash")
    db.add(user)
    db.flush()
    return user.user_id


def _recipe(db, user_id, name="Laksa"):
    recipe = models.Recipe(user_id=user_id, name=name)
    db.add(recipe)
    db.flush()
    return recipe.recipe_id


def _file(data=JPEG, content_type="image/jpeg", filename="photo.jpg"):
    return UploadFile(file=io.BytesIO(data), filename=filename,
                      headers=Headers({"content-type": content_type}))


def _upload(db, recipe_id, user_id, file=None):
    return main.upload_photo(recipe_id=recipe_id, file=file or _file(),
                             user_id=user_id, db=db)


@pytest.fixture
def owner(Session):
    """A user who owns one recipe, and a second user who owns nothing."""
    with Session() as db:
        uid = _user(db, "owner")
        rid = _recipe(db, uid)
        other = _user(db, "stranger")
        db.commit()
    return uid, rid, other


# --------------------------------------------------------------------------
# The upload that should work
# --------------------------------------------------------------------------
def test_upload_stores_the_key_and_answers_a_signed_link(Session, s3, owner):
    uid, rid, _ = owner

    with Session() as db:
        out = _upload(db, rid, uid)

    [key] = s3.objects
    assert s3.objects[key] == JPEG
    assert out.photo_url == f"https://signed.test/{key}?signature=abc"
    with Session() as db:
        assert db.get(models.Recipe, rid).photo_url == key   # the key, not a URL


def test_key_is_scoped_to_user_and_recipe_and_unguessable(Session, s3, owner):
    """recipes/<user>/<recipe>/<random>.<ext>: a policy can be scoped to the
    prefix, and a flat recipe-id key would be enumerable."""
    uid, rid, _ = owner

    with Session() as db:
        _upload(db, rid, uid)
        _upload(db, rid, uid)

    first, second = s3.deleted + list(s3.objects)
    for key in (first, second):
        assert key.startswith(f"recipes/{uid}/{rid}/")
        assert key.endswith(".jpg")
    assert first != second      # a re-upload never reuses the name


@pytest.mark.parametrize("content_type, ext", [
    ("image/jpeg", ".jpg"), ("image/png", ".png"), ("image/webp", ".webp")])
def test_each_allowed_type_keeps_its_extension(Session, s3, owner,
                                               content_type, ext):
    uid, rid, _ = owner

    with Session() as db:
        _upload(db, rid, uid, _file(content_type=content_type))

    [key] = s3.objects
    assert key.endswith(ext)


def test_a_file_exactly_at_the_limit_is_accepted(Session, s3, owner):
    uid, rid, _ = owner

    with Session() as db:
        _upload(db, rid, uid, _file(b"x" * storage.MAX_BYTES))

    [data] = s3.objects.values()
    assert len(data) == storage.MAX_BYTES


# --------------------------------------------------------------------------
# Whose recipe it is
# --------------------------------------------------------------------------
def test_another_users_recipe_is_a_404_and_nothing_is_stored(Session, s3, owner):
    """The issue's first concern: made real without this check, any signed-in
    user could overwrite any other user's photograph by guessing an integer.
    404, not 403, so the answer does not confirm the recipe exists."""
    uid, rid, stranger = owner
    with Session() as db:
        _upload(db, rid, uid)
    [owners_key] = s3.objects

    with Session() as db, pytest.raises(HTTPException) as err:
        _upload(db, rid, stranger)

    assert err.value.status_code == 404
    assert err.value.detail == "Recipe not found"
    assert list(s3.objects) == [owners_key]      # nothing new written
    assert s3.deleted == []                      # and the owner's kept
    with Session() as db:
        assert db.get(models.Recipe, rid).photo_url == owners_key


def test_a_recipe_that_does_not_exist_is_a_404(Session, s3, owner):
    uid, _, _ = owner

    with Session() as db, pytest.raises(HTTPException) as err:
        _upload(db, 999999, uid)

    assert err.value.status_code == 404
    assert s3.objects == {}


# --------------------------------------------------------------------------
# What it refuses
# --------------------------------------------------------------------------
@pytest.mark.parametrize("data, content_type, status", [
    (b"%PDF-1.7", "application/pdf", 415),
    (b"<svg/>", "image/svg+xml", 415),         # an image, but it can carry script
    (b"x" * (storage.MAX_BYTES + 1), "image/jpeg", 413),
    (b"", "image/jpeg", 400),
], ids=["pdf", "svg", "over-limit", "empty"])
def test_refused_files_store_nothing(Session, s3, owner, data, content_type,
                                     status):
    uid, rid, _ = owner

    with Session() as db, pytest.raises(HTTPException) as err:
        _upload(db, rid, uid, _file(data, content_type))

    assert err.value.status_code == status
    assert s3.objects == {}
    with Session() as db:
        assert db.get(models.Recipe, rid).photo_url is None


def test_no_bucket_configured_is_a_503(Session, s3, owner, monkeypatch):
    uid, rid, _ = owner
    monkeypatch.setattr(storage, "BUCKET", "")

    with Session() as db, pytest.raises(HTTPException) as err:
        _upload(db, rid, uid)

    assert err.value.status_code == 503
    assert s3.objects == {}


# --------------------------------------------------------------------------
# Replacing a photograph
# --------------------------------------------------------------------------
def test_replacing_a_photo_deletes_the_old_object(Session, s3, owner):
    uid, rid, _ = owner
    with Session() as db:
        _upload(db, rid, uid)
    [old] = s3.objects

    with Session() as db:
        _upload(db, rid, uid)

    [new] = s3.objects
    assert s3.deleted == [old]
    with Session() as db:
        assert db.get(models.Recipe, rid).photo_url == new


def test_a_failed_replacement_keeps_the_old_photo(Session, s3, owner):
    """The old object is removed only once the new one is recorded, so S3
    refusing the new one costs the user nothing."""
    uid, rid, _ = owner
    with Session() as db:
        _upload(db, rid, uid)
    [old] = s3.objects
    s3.fail_upload = True

    with Session() as db, pytest.raises(HTTPException) as err:
        _upload(db, rid, uid)

    assert err.value.status_code == 502
    assert s3.deleted == []
    assert list(s3.objects) == [old]
    with Session() as db:
        assert db.get(models.Recipe, rid).photo_url == old


# --------------------------------------------------------------------------
# A link that cannot be signed (B22, #267)
# --------------------------------------------------------------------------
# storage.link_for answers None when S3 stores an object but will not sign a
# link to it. That is a null photo_url, never a 500: the photograph is there,
# and the next read signs a fresh link.
def test_an_upload_whose_link_cannot_be_signed_still_succeeds(Session, s3,
                                                              owner):
    """The object is stored and its key saved before the link is made, so a
    500 here told the user an upload had failed when it had not."""
    uid, rid, _ = owner
    s3.fail_link = True

    with Session() as db:
        out = _upload(db, rid, uid)

    assert out.photo_url is None
    [key] = s3.objects                           # the photograph is stored
    with Session() as db:
        assert db.get(models.Recipe, rid).photo_url == key   # and recorded


def test_a_link_that_cannot_be_signed_leaves_the_recipe_list_working(
        Session, s3, owner):
    uid, rid, _ = owner
    with Session() as db:
        _upload(db, rid, uid)
        db.add(models.Recipe(user_id=uid, name="Another"))
        db.commit()
    s3.fail_link = True

    with Session() as db:
        recipes = main.list_recipes(user_id=uid, db=db)

    assert len(recipes) == 2
    assert [r.photo_url for r in recipes] == [None, None]


def test_a_link_that_cannot_be_signed_leaves_the_recipe_readable(Session, s3,
                                                                 owner):
    uid, rid, _ = owner
    with Session() as db:
        _upload(db, rid, uid)
    s3.fail_link = True

    with Session() as db:
        recipe = main.get_recipe(rid, user_id=uid, db=db)

    assert recipe.recipe_id == rid
    assert recipe.photo_url is None
