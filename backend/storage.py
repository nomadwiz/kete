"""
Recipe photographs in Amazon S3.

The bucket is private. Nothing in it is publicly readable, so the API hands the
browser a time-limited ("presigned") link instead of a permanent URL. The link
is signed by AWS and stops working after an hour.

What is stored in the database is the S3 *key* (the path inside the bucket), not
a URL. Keys do not expire; URLs generated from them do. Recipe.photo_url holds
the key, and the API turns it into a link on the way out.

Credentials are never written in this file. boto3 looks for them in this order:
  1. AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from .env  (your laptop)
  2. the IAM role attached to the instance                 (EC2, no keys at all)
So the same code runs in both places, and on the server there is no secret on
disk to leak.
"""

import os
import uuid
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

BUCKET = os.getenv("S3_BUCKET", "")
REGION = os.getenv("AWS_REGION", "ap-southeast-2")
LINK_SECONDS = int(os.getenv("S3_LINK_SECONDS", "3600"))

# What a recipe photograph is allowed to be.
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_BYTES = 5 * 1024 * 1024          # 5 MB; our own estimate was a few hundred KB


class StorageNotConfigured(RuntimeError):
    """Raised when S3_BUCKET is not set, so the caller can say so clearly."""


def is_configured() -> bool:
    return bool(BUCKET)


def _client():
    if not BUCKET:
        raise StorageNotConfigured(
            "S3_BUCKET is not set in .env — photo upload is unavailable."
        )
    import boto3  # imported here so the API still starts without boto3 installed
    from botocore.config import Config

    # Signature Version 4 and the regional endpoint, both stated explicitly.
    # Left to its default, boto3 can fall back to the older Signature Version 2
    # and the global s3.amazonaws.com host. That still works in Sydney, because
    # the region predates the change, but SigV2 presigned URLs are rejected
    # outright in regions created after 2014, and the global host costs a
    # redirect on every image the browser loads.
    return boto3.client(
        "s3",
        region_name=REGION,
        endpoint_url=f"https://s3.{REGION}.amazonaws.com",
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


def build_key(user_id: int, recipe_id: int, content_type: str) -> str:
    """recipes/<user>/<recipe>/<random>.jpg

    The random part means re-uploading never overwrites silently, and the user
    and recipe prefix keeps the bucket browsable and easy to scope a policy to.
    """
    suffix = ALLOWED_TYPES.get(content_type, ".bin")
    return f"recipes/{user_id}/{recipe_id}/{uuid.uuid4().hex}{suffix}"


def upload(key: str, data: bytes, content_type: str) -> str:
    """Put the bytes in the bucket and return the key."""
    _client().put_object(
        Bucket=BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
        # Objects are private; the bucket also blocks public access. Both,
        # deliberately, so one misconfiguration alone does not expose them.
        ACL="private",
    )
    return key


def link_for(key: Optional[str]) -> Optional[str]:
    """Turn a stored key into a temporary URL the browser can load.

    Returns None for a recipe with no photograph, and also if S3 is not
    configured — a missing photo should never break listing recipes.
    """
    if not key or not BUCKET:
        return None
    try:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": key},
            ExpiresIn=LINK_SECONDS,
        )
    except Exception:
        return None


def delete(key: Optional[str]) -> None:
    """Remove an object. Best effort: never let tidy-up break the request."""
    if not key or not BUCKET:
        return
    try:
        _client().delete_object(Bucket=BUCKET, Key=key)
    except Exception:
        pass
