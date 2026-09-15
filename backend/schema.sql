-- Kete — PostgreSQL schema for Amazon RDS
-- Matches design/Database_Diagram.drawio exactly.
-- Run once against the RDS instance:  psql -h <endpoint> -U <user> -d kete -f schema.sql

CREATE TABLE IF NOT EXISTS users (
    user_id        SERIAL PRIMARY KEY,
    first_name     VARCHAR(80)  NOT NULL,
    last_name      VARCHAR(80)  NOT NULL,
    username       VARCHAR(50)  NOT NULL UNIQUE,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One profile per user. Holds the raw body metrics (most sensitive table).
CREATE TABLE IF NOT EXISTS profiles (
    profile_id     SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL UNIQUE
                   REFERENCES users(user_id) ON DELETE CASCADE,
    weight_kg      NUMERIC(5,2) NOT NULL,
    height_cm      NUMERIC(5,2) NOT NULL,
    age            INTEGER      NOT NULL CHECK (age > 0 AND age < 130),
    sex            VARCHAR(10)  NOT NULL CHECK (sex IN ('male','female')),
    activity_level VARCHAR(20)  NOT NULL CHECK (activity_level IN
                       ('sedentary','light','moderate','active','very_active')),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Derived from profiles by the nutrition engine and stored, so the rest of the
-- app reads targets without ever re-reading the raw metrics.
CREATE TABLE IF NOT EXISTS nutrition_targets (
    target_id      SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL UNIQUE
                   REFERENCES users(user_id) ON DELETE CASCADE,
    energy_kcal    NUMERIC(7,2) NOT NULL,
    protein_g      NUMERIC(6,2) NOT NULL,
    carbs_g        NUMERIC(6,2) NOT NULL,
    fat_g          NUMERIC(6,2) NOT NULL,
    computed_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipes (
    recipe_id      SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL
                   REFERENCES users(user_id) ON DELETE CASCADE,
    name           VARCHAR(150) NOT NULL,
    cuisine        VARCHAR(60),
    ingredients    TEXT,
    steps          TEXT,
    servings       INTEGER NOT NULL DEFAULT 1 CHECK (servings > 0),
    energy_kcal    NUMERIC(7,2),   -- per serving
    protein_g      NUMERIC(6,2),   -- per serving
    carbs_g        NUMERIC(6,2),   -- per serving
    fat_g          NUMERIC(6,2),   -- per serving
    photo_url      VARCHAR(500),   -- object lives in S3; only the URL is stored
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_slots (
    slot_id        SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL
                   REFERENCES users(user_id) ON DELETE CASCADE,
    recipe_id      INTEGER NOT NULL
                   REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    week           VARCHAR(20) NOT NULL,          -- ISO week or week-start date
    day_of_week    VARCHAR(10) NOT NULL CHECK (day_of_week IN
                       ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
    meal_position  VARCHAR(20) NOT NULL CHECK (meal_position IN
                       ('breakfast','lunch','dinner')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- a day/meal slot can only hold one recipe per user
    CONSTRAINT uq_plan_slot UNIQUE (user_id, week, day_of_week, meal_position)
);

-- Indexes for the queries the API actually runs
CREATE INDEX IF NOT EXISTS idx_recipes_user      ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_user_week    ON plan_slots(user_id, week);
