"""
Passwords and login tokens.

Two jobs:
  1. Turn a password into something safe to store, and check it later.
  2. Issue and read the JWT that proves who a request comes from.
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "")

# Refuse to start rather than fall back to a published default. A token is only
# as trustworthy as the secret that signed it: with a value anyone can read in
# this repository, a stranger can mint a token for any user_id and the API
# believes it. A server that will not boot is a loud, five-minute problem; one
# that boots signing with a known secret is a silent, permanent one.
if not JWT_SECRET or JWT_SECRET.startswith("dev-only-secret"):
    raise RuntimeError(
        "JWT_SECRET is missing or still the placeholder. Put a random value in "
        "backend/.env before starting the API:\n"
        "    python -c \"import secrets; print(secrets.token_hex(32))\"\n"
        "Use a different value on the server from the one on your laptop."
    )
JWT_ALGORITHM = "HS256"
TOKEN_HOURS = 12

# PBKDF2 with SHA-256. Standard, salted, and deliberately slow, which is what
# stops someone brute-forcing the hashes if the database is ever stolen.
_ITERATIONS = 240_000


def hash_password(password: str) -> str:
    """Return 'pbkdf2_sha256$iterations$salt$hash' — safe to store."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), _ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """Check a typed password against the stored hash."""
    try:
        algorithm, iterations, salt, digest = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt.encode(), int(iterations)
        ).hex()
        # compare_digest avoids leaking information through timing
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError):
        return False


def make_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def read_token(token: str) -> int:
    """Return the user_id inside a token. Raises if it is invalid or expired."""
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    return int(payload["sub"])
