import type { components } from "./api";
import type { RecipeSummary } from "./recipe";
import type { Targets } from "./targets";

// One filled position in a week, as GET /mealplan?week= answers an array of.
// Two traps. It carries no `week` field coming back -- the week is what was
// asked for, not what was answered -- so a slot on its own cannot say which
// week it belongs to. And its `recipe` is PlanRecipe and not RecipeSummary:
// four nutrition figures and no photo, no cuisine, no servings.
export type PlanSlot = components["schemas"]["PlanSlotOut"];

// The recipe inside a slot. The four figures are here because B2
// (nomadwiz/kete#151) put them here to stop a per-slot fan-out of queries, not
// so that the client can add them up -- implementation.md section 1: "the
// client never computes a nutrition figure". Totals against targets are C18
// (nomadwiz/kete#182), from a server endpoint.
export type PlanRecipe = components["schemas"]["PlanRecipe"];

// The two axes of the grid, taken from the schema rather than written out, so
// a value the API stops accepting stops type-checking here.
export type DayOfWeek = PlanSlot["day_of_week"];
export type MealPosition = PlanSlot["meal_position"];

// The body POST /mealplan takes. All four fields are required, including the
// week -- which is the one field the answer does not carry back.
export type PlanSlotIn = components["schemas"]["PlanSlotIn"];

// What the /planner loader hands the screen: the week it settled on, that
// week's filled positions, and the library a recipe is placed from. The week
// is in it because the slots cannot say what it is and the address may not
// have named one.
export type PlanWeek = {
  week: string;
  slots: PlanSlot[];
  recipes: RecipeSummary[];
  summary: WeekSummary | null;
};

// What GET /mealplan/summary?week= answers: seven days, Mon to Sun, each with
// the four nutrients as total, target, difference and percent -- all four
// computed by the server (ADR 001) and rounded there (ADR 007), so the screen
// prints them as sent. Null on the screen is the 404 that means no targets yet.
export type WeekSummary = components["schemas"]["WeekSummaryOut"];

// The body POST /mealplan/generate takes. One field, and it is the week --
// which the screen already holds, so the action never recomputes it. There is
// no alias for the 201's GenerateOut: it carries `created`, which is always 21
// because the endpoint fills every position, and the action discards it the
// way it discards the slot_id a placement answers with.
export type GenerateIn = components["schemas"]["GenerateIn"];

// What the /dashboard loader hands the screen: the daily target, and the
// current week against it. Both are null until measurements are saved -- the
// two endpoints answer 404 on the same condition (ADR 001, ADR 004).
export type Dashboard = {
  targets: Targets | null;
  summary: WeekSummary | null;
};
