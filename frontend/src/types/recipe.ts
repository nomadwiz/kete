import type { components } from "./api";

// What GET /recipes answers an array of. A single recipe is RecipeDetail, and
// writing one is RecipeIn, which serves both POST /recipes and PUT
// /recipes/{recipe_id} -- there is no create/update pair to look for.
export type RecipeSummary = components["schemas"]["RecipeSummary"];
