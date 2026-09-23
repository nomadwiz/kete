import { useLoaderData } from "react-router";

import type { RecipeSummary } from "../types/recipe";

export default function Recipes() {
  // Already resolved: the route's loader ran before this component rendered,
  // and anything it threw went to the error boundary. No fetch, no loading
  // flag, no try/catch. C11 (#176) owns this page's list and its search.
  const recipes = useLoaderData() as RecipeSummary[];

  return (
    <main>
      <h1>Recipes</h1>
      {recipes.length === 0 ? (
        <p>No recipes yet.</p>
      ) : (
        <ul>
          {recipes.map((recipe) => (
            <li key={recipe.recipe_id}>
              {recipe.name} — {recipe.cuisine}, {recipe.energy_kcal} kcal
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
