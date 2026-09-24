import { useLoaderData } from "react-router";

import type { RecipeSummary } from "../types/recipe";

export default function Recipes() {
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
