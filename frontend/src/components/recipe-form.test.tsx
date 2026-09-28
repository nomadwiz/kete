import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import RecipeForm, { type RecipeFormProps } from "./recipe-form";
import type { RecipeDetail } from "../types/recipe";

// The component renders a react-router <Form>, which needs a data router above
// it, so these mount it under a one-route memory router rather than through
// src/test/router.tsx's renderAt. renderAt drives the real route tree, and this
// component has no route of its own -- ADR 002 gives it none, because C11
// (nomadwiz/kete#176) renders it in a modal on /recipes and C12
// (nomadwiz/kete#177) in place on /recipes/:id. Nothing is stubbed on fetch
// either: the form posts to whichever route hosts it and makes no call itself.
function renderForm(props: RecipeFormProps = {}) {
  const router = createMemoryRouter([
    { path: "/", Component: () => <RecipeForm {...props} /> },
  ]);

  return render(<RouterProvider router={router} />);
}

// A recipe as GET /recipes/{recipe_id} answers one, spelled as
// backend/openapi.json spells it. `satisfies` rather than a bare object, so a
// field renamed in the contract fails the build here rather than leaving these
// assertions passing against a shape the form can no longer prefill from.
const RECIPE = {
  recipe_id: 7,
  name: "Kūmara and black bean chilli",
  cuisine: "Mexican",
  ingredients: "2 kūmara\n1 tin black beans",
  steps: "Roast the kūmara. Warm the beans. Combine.",
  servings: 4,
  energy_kcal: 520,
  protein_g: 18,
  carbs_g: 74,
  fat_g: 16,
  photo_url: null,
} satisfies RecipeDetail;

describe("the recipe form with no recipe given", () => {
  it("draws every control empty, for a recipe that does not exist yet", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Cuisine")).toHaveValue("");
    expect(screen.getByLabelText("Ingredients")).toHaveValue("");
    expect(screen.getByLabelText("Method")).toHaveValue("");
    expect(screen.getByLabelText("Servings")).toHaveValue(null);
    expect(screen.getByLabelText("Energy (kcal)")).toHaveValue(null);
    expect(screen.getByLabelText("Protein (g)")).toHaveValue(null);
    expect(screen.getByLabelText("Carbohydrate (g)")).toHaveValue(null);
    expect(screen.getByLabelText("Fat (g)")).toHaveValue(null);
    expect(
      screen.getByRole("button", { name: "Save recipe" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // The clause the issue exists for. Kete does not derive the four figures from
  // the ingredients -- doc/design/product.md §5 puts that out of scope -- and a
  // user who assumes it does will leave them wrong. So the group carries the
  // sentence saying whose numbers they are, and it is announced with the group
  // rather than sitting loose above it.
  it("says the four nutrition figures are the user's own, not Kete's", () => {
    renderForm();

    const nutrition = screen.getByRole("group", {
      name: "Nutrition per serving",
    });

    expect(nutrition).toHaveAccessibleDescription(/does not work these out/i);

    // And on each of the four controls as well as on the group around them. A
    // group's description is announced far less consistently than a control's
    // own is, and this is the one sentence the issue exists for, so it is
    // attached where the user is standing when they would type the wrong
    // number rather than only where the group begins.
    for (const label of [
      "Energy (kcal)",
      "Protein (g)",
      "Carbohydrate (g)",
      "Fat (g)",
    ]) {
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(
        /does not work these out/i,
      );
    }
  });

  // The bounds are the validation. There is no JavaScript check behind them,
  // by house rule, so a wrong attribute is not a failed assertion anywhere --
  // it is a 422 the user reads as the server breaking. These are
  // backend/openapi.json's own numbers for RecipeIn. Note servings: the schema
  // says integer with exclusiveMinimum 0, which is min="1" and not min="0".
  it("mirrors RecipeIn's bounds in the controls rather than in script", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toHaveAttribute("maxlength", "150");
    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Cuisine")).toHaveAttribute("maxlength", "60");

    // The three fields RecipeIn requires a key for and accepts "" in. Marking
    // them required would have the browser refuse a recipe the API takes.
    expect(screen.getByLabelText("Cuisine")).not.toBeRequired();
    expect(screen.getByLabelText("Ingredients")).not.toBeRequired();
    expect(screen.getByLabelText("Method")).not.toBeRequired();

    expect(screen.getByLabelText("Servings")).toHaveAttribute("min", "1");

    for (const [label, max] of [
      ["Energy (kcal)", "99999"],
      ["Protein (g)", "9999"],
      ["Carbohydrate (g)", "9999"],
      ["Fat (g)", "9999"],
    ]) {
      const control = screen.getByLabelText(label);

      expect(control).toHaveAttribute("min", "0");
      expect(control).toHaveAttribute("max", max);
      expect(control).toBeRequired();
    }
  });
});

describe("the recipe form with a recipe given", () => {
  it("prefills every control from the record being edited", () => {
    renderForm({ recipe: RECIPE });

    expect(screen.getByLabelText("Name")).toHaveValue(RECIPE.name);
    expect(screen.getByLabelText("Cuisine")).toHaveValue(RECIPE.cuisine);
    expect(screen.getByLabelText("Ingredients")).toHaveValue(
      RECIPE.ingredients,
    );
    expect(screen.getByLabelText("Method")).toHaveValue(RECIPE.steps);
    expect(screen.getByLabelText("Servings")).toHaveValue(RECIPE.servings);
    expect(screen.getByLabelText("Energy (kcal)")).toHaveValue(
      RECIPE.energy_kcal,
    );
    expect(screen.getByLabelText("Protein (g)")).toHaveValue(RECIPE.protein_g);
    expect(screen.getByLabelText("Carbohydrate (g)")).toHaveValue(
      RECIPE.carbs_g,
    );
    expect(screen.getByLabelText("Fat (g)")).toHaveValue(RECIPE.fat_g);
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  // Every control sends the name the contract spells, so the route action that
  // receives the submission reads RecipeIn's own keys off the FormData. `steps`
  // is the trap: the label says Method, because that is the word a cook uses.
  it("names every control as RecipeIn spells it", () => {
    const { container } = renderForm({ recipe: RECIPE });
    const names = [...container.querySelectorAll("[name]")].map((control) =>
      control.getAttribute("name"),
    );

    expect(names).toEqual([
      "name",
      "cuisine",
      "servings",
      "ingredients",
      "steps",
      "energy_kcal",
      "protein_g",
      "carbs_g",
      "fat_g",
    ]);
  });
});

// A write the API refused comes back from the route action and is rendered
// here, not thrown: doc/design/implementation.md's rule is that a returned
// value is recoverable and a thrown one goes to the error boundary. The form
// is uncontrolled, so re-rendering it around the message leaves what the user
// typed where it was.
describe("the recipe form with an error from the action", () => {
  it("shows the server's own message without losing the form", () => {
    renderForm({ error: "Recipe name already used" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Recipe name already used",
    );
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });
});

// The host owns this, because /recipes/:id answers a save and a delete from
// one action and only the host can tell which is running. What the form owes
// it is the two things a person sees while they wait: a button that says so
// and a button they cannot press twice.
describe("the recipe form while the host's action is in flight", () => {
  it("disables the button and says it is saving", () => {
    renderForm({ recipe: RECIPE, busy: true });

    const submit = screen.getByRole("button", { name: "Saving…" });

    expect(submit).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});
