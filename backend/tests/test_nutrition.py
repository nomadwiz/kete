"""
B10 (nomadwiz/kete#160): the nutrition engine, checked against figures worked
by hand.

compute_targets is the only genuinely algorithmic code in the system, and the
only place a wrong number is silently wrong: nothing downstream can tell a
mis-transcribed coefficient from a real target. So every expected value below
is worked out in the comment beside it, from the published equation, and not
computed by the test. A reader can check the arithmetic without trusting the
code under test, and the worked cases double as evidence for the report.

    Mifflin-St Jeor (1990), resting energy expenditure in kcal/day:
        10 x weight_kg + 6.25 x height_cm - 5 x age + 5     (male)
        10 x weight_kg + 6.25 x height_cm - 5 x age - 161   (female)
    TDEE = REE x activity factor
        sedentary 1.2 · light 1.375 · moderate 1.55 · active 1.725 · very_active 1.9
    grams = TDEE x share / kcal per gram
        protein 30 % / 4 · carbohydrate 40 % / 4 · fat 30 % / 9

The split is the project's own default, still unsourced (B4, #154). If B4
changes it, the gram figures here change with it; the energy figures do not.

No database: these run in CI, unlike the race tests (#305).
"""

import pytest

import main


@pytest.mark.parametrize("body, expected", [
    # 1. Male, 70 kg, 175 cm, 30, moderate.
    #    REE  = 700 + 1093.75 - 150 + 5 = 1648.75
    #    TDEE = 1648.75 x 1.55           = 2555.5625       -> 2556
    #    protein 2555.5625 x 0.30 / 4    = 191.667         -> 192
    #    carbs   2555.5625 x 0.40 / 4    = 255.556         -> 256
    #    fat     2555.5625 x 0.30 / 9    =  85.185         ->  85
    (dict(weight_kg=70, height_cm=175, age=30, sex="male",
          activity_level="moderate"),
     dict(energy_kcal=2556, protein_g=192, carbs_g=256, fat_g=85)),

    # 2. Female, 60 kg, 165 cm, 25, sedentary.
    #    REE  = 600 + 1031.25 - 125 - 161 = 1345.25
    #    TDEE = 1345.25 x 1.2             = 1614.3          -> 1614
    #    protein 1614.3 x 0.30 / 4        = 121.0725        -> 121
    #    carbs   1614.3 x 0.40 / 4        = 161.43          -> 161
    #    fat     1614.3 x 0.30 / 9        =  53.81          ->  54
    (dict(weight_kg=60, height_cm=165, age=25, sex="female",
          activity_level="sedentary"),
     dict(energy_kcal=1614, protein_g=121, carbs_g=161, fat_g=54)),

    # 3. Female, 80 kg, 170 cm, 40, light.
    #    REE  = 800 + 1062.5 - 200 - 161  = 1501.5
    #    TDEE = 1501.5 x 1.375            = 2064.5625       -> 2065
    #    protein 2064.5625 x 0.30 / 4     = 154.842         -> 155
    #    carbs   2064.5625 x 0.40 / 4     = 206.456         -> 206
    #    fat     2064.5625 x 0.30 / 9     =  68.819         ->  69
    (dict(weight_kg=80, height_cm=170, age=40, sex="female",
          activity_level="light"),
     dict(energy_kcal=2065, protein_g=155, carbs_g=206, fat_g=69)),

    # 4. Female, 55 kg, 160 cm, 70, active.
    #    REE  = 550 + 1000 - 350 - 161    = 1039
    #    TDEE = 1039 x 1.725              = 1792.275        -> 1792
    #    protein 1792.275 x 0.30 / 4      = 134.421         -> 134
    #    carbs   1792.275 x 0.40 / 4      = 179.2275        -> 179
    #    fat     1792.275 x 0.30 / 9      =  59.7425        ->  60
    (dict(weight_kg=55, height_cm=160, age=70, sex="female",
          activity_level="active"),
     dict(energy_kcal=1792, protein_g=134, carbs_g=179, fat_g=60)),

    # 5. Male, 90 kg, 180 cm, 45, very active.
    #    REE  = 900 + 1125 - 225 + 5      = 1805
    #    TDEE = 1805 x 1.9                = 3429.5          -> 3430
    #    protein 3429.5 x 0.30 / 4        = 257.2125        -> 257
    #    carbs   3429.5 x 0.40 / 4        = 342.95          -> 343
    #    fat     3429.5 x 0.30 / 9        = 114.317         -> 114
    (dict(weight_kg=90, height_cm=180, age=45, sex="male",
          activity_level="very_active"),
     dict(energy_kcal=3430, protein_g=257, carbs_g=343, fat_g=114)),
], ids=["male-moderate", "female-sedentary", "female-light", "female-active",
        "male-very-active"])
