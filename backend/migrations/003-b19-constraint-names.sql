-- 003 — B19 (nomadwiz/kete#263): give six CHECK constraints the names models.py uses
--
-- schema.sql declared these six checks without a name, so PostgreSQL named them
-- itself (plan_slots_meal_position_check and so on), while models.py names them
-- ck_slot_meal and the rest. The server's database is built from schema.sql and
-- the tests' from models.py, so the same rule carried two names, and a test that
-- asserts ck_slot_meal (tests/test_conflicts.py) was asserting a name the server
-- did not have. schema.sql now names them as models.py does; this brings a
-- database built before that change up to the same names.
--
-- Run once, against each database that predates this change. A rename changes
-- only the name: no rule changes, no row is read or rewritten, and it takes no
-- time. If a statement fails because the old name does not exist, the database
-- was not built from schema.sql. List its checks first with
--     SELECT conrelid::regclass, conname FROM pg_constraint WHERE contype = 'c';
-- and rename whatever holds that rule. The transaction leaves nothing half-done.

BEGIN;

ALTER TABLE profiles   RENAME CONSTRAINT profiles_age_check            TO ck_profile_age;
ALTER TABLE profiles   RENAME CONSTRAINT profiles_sex_check            TO ck_profile_sex;
ALTER TABLE profiles   RENAME CONSTRAINT profiles_activity_level_check TO ck_profile_activity;
ALTER TABLE recipes    RENAME CONSTRAINT recipes_servings_check        TO ck_recipe_servings;
ALTER TABLE plan_slots RENAME CONSTRAINT plan_slots_day_of_week_check  TO ck_slot_day;
ALTER TABLE plan_slots RENAME CONSTRAINT plan_slots_meal_position_check TO ck_slot_meal;

COMMIT;

-- To undo:
--
-- ALTER TABLE profiles   RENAME CONSTRAINT ck_profile_age      TO profiles_age_check;
-- ALTER TABLE profiles   RENAME CONSTRAINT ck_profile_sex      TO profiles_sex_check;
-- ALTER TABLE profiles   RENAME CONSTRAINT ck_profile_activity TO profiles_activity_level_check;
-- ALTER TABLE recipes    RENAME CONSTRAINT ck_recipe_servings  TO recipes_servings_check;
-- ALTER TABLE plan_slots RENAME CONSTRAINT ck_slot_day         TO plan_slots_day_of_week_check;
-- ALTER TABLE plan_slots RENAME CONSTRAINT ck_slot_meal        TO plan_slots_meal_position_check;
