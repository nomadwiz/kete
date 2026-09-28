import type { components } from "./api";

// What GET /recipes answers an array of. GET /recipes/{recipe_id} answers
// RecipeDetail, which adds the ingredients, steps, servings and the three
// macronutrient figures; writing one is RecipeIn, which serves both POST
// /recipes and PUT /recipes/{recipe_id}. Alias either here when a screen needs
// it -- there is no create/update pair to look for.
export type RecipeSummary = components["schemas"]["RecipeSummary"];
