-- 002 — B17 (nomadwiz/kete#255): settle the week format as ISO YYYY-Www
--
-- `week` was a bare VARCHAR(20) with the comment "ISO week or week-start date".
-- That "or" is the defect. The uniqueness constraint uq_plan_slot compares week
-- as text, so two spellings of the same week — 2026-W39 and 2026-09-21 — do not
-- collide, and one Monday breakfast can be stored twice without complaint. A
-- read of one spelling then returns an empty week that is not empty.
--
-- The expression here is identical to WEEK_PATTERN in backend/main.py, which
-- guards the four API entry points. This guards everything else.
--
-- Run once, against each database that predates this change. It adds a rule and
-- changes no row. Checked 25-09-2026: all nine stored rows are 2026-W39 and
-- already satisfy it, so this applies cleanly. If it fails, a row is stored in a
-- spelling the API will refuse from now on — find it before forcing anything.
--
-- The column stays VARCHAR(20) although the format is eight characters.
-- Narrowing it is a type change rather than a constraint, and the check makes
-- the width moot.

BEGIN;

ALTER TABLE plan_slots
    ADD CONSTRAINT ck_slot_week
    CHECK (week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$');

COMMIT;

-- To undo:
--
-- ALTER TABLE plan_slots DROP CONSTRAINT ck_slot_week;
