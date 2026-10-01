"""
B26 (nomadwiz/kete#328): recipe servings has an upper bound.

Every other numeric field in RecipeIn declares an le= matched to its column;
servings had none, and the column under it is a 32-bit Integer. 2147483648
overflowed it, and the API answered 500 where a 422 belongs: the form never saw
the error, and the recipe the person typed was lost. The bound is 100, a human
one, so it refuses nonsense as well as the overflow.

Like test_contract.py these need no database, so they run in CI. They read the
request model and the contract it publishes, not the tables.
"""

import pytest
from pydantic import ValidationError

import main


def _recipe(servings):
    return main.RecipeIn(name="Laksa", cuisine="Malaysian", ingredients="",
                         steps="", servings=servings, energy_kcal=500,
                         protein_g=30, carbs_g=60, fat_g=15)


@pytest.mark.parametrize("servings", [1, 100])
def test_servings_within_the_bound_are_accepted(servings):
    assert _recipe(servings).servings == servings


@pytest.mark.parametrize("servings", [0, 101, 2147483648],
                         ids=["zero", "one-over", "past-the-column"])
def test_servings_outside_the_bound_are_refused(servings):
    """Refused by the model is a 422, before any query runs. 2147483648 is the
    value that reached the 32-bit column and answered 500 (#328)."""
    with pytest.raises(ValidationError):
        _recipe(servings)


def test_both_recipe_writes_publish_the_bound():
    """POST /recipes and PUT /recipes/{recipe_id} both take RecipeIn, so one
    bound covers both, and the contract says so: the client mirrors this
    maximum as `max` on #recipe-servings."""
    spec = main.app.openapi()
    for path, method in [("/recipes", "post"), ("/recipes/{recipe_id}", "put")]:
        body = spec["paths"][path][method]["requestBody"]["content"]
        assert body["application/json"]["schema"]["$ref"] \
            == "#/components/schemas/RecipeIn", (method, path)

    servings = spec["components"]["schemas"]["RecipeIn"]["properties"]["servings"]
    assert (servings["exclusiveMinimum"], servings["maximum"]) == (0, 100)
