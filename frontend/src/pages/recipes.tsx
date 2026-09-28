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

  // The path without its query string, twice over. A <Form> declaring no
  // action prop does not submit to the bare path: useFormAction copies the
  // current search into it, and this modal is addressed /recipes?new, so an
  // equality against PATHS.recipes would be false for the whole submission and
  // the Save button would never disable. The method half matters too -- the
  // search below is a Form as well, and a GET submission also sets formAction,
  // which would otherwise put the modal into a saving state while somebody
  // searched. C25 (nomadwiz/kete#277) is lifting the first half of this out
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
  // it has left to do is drop the key that would reopen it. No `replace`: a
  // person who opened the modal by navigating to ?new expects Back to close
  // it, which is the other half of ADR 002's test.
  function closeModal() {
    if (!searchParams.has(QUERY.new_recipe)) {
      return;
    }

    setSearchParams((previous) => {
      previous.delete(QUERY.new_recipe);

      return previous;
    });
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

            defaultValue rather than value keeps the field uncontrolled. The
            component is not remounted when the search changes, so a term
            reached by pressing Back leaves the box showing the previous one
            until the page is reloaded; the list itself is right either way. */}
        <Form className="recipes__search" role="search">
          <label className="recipes__search-label" htmlFor="recipe-search">
            Search your recipes
          </label>
          <div className="recipes__search-controls">
            <input
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

      <dialog
        className="recipes__modal"
        ref={dialog}
        onClose={closeModal}
        aria-labelledby="recipe-modal-title"
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
                submit nothing. */}
            <button
              className="recipes__modal-close"
              type="button"
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
