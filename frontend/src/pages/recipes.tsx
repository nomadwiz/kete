import { useEffect, useRef } from "react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";

import RecipeForm from "../components/recipe-form";
import { PATHS, QUERY } from "../routes";
import type { RecipeSummary } from "../types/recipe";
import "./recipes.css";

export default function Recipes() {
  const recipes = useLoaderData() as RecipeSummary[];
  const [searchParams, setSearchParams] = useSearchParams();

  // Both pieces of view state come out of the address rather than out of this
  // component, which is ADR 002's rule and its stated test: a person who
  // refreshes the page mid-way through writing a recipe, or after searching
  // for one, would be surprised to lose either. Held in useState they would
  // both go.
  const term = searchParams.get(QUERY.recipe_search) ?? "";
  const creating = searchParams.has(QUERY.new_recipe);

  // What the last submission answered. A string is a refusal the action chose
  // to return rather than throw, so it is shown inside the modal above what
  // the person typed; a thrown failure never arrives here at all.
  const error = useActionData() as string | undefined;
  const navigation = useNavigation();

  // Both halves matter, and this screen is the one that needs both. The path
  // is compared without its query string because useFormAction copies the
  // current search into a Form declaring no action, so under this modal the
  // whole formAction reads /recipes?new and an equality against PATHS.recipes
  // would be false for the entire submission. The method is compared because
  // this page carries two Forms: the search below is a GET and also sets
  // formAction, which would otherwise put the modal into a saving state while
  // somebody searched. C25 (nomadwiz/kete#277) is lifting the first half out
  // across the screens that get it wrong; take its helper over this.
  const saving =
    navigation.formMethod === "POST" &&
    navigation.formAction?.split("?")[0] === PATHS.recipes;

  // The address that opens the modal, built in the component body rather than
  // at module scope: routes.tsx imports this page through the pages barrel and
  // this page imports PATHS back, so the two modules are circular and PATHS is
  // still undefined while this module evaluates. dashboard.tsx records the
  // same trap. The current search is carried across, so opening the form does
  // not silently drop what the person was looking for.
  const openTo = term
    ? `${PATHS.recipes}?${QUERY.recipe_search}=${encodeURIComponent(term)}&${QUERY.new_recipe}`
    : `${PATHS.recipes}?${QUERY.new_recipe}`;

  const dialog = useRef<HTMLDialogElement>(null);

  // showModal() rather than the `open` attribute, and this is the whole reason
  // the effect exists. A <dialog> rendered with `open` is an ordinary block:
  // no top layer, no backdrop, no focus trap and no Escape. Only showModal()
  // gives those, and it is a method rather than a prop, so something has to
  // call it. The alternative is a div pretending to be a dialog, which means
  // writing all four of those by hand and getting one of them wrong.
  //
  // The address stays the source of truth: this effect follows it, and every
  // way of closing puts the address back rather than touching the element.
  useEffect(() => {
    const element = dialog.current;

    if (!element) {
      return;
    }

    if (creating && !element.open) {
      element.showModal();
    }

    if (!creating && element.open) {
      element.close();
    }
  }, [creating]);

  // Escape and the Cancel button close through one path, because <dialog>
  // fires `close` for both and the element is shut by the time this runs. All
  // it has left to do is drop the key that would reopen it, and the guard is
  // what stops the other direction looping: Back and a saved recipe both
  // close the dialog by changing the address first, and the `close` they
  // provoke then finds no key to delete.
  //
  // Replacing rather than pushing. Opening the modal is a link, so that entry
  // is already in the history and Back from the open modal still closes it --
  // the effect above sees the key go. Pushing here would put a second entry
  // on top of it, and Back would reopen the form somebody had just dismissed.
  function closeModal() {
    if (!searchParams.has(QUERY.new_recipe)) {
      return;
    }

    setSearchParams(
      (previous) => {
        previous.delete(QUERY.new_recipe);

        return previous;
      },
      { replace: true },
    );
  }

  return (
    <div className="recipes">
      <h1 className="recipes__title">Recipes</h1>

      <p className="recipes__lede">
        Everything you have written down. Each one carries the figures for a
        single serving, which is what your week is compared against.
      </p>

      <div className="recipes__bar">
        {/* A GET Form, so searching is a navigation and the loader answers it.
            The browser puts the field in the query string itself and the
            address that results is the one to bookmark, share or refresh --
            none of which a search held in component state survives.

            The field is uncontrolled, and `key` is what keeps it honest. An
            input somebody has typed into ignores a later change to its
            defaultValue, so a term reached by pressing Back would leave the
            box reading the search before it -- and pressing Search again
            would then silently undo the Back. Keying on the term remounts the
            input when the address changes, which is the one thing that
            reapplies a default. */}
        <Form className="recipes__search" role="search">
          <label className="recipes__search-label" htmlFor="recipe-search">
            Search your recipes
          </label>
          <div className="recipes__search-controls">
            <input
              key={term}
              id="recipe-search"
              name={QUERY.recipe_search}
              type="search"
              defaultValue={term}
              placeholder="Name or cuisine"
            />
            <button className="recipes__search-submit" type="submit">
              Search
            </button>
          </div>
        </Form>

        <Link className="recipes__add" to={openTo}>
          Write a recipe
        </Link>
      </div>

      {recipes.length === 0 ? (
        <p className="recipes__empty">
          {term ? (
            <>
              Nothing matches “{term}”.{" "}
              <Link className="recipes__empty-link" to={PATHS.recipes}>
                Show every recipe
              </Link>
            </>
          ) : (
            <>
              You have not written a recipe yet.{" "}
              <Link className="recipes__empty-link" to={openTo}>
                Write your first one
              </Link>
            </>
          )}
        </p>
      ) : (
        <ul className="recipes__list">
          {recipes.map((recipe) => (
            <li className="recipes__card" key={recipe.recipe_id}>
              {/* photo_url is optional and nullable, so the absent case is a
                  state this card draws rather than an <img> with nothing to
                  load. It is also a presigned link that expires an hour after
                  the API minted it, which is why it is read straight off the
                  loader's answer each time and never kept anywhere.

                  alt="" because the name is beside it: a photograph of the
                  dish adds nothing a screen reader has not already been
                  given, and describing it twice is noise. */}
              {recipe.photo_url ? (
                <img
                  className="recipes__photo"
                  src={recipe.photo_url}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div className="recipes__photo recipes__photo--none" />
              )}

              <div className="recipes__card-text">
                <h2 className="recipes__name">{recipe.name}</h2>
                <p className="recipes__meta">
                  {recipe.cuisine ? `${recipe.cuisine} · ` : ""}
                  {recipe.energy_kcal.toLocaleString("en-NZ")} kcal a serving
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* onCancel is Escape, which fires before `close` and can be refused.
          A save in flight is the one time it is: the POST may already have
          reached the API, and closing would abort it client-side and throw
          away both the nine typed fields and any refusal coming back, leaving
          a person who cannot tell whether the recipe was written. Every other
          time Escape closes, which is half of why this is a <dialog>.

          aria-labelledby names a heading that exists only while the modal is
          open, so the attribute goes with it rather than dangling. */}
      <dialog
        className="recipes__modal"
        ref={dialog}
        onCancel={(event) => {
          if (saving) {
            event.preventDefault();
          }
        }}
        onClose={closeModal}
        aria-labelledby={creating ? "recipe-modal-title" : undefined}
      >
        {/* Mounted only while the address says so, which is what empties the
            fields between one recipe and the next. RecipeForm's nine controls
            are uncontrolled and read their defaults at mount, so a form left
            mounted behind a closed dialog would open again still holding the
            recipe just saved. The same fact is what makes a refusal behave:
            during a 422 the address still carries `new`, so the form is not
            remounted and what the person typed is still in it. */}
        {creating ? (
          <>
            <h2 className="recipes__modal-title" id="recipe-modal-title">
              Write a recipe
            </h2>

            {/* No `recipe` prop: this host only ever creates. The form posts
                to the route it is rendered under, which is this one, so the
                write is recipesAction's and this page passes it neither a
                path nor a handler. */}
            <RecipeForm error={error} busy={saving} />

            {/* close() rather than a link, so this control and Escape both
                arrive at the `close` event and the address is put back in one
                place. type="button" because it sits inside no form and must
                submit nothing, and disabled while a save is running for the
                reason the dialog refuses Escape then: close() is not
                cancelable, so the only way to refuse this one is not to offer
                it. */}
            <button
              className="recipes__modal-close"
              type="button"
              disabled={saving}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
