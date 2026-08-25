"""
Database connection.

The connection details live in .env, never in this file, so the same code runs
against your laptop today and Amazon RDS later.

The password is kept as its own setting and URL-encoded here, because passwords
often contain characters like @ : / # that would otherwise break the connection
string. (An @ in a password makes the driver think the server name starts early.)
"""

import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()  # reads the .env file sitting next to this one


def _build_url() -> str:
    # If someone sets a full DATABASE_URL, respect it (handy on a server).
    full = os.getenv("DATABASE_URL")
    if full:
        return full

    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "kete")

    # quote_plus turns @ into %40, # into %23, and so on.
    return (
        f"postgresql+psycopg2://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{name}"
    )


DATABASE_URL = _build_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Hand one database session to an endpoint, then close it afterwards.

    FastAPI calls this for you when an endpoint asks for
    `db: Session = Depends(get_db)`.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