def test_targets_match_the_hand_worked_figures(body, expected):
    assert main.compute_targets(**body) == expected


def test_the_sexes_differ_by_exactly_166_kcal_of_resting_energy():
    """+5 against -161: the only term that depends on sex. Sedentary, so the
    difference in the target is 166 x 1.2 = 199.2."""
    same = dict(weight_kg=70, height_cm=175, age=30, activity_level="sedentary")
    male = main.compute_targets(sex="male", **same)["energy_kcal"]
    female = main.compute_targets(sex="female", **same)["energy_kcal"]

    # REE male 1648.75, female 1482.75; x 1.2 = 1978.5 and 1779.3.
    # 1978.5 is exactly half: see the rounding test below.
    assert (male, female) == (1978, 1779)


# --------------------------------------------------------------------------
# Rounding, pinned on purpose
# --------------------------------------------------------------------------
def test_an_exact_half_rounds_to_even_not_up():
    """Python's round() takes an exact .5 to the even neighbour, so a reader
    checking with school rounding gets one kcal more than the system stores.

    Male, 90 kg, 180 cm, 43, very active:
        REE  = 900 + 1125 - 215 + 5 = 1815
        TDEE = 1815 x 1.9           = 3448.5
    Half up would give 3449; the system stores 3448. This is the behaviour as
    built, pinned so that it cannot change by accident. Whether it should is
    #308's question (ADR 006): the summary's percent rounds half up, and the
    report has to say which convention each figure uses.
    """
    targets = main.compute_targets(weight_kg=90, height_cm=180, age=43,
                                   sex="male", activity_level="very_active")

    assert targets["energy_kcal"] == 3448


def test_the_macronutrient_grams_do_not_re_sum_to_the_energy_target():
    """Each figure is rounded on its own, so converting the grams back to kcal
    does not reproduce the energy target. Case 1 above:
        192 x 4 + 256 x 4 + 85 x 9 = 768 + 1024 + 765 = 2557, not 2556.
    Expected, not a bug, and worth one sentence in the report so a marker who
    adds them up is not left to find it.
    """
    t = main.compute_targets(weight_kg=70, height_cm=175, age=30, sex="male",
                             activity_level="moderate")

    assert t["protein_g"] * 4 + t["carbs_g"] * 4 + t["fat_g"] * 9 == 2557
    assert t["energy_kcal"] == 2556


# --------------------------------------------------------------------------
# The constants themselves
# --------------------------------------------------------------------------
def test_the_activity_factors_are_the_five_the_api_accepts():
    """A factor with no matching request value is dead; a request value with no
    factor is a KeyError, a 500. The two lists must be the same."""
    assert set(main.ACTIVITY_FACTORS) == set(main.Activity.__args__)
    assert main.ACTIVITY_FACTORS == {"sedentary": 1.2, "light": 1.375,
                                     "moderate": 1.55, "active": 1.725,
                                     "very_active": 1.9}


def test_the_macronutrient_split_covers_all_of_the_energy():
    assert sum(main.MACRO_SPLIT.values()) == pytest.approx(1.0)
