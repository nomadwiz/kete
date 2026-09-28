import {
  Link,
  useActionData,
  useLoaderData,
  useSearchParams,
} from "react-router";

import RecipeForm from "../components/recipe-form";
import { PATHS, QUERY } from "../routes";
// The component this file default-exports is also called RecipeDetail, and the
// clash is real rather than cosmetic: this is the first file to need both. The
// type is aliased at the import and neither declaration is renamed, which is
// what targets.tsx does with `Targets as TargetFigures`.
import type { RecipeDetail as Recipe } from "../types/recipe";
import { useSubmitting } from "../use-submitting";
import "./recipe.css";

export default function RecipeDetail() {
  // Null is the recipe that is not there, which recipeLoader answers for both
  // a 404 and an id that is not a whole number.
  const recipe = useLoaderData() as Recipe | null;
  const [searchParams, setSearchParams] = useSearchParams();

  // The one piece of view state this screen has, and it comes out of the
  // address rather than out of this component -- ADR 002's rule and its stated
  // test: a person who has retyped half a method and then refreshes would be
  // surprised to lose it. Held in useState it would go.
  const editing = searchParams.has(QUERY.recipe_edit);

  // What the last submission answered. A string is a refusal recipeAction chose
  // to return rather than throw, so it is shown inside the form above what the
  // person typed; a thrown failure never arrives here at all.
  const error = useActionData() as string | undefined;

  // src/use-submitting.ts, not a comparison written here: under the edit view
  // the whole formAction reads /recipes/7?edit, so an equality against the
  // address would be false for the entire submission, and the hook takes no
  // path precisely so that nobody can hand it PATHS.recipe -- which is the
  // pattern `/recipes/:id` and never an address anything submits to.
  //
  // It answers whether a POST to this route is in flight, which once C15
  // (nomadwiz/kete#179) adds its delete Form here is true for either write.
  // That is the right answer for this one: while a record is being deleted the
  // save button should be dead too. C15's own button is the one that has to
  // tell them apart, and it does that by reading the submitted intent rather
  // than by giving this hook a parameter.
  const saving = useSubmitting("POST");

  // Dropping the key is the whole of closing the edit view, because the form is
  // drawn exactly while the key is there. Replacing rather than pushing:
  // opening it is a link, so that entry is already in the history and Back from
  // the open form closes it -- pushing here would put a second entry on top and
  // Back would reopen a form somebody had just dismissed.
  function closeEdit() {
    setSearchParams(
      (previous) => {
        previous.delete(QUERY.recipe_edit);

        return previous;
      },
      { replace: true },
    );
  }

  if (!recipe) {
    return (
      <div className="recipe">
        <h1 className="recipe__title">No such recipe</h1>

        {/* Not the contract's own sentence, and recipeLoader in routes.tsx
            says why. Deletion is named instead, because it is the case a
            person actually arrives from -- a recipe removed in another tab,
            or a save of one that has gone. */}
        <p className="recipe__missing">
          Nothing in your library is at this address. It may have been deleted.{" "}
          <Link className="recipe__missing-link" to={PATHS.recipes}>
            Back to your recipes
          </Link>
        </p>
      </div>
    );
  }

  // Four near-identical panels, so one list rather than four blocks -- and the
  // list is what makes the grouping uniform by construction rather than
  // uniform because somebody remembered. Energy runs to five digits and the
  // three macronutrients to four, so all four can carry a separator and the
  // first version applied it to energy alone. Grouping a number is formatting,
  // not arithmetic: nothing on this page divides, totals or converts a figure.
  // en-NZ fixed rather than the reader's locale, for the reason targets.tsx
  // gives -- a screenshot of this screen goes in the report.
  const figures: [string, string][] = [
    ["Energy", `${recipe.energy_kcal.toLocaleString("en-NZ")} kcal`],
    ["Protein", `${recipe.protein_g.toLocaleString("en-NZ")} g`],
    ["Carbohydrate", `${recipe.carbs_g.toLocaleString("en-NZ")} g`],
    ["Fat", `${recipe.fat_g.toLocaleString("en-NZ")} g`],
  ];

  return (
    <div className="recipe">
      <p className="recipe__back">
        <Link className="recipe__back-link" to={PATHS.recipes}>
          Your recipes
        </Link>
      </p>

      {/* The record's own name, not what is currently typed into the form: a
          save the API refused leaves the heading naming the recipe as it is
          still stored. */}
      <h1 className="recipe__title">{recipe.name}</h1>

      {editing ? (
        <>
          {/* Mounted only while the address says so, and that is what empties
              the fields. RecipeForm's nine controls are uncontrolled and read
              their defaults at mount, so a form left mounted behind a closed
              view would open again holding whatever was last typed rather than
              what is stored. The same fact is what makes a refusal behave:
              during a 422 the address still carries `edit`, so the form
              re-renders rather than remounting and what the person typed is
              still in it.

              No `action` prop is passed and none is wanted -- RecipeForm
              declares none, so it posts to this route and recipeAction answers
              it. Passing the loaded record is the only thing that makes this
              the edit case rather than the create one. */}
          <RecipeForm recipe={recipe} error={error} busy={saving} />

          {/* A button rather than a link back to the read address, because it
              has to be refusable: a navigation away during a save abandons a
              PUT that may already have reached the API, throwing away both the
              nine typed fields and any refusal coming back, and leaving a
              person who cannot tell whether the recipe was saved. `disabled` is
              how a button refuses; a link has no equivalent. */}
          <button
            className="recipe__cancel"
            type="button"
            disabled={saving}
            onClick={closeEdit}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          {recipe.cuisine ? (
            <p className="recipe__cuisine">{recipe.cuisine}</p>
          ) : null}

          {/* photo_url is optional and nullable, so the absent case is a state
              this page draws rather than an <img> with nothing to load -- which
              renders as a broken-image glyph in every browser. It is also a
              presigned link that expires an hour after the API minted it, which
              is why it is read straight off the loader's answer each time and
              never kept anywhere.

              alt="" because the name is above it: a photograph of the dish adds
              nothing a screen reader has not already been given. */}
          {recipe.photo_url ? (
            <img className="recipe__photo" src={recipe.photo_url} alt="" />
          ) : (
            <div className="recipe__photo recipe__photo--none" />
          )}

          <p className="recipe__servings">
            Makes {recipe.servings}{" "}
            {recipe.servings === 1 ? "serving" : "servings"}
          </p>

          {/* The four figures the API sent, rendered and not worked out. Kete
              computes no nutrition figure anywhere in the browser -- there is
              one implementation of the arithmetic and it is the API's -- and
              this page does not divide, total or convert any of them. */}
          <section className="recipe__nutrition">
            <h2 className="recipe__heading">Nutrition per serving</h2>

            {/* The sentence doc/design/product.md §5 puts out of scope, said
                here as well as on the form. Somebody reading four figures under
                a heading like this one will otherwise assume Kete worked them
                out from the ingredients, and every weekly comparison drawn from
                them is only as good as what was typed in. */}
            <p className="recipe__note">
              As you entered them. Kete does not work these out from your
              ingredients.
            </p>

            <dl className="recipe__figures">
              {figures.map(([name, value]) => (
                <div className="recipe__figure" key={name}>
                  <dt className="recipe__figure-name">{name}</dt>
                  <dd className="recipe__figure-value">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Both are free text the person typed, stored as one string each, so
              they are drawn as one block with the line breaks kept by CSS
              rather than split into list items here. Splitting would invent a
              structure the contract does not carry, and a method written as one
              paragraph would come back as a single numbered step.

              `steps` is the API's name for what a cook calls the method. The
              heading takes the human word and the field keeps the contract's,
              which is what RecipeForm does with the same pair. */}
          <section className="recipe__prose">
            <h2 className="recipe__heading">Ingredients</h2>
            <p className="recipe__text">{recipe.ingredients}</p>
          </section>

          <section className="recipe__prose">
            <h2 className="recipe__heading">Method</h2>
            <p className="recipe__text">{recipe.steps}</p>
          </section>

          {/* A link rather than a button, so the edit view has an address that
              can be refreshed, bookmarked and reached by Back -- which is the
              whole reason ADR 002 puts the switch in the query string.

              A search with no path in front of it, which react-router resolves
              against the address this page is already at. The first version
              rebuilt that address from PATHS.recipe and useParams, which is
              three lines to say what the router already knows -- and PATHS
              .recipe is the pattern /recipes/:id, so every one of those lines
              existed only to put the id back into it. */}
          <Link className="recipe__edit" to={`?${QUERY.recipe_edit}`}>
            Edit this recipe
          </Link>
        </>
      )}
    </div>
  );
}
