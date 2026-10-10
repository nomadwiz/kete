"""
Recalculate every stored nutrition target from the profile it came from.
B29 (#376).

Targets saved before #313 (61a8d5c) still hold the 30 / 40 / 30 split, because
only POST /profile/metrics writes nutrition_targets and nothing recomputes a
stored row. This runs compute_targets from main.py on each stored profile, so
the formula still exists exactly once; a SQL migration would have to write the
Mifflin-St Jeor equation and the activity factors a second time.

    python recalc_targets.py           # list the targets that differ; write nothing
    python recalc_targets.py --apply   # rewrite them, in one transaction

Run it from this folder, where .env names the database. It prints user ids and
target figures only, never the body metrics behind them: profiles is the most
sensitive table in the system, and this output is pasted into the issue as the
record of the run. For the same reason it names the database but not its host.
B33 (#402).
"""

import sys
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import make_url, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

import models
from database import DATABASE_URL, SessionLocal
from main import compute_targets

FIELDS = ("energy_kcal", "protein_g", "carbs_g", "fat_g")

Stale = tuple[int, Optional[dict], dict]   # user_id, stored, computed


def find_stale(db: Session, lock: bool = False) -> tuple[int, list[Stale]]:
    """How many profiles were checked, and each one whose target differs.

    stored is None for a profile with no target. save_metrics writes both rows
    in one transaction, so there should be none; one found here is written like
    any other.

    The stored figures stay Decimal for the comparison. int() would truncate a
    hand-edited 128.40 to 128 and call it equal to a computed 128.

    With lock, each profile row is held FOR UPDATE until the caller commits. A
    save that lands between this read and the write would otherwise have its
    fresh target overwritten with one computed from the metrics it replaced;
    held, the save waits, then writes over this run instead. Only the profile
    side is locked: PostgreSQL refuses FOR UPDATE on the nullable side of an
    outer join.
    """
    query = (select(models.Profile, models.NutritionTarget)
             .outerjoin(models.NutritionTarget,
                        models.NutritionTarget.user_id == models.Profile.user_id)
             .order_by(models.Profile.user_id))
    if lock:
        query = query.with_for_update(of=models.Profile)
    rows = db.execute(query).all()

    stale = []
    for profile, target in rows:
        # The metric columns are Numeric, so they load as Decimal, and Decimal
        # times the float activity factor raises. save_metrics never meets
        # this: MetricsIn hands compute_targets floats.
        computed = compute_targets(float(profile.weight_kg),
                                   float(profile.height_cm), profile.age,
                                   profile.sex, profile.activity_level)
        stored = (None if target is None
                  else {f: getattr(target, f) for f in FIELDS})
        if stored != computed:
            stale.append((profile.user_id, stored, computed))
    return len(rows), stale


def recalculate(db: Session, stale: list[Stale]) -> None:
    """Write each computed target as save_metrics does. The caller commits."""
    now = datetime.now(timezone.utc)
    for user_id, _, computed in stale:
        db.execute(pg_insert(models.NutritionTarget)
                   .values(user_id=user_id, computed_at=now, **computed)
                   .on_conflict_do_update(
                       index_elements=[models.NutritionTarget.user_id],
                       set_=dict(computed_at=now, **computed)))


def _figures(target: Optional[dict]) -> str:
    """'2464 kcal, 123 g protein, 308 g carbs, 82 g fat', without the .00."""
    if target is None:
        return "no target"
    n = {f: f"{Decimal(target[f]).normalize():f}" for f in FIELDS}
    return (f"{n['energy_kcal']} kcal, {n['protein_g']} g protein, "
            f"{n['carbs_g']} g carbs, {n['fat_g']} g fat")


def main(argv: list[str]) -> int:
    if argv not in ([], ["--apply"]):
        print(__doc__)
        return 2
    apply = argv == ["--apply"]

    print(f"{datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC, "
          f"database {make_url(DATABASE_URL).database}, "
          f"{'--apply' if apply else 'dry run'}\n")

    with SessionLocal() as db:
        checked, stale = find_stale(db, lock=apply)
        for user_id, stored, computed in stale:
            print(f"user {user_id}: {_figures(stored)}  ->  {_figures(computed)}")
        if stale:
            print()

        if not apply:
            print(f"{len(stale)} of {checked} targets differ from their profile. "
                  "Nothing written; --apply rewrites them.")
            return 0

        recalculate(db, stale)
        db.commit()          # every row at once, or none
    print(f"{len(stale)} of {checked} targets rewritten.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
