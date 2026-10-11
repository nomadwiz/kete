"""
The five tables, as Python classes.

Each class is one table from design/Database_Diagram.drawio, and each attribute
is one column. SQLAlchemy turns these into SQL for you, so instead of writing
    INSERT INTO users (first_name, ...) VALUES (...)
you write
    db.add(User(first_name=..., ...))

These definitions match schema.sql exactly. If you change one, change both.
tests/test_schema.py builds a database from each and fails on any difference:
the server's database is built from schema.sql, the tests' from this file. Like
every database test it needs TEST_DATABASE_URL, which CI sets (S15, #305).
"""

from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text,
    UniqueConstraint, func, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _now():
    return datetime.now(timezone.utc)


# Each timestamp below carries both: default=_now is what the ORM writes, and
# server_default=func.now() is schema.sql's DEFAULT now(), which a row written
# any other way gets.


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, server_default=func.now())

    # `cascade="all, delete-orphan"` means deleting a user through the ORM
    # deletes everything of theirs: SQLAlchemy removes the children itself.
    # ON DELETE CASCADE in schema.sql does the same for a delete made in SQL.
    profile = relationship("Profile", back_populates="user",
                           uselist=False, cascade="all, delete-orphan")
    target = relationship("NutritionTarget", back_populates="user",
                          uselist=False, cascade="all, delete-orphan")
    recipes = relationship("Recipe", back_populates="owner",
                           cascade="all, delete-orphan")
    plan_slots = relationship("PlanSlot", back_populates="user",
                              cascade="all, delete-orphan")


class Profile(Base):
    """The raw body metrics. Most sensitive table in the system."""
    __tablename__ = "profiles"

    profile_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    height_cm: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    sex: Mapped[str] = mapped_column(String(10), nullable=False)
    activity_level: Mapped[str] = mapped_column(String(20), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, server_default=func.now())

    user = relationship("User", back_populates="profile")

    __table_args__ = (
        CheckConstraint("weight_kg > 0 AND weight_kg <= 635", name="ck_profile_weight"),
        CheckConstraint("height_cm > 0 AND height_cm <= 272", name="ck_profile_height"),
        CheckConstraint("age > 0 AND age < 130", name="ck_profile_age"),
        CheckConstraint("sex IN ('male','female')", name="ck_profile_sex"),
        CheckConstraint(
            "activity_level IN ('sedentary','light','moderate','active','very_active')",
            name="ck_profile_activity"),
    )


class NutritionTarget(Base):
    """Computed by the nutrition engine and stored, so the rest of the app
    never has to re-read the raw metrics in Profile."""
    __tablename__ = "nutrition_targets"

    target_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    energy_kcal: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    protein_g: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    carbs_g: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    fat_g: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, server_default=func.now())

    user = relationship("User", back_populates="target")

    # The engine writes these, not a request model, so the database is the only
    # gate they pass. ADR 001 relies on a target never being zero.
    __table_args__ = (
        CheckConstraint("energy_kcal > 0", name="ck_target_energy"),
        CheckConstraint("protein_g > 0", name="ck_target_protein"),
        CheckConstraint("carbs_g > 0", name="ck_target_carbs"),
        CheckConstraint("fat_g > 0", name="ck_target_fat"),
    )


class Recipe(Base):
    __tablename__ = "recipes"

    recipe_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    cuisine: Mapped[str | None] = mapped_column(String(60))
    ingredients: Mapped[str | None] = mapped_column(Text)
    steps: Mapped[str | None] = mapped_column(Text)
    servings: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1"))
    energy_kcal: Mapped[float | None] = mapped_column(Numeric(7, 2))   # per serving
    protein_g: Mapped[float | None] = mapped_column(Numeric(6, 2))     # per serving
    carbs_g: Mapped[float | None] = mapped_column(Numeric(6, 2))       # per serving
    fat_g: Mapped[float | None] = mapped_column(Numeric(6, 2))         # per serving
    # The S3 object key, not a URL; storage.link_for signs a link from it on
    # every read. The name is historical, as schema.sql explains.
    photo_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, server_default=func.now())

    owner = relationship("User", back_populates="recipes")
    plan_slots = relationship("PlanSlot", back_populates="recipe",
                              cascade="all, delete-orphan")

    __table_args__ = (
        # Named as in schema.sql, so both build the same index.
        Index("idx_recipes_user", "user_id"),
        CheckConstraint("servings > 0", name="ck_recipe_servings"),
        CheckConstraint("energy_kcal >= 0", name="ck_recipe_energy"),
        CheckConstraint("protein_g >= 0", name="ck_recipe_protein"),
        CheckConstraint("carbs_g >= 0", name="ck_recipe_carbs"),
        CheckConstraint("fat_g >= 0", name="ck_recipe_fat"),
    )


class PlanSlot(Base):
    """One recipe placed in one day-and-meal slot of one week.

    This is the junction table: it links a user AND a recipe at the same time.
    """
    __tablename__ = "plan_slots"

    slot_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.recipe_id", ondelete="CASCADE"), nullable=False)
    week: Mapped[str] = mapped_column(String(20), nullable=False)
    day_of_week: Mapped[str] = mapped_column(String(10), nullable=False)
    meal_position: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, server_default=func.now())

    user = relationship("User", back_populates="plan_slots")
    recipe = relationship("Recipe", back_populates="plan_slots")

    __table_args__ = (
        # one recipe per day/meal slot per user — stops double-booking
        UniqueConstraint("user_id", "week", "day_of_week", "meal_position",
                         name="uq_plan_slot"),
        # ISO 8601 week. Kept identical to WEEK_PATTERN in main.py: the
        # uniqueness constraint above compares week as text, so two spellings
        # of one week would not collide and a slot could be double-booked.
        CheckConstraint(r"week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'",
                        name="ck_slot_week"),
        CheckConstraint(
            "day_of_week IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')",
            name="ck_slot_day"),
        CheckConstraint(
            "meal_position IN ('breakfast','lunch','dinner')",
            name="ck_slot_meal"),
        # GET /mealplan and its summary read one user's week.
        Index("idx_plan_user_week", "user_id", "week"),
    )
