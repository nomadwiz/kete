-- 001 — B14 (nomadwiz/kete#153): bound every numeric input
--
-- schema.sql creates tables with CREATE TABLE IF NOT EXISTS, so it never alters
-- a database that already has them. These statements bring an existing database
-- up to the constraints schema.sql now declares for a fresh one.
--
-- Run once, against each database that predates this change. Safe to read first:
-- nothing here drops, rewrites or deletes anything — each statement only adds a
-- rule about what may be written in future. Every one is undone by the matching
-- DROP CONSTRAINT at the bottom of this file.
--
-- If a statement fails, a row already violating that rule is stored. Find it
-- before forcing anything: the rule is probably right and the row is probably wrong.

BEGIN;

-- profiles: age, sex and activity were already constrained. Weight and height
-- were constrained nowhere, at either tier, so a negative weight was accepted
-- and a plausible-looking target set was computed from it and stored.
ALTER TABLE profiles
    ADD CONSTRAINT ck_profile_weight CHECK (weight_kg > 0 AND weight_kg <= 635);
ALTER TABLE profiles
    ADD CONSTRAINT ck_profile_height CHECK (height_cm > 0 AND height_cm <= 272);

-- recipes: servings was already constrained. The four nutrition columns accepted
-- negatives, and a recipe at -900 kcal drags a whole week's totals down.
-- Zero is allowed: water and black coffee are legitimate recipes.
ALTER TABLE recipes
    ADD CONSTRAINT ck_recipe_energy  CHECK (energy_kcal >= 0);
ALTER TABLE recipes
    ADD CONSTRAINT ck_recipe_protein CHECK (protein_g >= 0);
ALTER TABLE recipes
    ADD CONSTRAINT ck_recipe_carbs   CHECK (carbs_g >= 0);
ALTER TABLE recipes
    ADD CONSTRAINT ck_recipe_fat     CHECK (fat_g >= 0);

-- nutrition_targets: had no constraints at all. These four values are written by
-- compute_targets(), not by a request model, so no Pydantic bound reaches them and
-- the database is the only gate they pass. ADR 001 depends on a target never being
-- zero: it is what lets GET /mealplan/summary return percent as a whole number
-- without a divide-by-zero case. Mifflin-St Jeor cannot produce zero, so this
-- records in the schema what the equation already guarantees.
ALTER TABLE nutrition_targets
    ADD CONSTRAINT ck_target_energy  CHECK (energy_kcal > 0);
ALTER TABLE nutrition_targets
    ADD CONSTRAINT ck_target_protein CHECK (protein_g > 0);
ALTER TABLE nutrition_targets
    ADD CONSTRAINT ck_target_carbs   CHECK (carbs_g > 0);
ALTER TABLE nutrition_targets
    ADD CONSTRAINT ck_target_fat     CHECK (fat_g > 0);

COMMIT;

-- To undo:
--
-- ALTER TABLE profiles          DROP CONSTRAINT ck_profile_weight;
-- ALTER TABLE profiles          DROP CONSTRAINT ck_profile_height;
-- ALTER TABLE recipes           DROP CONSTRAINT ck_recipe_energy;
-- ALTER TABLE recipes           DROP CONSTRAINT ck_recipe_protein;
-- ALTER TABLE recipes           DROP CONSTRAINT ck_recipe_carbs;
-- ALTER TABLE recipes           DROP CONSTRAINT ck_recipe_fat;
-- ALTER TABLE nutrition_targets DROP CONSTRAINT ck_target_energy;
-- ALTER TABLE nutrition_targets DROP CONSTRAINT ck_target_protein;
-- ALTER TABLE nutrition_targets DROP CONSTRAINT ck_target_carbs;
-- ALTER TABLE nutrition_targets DROP CONSTRAINT ck_target_fat;
