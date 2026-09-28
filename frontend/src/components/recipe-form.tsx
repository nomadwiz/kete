import { Form } from "react-router";

import type { RecipeDetail } from "../types/recipe";
import "./recipe-form.css";

export type RecipeFormProps = {
  // The record being edited, or absent to write a new one. Nothing else
  // distinguishes the two cases: the same nine controls are drawn either way,
  // because RecipeIn serves POST /recipes and PUT /recipes/{recipe_id} alike
  // and there is no partial update to draw a smaller form for.
  recipe?: RecipeDetail;
  // A message the hosting route's action returned rather than threw, which
  // makes it recoverable -- the user fixes what they typed and submits again.
  // A thrown failure never reaches here; it goes to the route ErrorBoundary.
  error?: string;
  // Whether that action is in flight. The host owns this because it owns the
  // action: /recipes/:id answers a save and a delete from one action, and only
  // the host can tell which of the two is running.
  //
  // Compute it with useSubmitting from src/use-submitting.ts, and never with
  // a plain equality against `useNavigation().formAction`: that reads
  // `/recipes?new` on the first host and `/recipes/7?edit` on the second,
  // because react-router copies the current search into a Form declaring no
  // action and ADR 002 addresses both hosts with one.
  busy?: boolean;
};

export default function RecipeForm({
  recipe,
  error,
  busy = false,
}: RecipeFormProps) {
  // No `action` prop on the Form below, which is the whole reason this
  // component serves both cases. A react-router Form submits to the route it
  // is rendered under, so the modal on /recipes posts a create and the
  // in-place form on /recipes/:id posts an edit without either host passing a
  // path in -- and no path string leaves routes.tsx, which ADR 002 requires.
  //
  // The nine controls take defaultValue rather than value, so they stay
  // uncontrolled, for the reason measurement.tsx records: a submission the API
  // refused re-renders this component without remounting it, so what the user
  // typed survives above the message saying why it was refused.
  return (
    <Form className="recipe-form" method="post" aria-busy={busy}>
      {error ? (
        <p className="recipe-form__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="recipe-form__field">
        <label className="recipe-form__label" htmlFor="recipe-name">
          Name
        </label>
        <input
          id="recipe-name"
          name="name"
          type="text"
          defaultValue={recipe?.name ?? ""}
          maxLength={150}
          required
        />
      </div>

      {/* Cuisine carries no `required`, and neither do the two text areas
          below. RecipeIn lists all nine fields as required, which says the key
          must be present rather than that the value must be interesting: only
          `name` carries a minLength, and the other three admit "". The form
          always sends every key, so the contract is met. Marking them required
          here would refuse a submission the API accepts. */}
      <div className="recipe-form__pair">
        <div className="recipe-form__field">
          <label className="recipe-form__label" htmlFor="recipe-cuisine">
            Cuisine
          </label>
          <input
            id="recipe-cuisine"
            name="cuisine"
            type="text"
            defaultValue={recipe?.cuisine ?? ""}
            maxLength={60}
          />
        </div>

        <div className="recipe-form__field">
          <label className="recipe-form__label" htmlFor="recipe-servings">
            Servings
          </label>
          <input
            id="recipe-servings"
            name="servings"
            type="number"
            defaultValue={recipe?.servings ?? ""}
            min="1"
            step="1"
            required
          />
        </div>
      </div>

      <div className="recipe-form__field">
        <label className="recipe-form__label" htmlFor="recipe-ingredients">
          Ingredients
        </label>
        <textarea
          id="recipe-ingredients"
          name="ingredients"
          defaultValue={recipe?.ingredients ?? ""}
          rows={5}
        />
      </div>

      {/* Method is the word a cook uses; `steps` is the word the contract
          uses. The label takes the first and the name takes the second. */}
      <div className="recipe-form__field">
        <label className="recipe-form__label" htmlFor="recipe-steps">
          Method
        </label>
        <textarea
          id="recipe-steps"
          name="steps"
          defaultValue={recipe?.steps ?? ""}
          rows={8}
        />
      </div>

      <fieldset
        className="recipe-form__nutrition"
        aria-describedby="recipe-nutrition-note"
      >
        <legend className="recipe-form__legend">Nutrition per serving</legend>

        {/* The sentence this issue exists for. Kete does not work the four
            figures out from the ingredients, and doc/design/product.md §5 puts
            that out of scope deliberately -- so a user who assumes otherwise
            leaves four wrong numbers behind, and every weekly comparison drawn
            from them is wrong too. The note is tied to the group with
            aria-describedby, so it is read out with the group rather than
            being a paragraph a screen reader user has already passed. */}
        <p className="recipe-form__note" id="recipe-nutrition-note">
          Kete does not work these out from your ingredients. Enter the figures
          for one serving yourself, from the packet or your own sums — they are
          what your week is compared against.
        </p>

        <div className="recipe-form__pair">
          <div className="recipe-form__field">
            <label className="recipe-form__label" htmlFor="recipe-energy-kcal">
              Energy (kcal)
            </label>
            <input
              aria-describedby="recipe-nutrition-note"
              id="recipe-energy-kcal"
              name="energy_kcal"
              type="number"
              defaultValue={recipe?.energy_kcal ?? ""}
              min="0"
              max="99999"
              step="1"
              required
            />
          </div>

          <div className="recipe-form__field">
            <label className="recipe-form__label" htmlFor="recipe-protein-g">
              Protein (g)
            </label>
            <input
              aria-describedby="recipe-nutrition-note"
              id="recipe-protein-g"
              name="protein_g"
              type="number"
              defaultValue={recipe?.protein_g ?? ""}
              min="0"
              max="9999"
              step="1"
              required
            />
          </div>
        </div>

        <div className="recipe-form__pair">
          <div className="recipe-form__field">
            <label className="recipe-form__label" htmlFor="recipe-carbs-g">
              Carbohydrate (g)
            </label>
            <input
              aria-describedby="recipe-nutrition-note"
              id="recipe-carbs-g"
              name="carbs_g"
              type="number"
              defaultValue={recipe?.carbs_g ?? ""}
              min="0"
              max="9999"
              step="1"
              required
            />
          </div>

          <div className="recipe-form__field">
            <label className="recipe-form__label" htmlFor="recipe-fat-g">
              Fat (g)
            </label>
            <input
              aria-describedby="recipe-nutrition-note"
              id="recipe-fat-g"
              name="fat_g"
              type="number"
              defaultValue={recipe?.fat_g ?? ""}
              min="0"
              max="9999"
              step="1"
              required
            />
          </div>
        </div>
      </fieldset>

      {/* No intent field. ADR 002 has /recipes/:id answer a save and C15
          (nomadwiz/kete#179)'s delete from one action, and a submission with
          no intent is the save: the delete button is its own Form carrying
          `intent=delete`, so the branch reads that key's absence. Naming the
          save here as well would be a second way to spell the same thing. */}
      <button className="recipe-form__submit" type="submit" disabled={busy}>
        {busy ? "Saving…" : recipe ? "Save changes" : "Save recipe"}
      </button>
    </Form>
  );
}
