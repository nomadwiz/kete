import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "react-router";

import RecipeForm from "../components/recipe-form";
import { Button } from "../components/ui/button";
import { buttonVariants } from "../components/ui/button-variants";
import { Field } from "../components/ui/field";
import { Figures } from "../components/ui/figures";
import { Notice } from "../components/ui/notice";
import { StatusRegion } from "../components/ui/status-region";
import { Screen } from "../components/ui/screen";
import { PATHS, QUERY } from "../routes";
// The component this file default-exports is also called RecipeDetail, and the
// clash is real rather than cosmetic: this is the first file to need both. The
// type is aliased at the import and neither declaration is renamed, which is
// what targets.tsx does with `Targets as TargetFigures`.
import type { RecipeDetail as Recipe } from "../types/recipe";
import { useWrite } from "../use-write";
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
  // It answers whether a POST to this route is in flight, which is true for
  // either of the two writes this route now takes -- the save and C15
  // (nomadwiz/kete#179)'s delete. Nothing here tells them apart, and nothing
  // needs to: the edit form replaces the read view rather than floating over
  // it, so the Save button and the Delete button are never on screen together
  // and neither can ever be looking at the other's submission. If the form is
  // ever drawn over the read view, that stops being true, and the control that
  // has to distinguish them reads the submitted intent off useNavigation's
  // formData rather than giving this hook a parameter -- the hook takes no
  // path or intent by design, and src/use-submitting.ts says why.
  //
  // `succeeded` covers the save only in practice, although the hook is true
  // for either write. A delete that works replaces the address with the
  // library, so this component is unmounted before it could announce
  // anything; and a save the API answers 404 for is thrown as a replace to
  // this same address, whose loader then answers null and draws the not-found
  // panel above -- which returns before the confirmation below is reached. So
  // the sentence is rendered only where it is true.
  const { busy: saving, succeeded } = useWrite("POST");

  // Dropping the key is the whole of closing the edit view, because the form is
  // drawn exactly while the key is there. Replacing rather than pushing:
  // opening it is a link, so that entry is already in the history and Back from
  // the open form closes it -- pushing here would put a second entry on top and
  // Back would reopen a form somebody had just dismissed.
  function closeEdit() {
    setSearchParams(
      (previous) => {
        previous.delete(QUERY.recipe_edit);
        previous.delete(QUERY.photo_unsaved);

        return previous;
      },
      { replace: true },
    );
  }

  if (!recipe) {
    return (
      // The same Screen as every other state of this route, so a recipe that
      // is gone lands on the page's own shape rather than on bare markup at
      // the top of the viewport.
      <Screen
        title="No such recipe"
        lede="Nothing in your library is at this address."
      >
        {/* Not the contract's own sentence, and recipeLoader in routes.tsx
            says why. Deletion is named instead, because it is the case a
            person actually arrives from -- a recipe removed in another tab,
            or a save of one that has gone. */}
        <p className="recipe__missing border-t border-rule pt-4">
          It may have been deleted.{" "}
          <Link className="recipe__missing-link" to={PATHS.recipes}>
            Back to your recipes
          </Link>
        </p>
      </Screen>
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

  // The only place in the client the cascade is ever stated. backend/schema.sql
  // declares plan_slots.recipe_id REFERENCES recipes ON DELETE CASCADE, so
  // deleting a recipe empties every position holding it -- in this week and in
  // any other -- and a generic "Are you sure?" would let somebody discard a
  // planned week without knowing they had.
  //
  // window.confirm rather than a <dialog>, which is C17 (nomadwiz/kete#181)'s
  // choice on the planner for the same kind of control. Its reasoning and its
  // ceiling are argued in full in planner.tsx where the choice is made, and
  // one of them is this project's: jsdom 30 implements no showModal, so a
  // <dialog> here would be exercised against the shim in src/test/setup.ts
  // rather than against the element.
  //
  // No count, and none is available: this screen reads one recipe, and
  // [GAP: nothing in backend/openapi.json answers how many plan slots point at
  // a recipe]. Fetching a week to count them would be a second read for a
  // number that would still be wrong for every other week, so the sentence is
  // written to be true without one.
  const emptiesEveryPositionUsingIt = `Delete ${recipe.name}?\n\nThe recipe goes from your library, and every position in every week that is holding it is emptied too. There is no undo.`;

  return (
    // The record's own name, not what is currently typed into the form: a save
    // the API refused leaves the heading naming the recipe as it is still
    // stored.
    <Screen
      above={
        <Link className="recipe__back-link" to={PATHS.recipes}>
          Your recipes
        </Link>
      }
      title={recipe.name}
      lede={recipe.cuisine || undefined}
    >
      <div className="recipe">
        {/* Above the edit-or-read choice, not inside the read branch: a save
          drops `?edit`, so a region inside that branch would be mounted by the
          very render that fills it, which is the defect C28 (nomadwiz/kete#285)
          exists to remove. It says nothing while the edit form is showing,
          because the sentence is a claim about the record the read view draws. */}
        <StatusRegion>
          {!editing && succeeded ? "Your changes are saved." : null}
        </StatusRegion>

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

            <Photograph
              src={recipe.photo_url}
              unsaved={searchParams.has(QUERY.photo_unsaved)}
            />

            {/* A button rather than a link back to the read address, because it
              has to be refusable: a navigation away during a save abandons a
              PUT that may already have reached the API, throwing away both the
              nine typed fields and any refusal coming back, and leaving a
              person who cannot tell whether the recipe was saved. `disabled` is
              how a button refuses; a link has no equivalent. */}
            <Button
              className="recipe__cancel"
              type="button"
              size="sm"
              disabled={saving}
              onClick={closeEdit}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
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

              <Figures
                className="mt-3"
                rows={figures.map(([label, value]) => ({ label, value }))}
              />
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
            {/* Not refused while a delete runs, although Cancel is refused
              while a save runs: opening the form costs nothing typed, and a
              save made from it is answered 404, which lands on the not-found
              panel saying the recipe may have been deleted. */}
            <Link
              className={buttonVariants({ size: "sm" })}
              to={`?${QUERY.recipe_edit}`}
            >
              Edit this recipe
            </Link>

            {/* On this page and not on the list, because a delete offered from
              /recipes would post to this route and so need an `action` prop
              carrying a literal path, which ADR 002 keeps out of everything
              but routes.tsx. For the same rule this Form declares no `action`
              and posts to the address the page is at; the hidden field selects
              the branch, RecipeForm declaring none being what makes a
              submission carrying no intent the save. */}
            <Form
              method="post"
              aria-busy={saving}
              onSubmit={(event) => {
                // react-router's Form runs this handler and then returns on a
                // prevented default, so a declined confirmation sends no
                // request at all rather than one whose answer is thrown away.
                if (!window.confirm(emptiesEveryPositionUsingIt)) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="delete" />

              {/* Dead while the delete is in flight, and named for it. A second
                click sends a second DELETE, which the API answers 404 -- read
                here as the success it is, so nothing would look wrong, but it
                is still a request nobody meant to make. */}
              {/* One of the two controls in the client that destroy something,
                and so call --kokowai; the other is the submit on
                /account/delete. Colour is not what says so: the confirmation
                above names the cascade in words, and this button is told from
                a secondary one by being filled rather than by its hue -- the
                two measure 1.08:1 against each other. */}
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={saving}
              >
                {saving ? "Deleting…" : "Delete this recipe"}
              </Button>
            </Form>
          </>
        )}
      </div>
    </Screen>
  );
}

// C14 (nomadwiz/kete#184). A form of its own beside RecipeForm, never inside
// it -- a form nested in a form is invalid HTML -- and posted through a fetcher
// rather than as a navigation. Save and Delete read the navigation, so a
// fetcher leaves them alone while a photograph uploads, and its answer lands
// in fetcher.data rather than in the useActionData RecipeForm prints. useWrite
// is handed the fetcher, so the success rule and the focus after the write are
// ADR 005's like every other form's. Mounted with the edit view, so its last
// answer goes when that closes.
//
// Progress is a <progress> with no value, which every browser draws and
// announces as indeterminate. A percentage needs XMLHttpRequest's upload
// events, which fetch does not have, and a second request path beside
// request() would lose the traversal check and the 401 rule that path carries.
//
// `unsaved` is recipesAction's partial failure arriving: the recipe was
// created and the photograph chosen with it was not stored. The sentence is
// drawn only while the recipe really has no photograph, because the key stays
// in the address after a retry that worked -- removing it would replace the
// location, and useWrite ties `succeeded` to the location, so "Photograph
// saved." would vanish as it appeared. The loader answers `src` afresh after
// every upload, so the sentence is true on every render, a reload included.
// It also gives way to this control's own answer once a retry has one.
function Photograph({
  src,
  unsaved,
}: {
  src?: string | null;
  unsaved: boolean;
}) {
  const photo = useFetcher<string | null>();
  const { busy: uploading, succeeded } = useWrite("POST", photo);

  return (
    <photo.Form
      className="recipe__upload"
      method="post"
      encType="multipart/form-data"
      aria-busy={uploading}
    >
      {/* Straight off the loader, as the read view takes it: a presigned link
          that expires an hour after the API minted it, so nothing keeps it. */}
      {src ? <img className="recipe__photo" src={src} alt="" /> : null}

      <input type="hidden" name="intent" value="photo" />

      <Field htmlFor="recipe-photo" label="Photograph">
        <input
          aria-describedby="recipe-photo-note"
          id="recipe-photo"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </Field>

      <p className="recipe__note" id="recipe-photo-note">
        JPEG, PNG or WebP, up to 5 MB. It replaces the current photograph.
      </p>

      {unsaved && !src && photo.data === undefined ? (
        <Notice tone="refusal" role="alert">
          Your recipe is saved, but its photograph could not be stored. Choose
          it again here.
        </Notice>
      ) : null}

      {typeof photo.data === "string" ? (
        <Notice tone="refusal" role="alert">
          {photo.data}
        </Notice>
      ) : null}

      <StatusRegion>{succeeded ? "Photograph saved." : null}</StatusRegion>

      {uploading ? <progress aria-label="Uploading photograph" /> : null}

      <Button type="submit" size="sm" disabled={uploading}>
        {uploading ? "Uploading…" : "Upload photograph"}
      </Button>
    </photo.Form>
  );
}
