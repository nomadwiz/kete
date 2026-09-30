import type { components } from "./api";

// What GET /recipes answers an array of. A single recipe is RecipeDetail, and
// writing one is RecipeIn, which serves both POST /recipes and PUT
// /recipes/{recipe_id} -- there is no create/update pair to look for.
export type RecipeSummary = components["schemas"]["RecipeSummary"];

// What a write sends. There is no partial update, so an edit sends all nine
// fields back rather than only the ones that changed.
//
// All nine are `required` in the schema, which says the key must be present
// rather than that the value must be interesting. `name` is the only one
// carrying `minLength: 1`; `cuisine`, `ingredients` and `steps` all admit "".
// The form mirrors that distinction rather than the word "required".
export type RecipeIn = components["schemas"]["RecipeIn"];

// What POST /recipes answers: the new recipe's id and nothing else. The create
// action needs it to upload a photograph chosen in the same form.
export type RecipeCreatedOut = components["schemas"]["RecipeCreatedOut"];

// What GET /recipes/{recipe_id} answers, and what PUT answers back. It is
// RecipeIn plus recipe_id and photo_url, so it prefills the form without a
// conversion -- but photo_url is optional as well as nullable, and the form
// neither reads nor writes it: the photograph is uploaded on its own endpoint,
// from a file input when creating and from its own control when editing.
export type RecipeDetail = components["schemas"]["RecipeDetail"];
