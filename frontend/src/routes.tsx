import {
  redirect,
  replace,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { ApiError, SessionExpired } from "./api/errors";
import { request } from "./api/http";
import { authed } from "./api/session";
import { clearToken, readToken, writeToken } from "./api/token";
import { isoWeek, isWeek } from "./api/week";
import AppLayout from "./components/app-layout";
import ErrorBoundary from "./components/error-boundary";
import PublicLayout from "./components/public-layout";
import {
  ACCOUNT,
  DASHBOARD,
  HOME,
  MEASUREMENT,
  NOT_FOUND,
  PLANNER,
  RECIPE_DETAIL,
  RECIPES,
  SIGN_IN,
  SIGN_UP,
  TARGETS,
} from "./pages";
import type {
  Register,
  RegisterResult,
  SignIn,
  SignInResult,
} from "./types/auth";
import type { ActivityLevel, Metrics, Sex } from "./types/measurement";
import type {
  DayOfWeek,
  GenerateIn,
  MealPosition,
  PlanSlot,
  PlanSlotIn,
  PlanWeek,
} from "./types/plan";
import type { Profile } from "./types/profile";
import type { RecipeDetail, RecipeIn, RecipeSummary } from "./types/recipe";
import type { Targets } from "./types/targets";

const PATHS = {
  home: "/",
  sign_up: "/sign-up",
  sign_in: "/sign-in",
  sign_out: "/sign-out",
  measurements: "/measurements",
  targets: "/targets",
  dashboard: "/dashboard",
  recipes: "/recipes",
  recipe: "/recipes/:id",
  planner: "/planner",
  account: "/account",
  not_found: "*",
} as const;

const QUERY = {
  account_created: "created",
  // The two keys /recipes is addressed by. ADR 002 puts both in the query
  // string on one test -- whether a user refreshing the page would be
  // surprised to lose what it holds -- and a half-filled creation form and a
  // search someone has just typed both fail it. They are named here beside the
  // paths for the reason the paths themselves are: the page reads them, the
  // loader reads one and the action deletes the other, and three spellings of
  // "new" is three chances to disagree.
  new_recipe: "new",
  recipe_search: "q",

  // The key /recipes/:id is edited at. ADR 002 puts the view-to-edit switch in
  // the query string on the same test the two keys above pass: a person who
  // has retyped half a method and then refreshes would be surprised to lose
  // it. It is a bare key with no value, as `new` is -- its presence is the
  // whole message, and `?edit=1` would be a second spelling of the same thing.
  recipe_edit: "edit",

  // Which week the planner is showing. ADR 002 puts view state a refresh
  // should survive in the address, and a person who steps to next week and
  // then reloads is looking at next week.
  week: "week",
} as const;

function requireSession() {
  if (!readToken()) {
    clearToken();

    throw redirect(PATHS.sign_in);
  }

  return null;
}

// Every loader and action that reaches the API runs its work through this, so
// an expired token sends the user to sign in rather than to the error boundary
// without each of them repeating the rule. The redirect lives here rather than
// in src/api/ because ADR 002 keeps every path string in this file. A caller
// whose own rule reads a status keeps it in its own catch inside the work:
// SessionExpired extends Error and not ApiError, so a clause there testing
// ApiError cannot swallow it.
async function withSession<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SessionExpired) {
      throw redirect(PATHS.sign_in);
    }

    throw error;
  }
}

// The signed-in user's account details, and no rule of its own for any
// status. GET /profile declares 401 and 404: the 401 is withSession's, and the
// 404 means the account behind a token that still parses no longer exists,
// which is a failure and belongs to the error boundary -- unlike the 404s the
// two loaders below catch, which mean a form has not been filled in yet.
function profileLoader(): Promise<Profile> {
  return withSession(() => authed<Profile>("/profile"));
}

// PUT /profile is a full replace and takes no partial update, so all four
// fields travel whether or not they changed.
async function profileAction({ request: req }: ActionFunctionArgs) {
  const form = await req.formData();
  const details: Profile = {
    first_name: String(form.get("first_name") ?? ""),
    last_name: String(form.get("last_name") ?? ""),
    username: String(form.get("username") ?? ""),
    email: String(form.get("email") ?? ""),
  };

  return withSession(async () => {
    try {
      // The reply is the saved account and is discarded, as
      // measurementsAction discards the targets its save computed: the loader
      // revalidates after this returns, so the screen reads the account in
      // one place rather than two that can disagree.
      await authed<unknown>("/profile", {
        method: "PUT",
        body: JSON.stringify(details),
      });
    } catch (error) {
      // Two of the four statuses PUT /profile declares, and only those two.
      // A 409 means the username or email is already somebody else's and a
      // 422 that a field is malformed: both are answered by typing something
      // different, so the message goes back to the form the person is still
      // standing in with what they typed, which the boundary would take the
      // page and the typed values with it.
      //
      // The 404 is not among them. It means the account behind the token no
      // longer exists, which profileLoader sends to the boundary -- returning
      // it here would print "the account no longer exists" as though it were
      // a validation message and invite another Save that cannot work.
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 422)
      ) {
        return error.message;
      }

      throw error;
    }

    // Null rather than a redirect: the person stays where they are, and
    // account.tsx reads null as the save that worked, since React Router
    // answers undefined until an action has run.
    return null;
  });
}

// The search is the API's, not the page's. GET /recipes takes an optional `q`
// and answers what matches, so the client passes the term through and renders
// the answer -- filtering a fetched array here would search only the page the
// user already has, and would quietly stop agreeing with the API the moment
// the endpoint's matching rule changed.
//
// No rule of its own for any status. GET /recipes declares 401, which is
// withSession's, and 422, which means the query string itself was refused --
// nothing the person can act on from this screen, so it belongs to the error
// boundary.
function recipesLoader({
  request: req,
}: LoaderFunctionArgs): Promise<RecipeSummary[]> {
  const term = new URL(req.url).searchParams.get(QUERY.recipe_search) ?? "";
  const path = term
    ? `/recipes?${QUERY.recipe_search}=${encodeURIComponent(term)}`
    : "/recipes";

  return withSession(() => authed<RecipeSummary[]>(path));
}

// The write behind the creation modal on /recipes. RecipeIn declares all nine
// fields required and there is no partial create, so all nine are sent.
async function recipesAction({ request: req }: ActionFunctionArgs) {
  const form = await req.formData();
  const recipe: RecipeIn = {
    name: String(form.get("name") ?? ""),
    cuisine: String(form.get("cuisine") ?? ""),
    ingredients: String(form.get("ingredients") ?? ""),
    steps: String(form.get("steps") ?? ""),
    servings: Number(form.get("servings")),
    energy_kcal: Number(form.get("energy_kcal")),
    protein_g: Number(form.get("protein_g")),
    carbs_g: Number(form.get("carbs_g")),
    fat_g: Number(form.get("fat_g")),
  };

  return withSession(async () => {
    try {
      // The reply is RecipeCreatedOut -- a recipe id and nothing else -- so
      // there is no record here to render even if this screen wanted one. The
      // loader revalidates once this returns, and the new row arrives from the
      // same place every other row on the page came from.
      await authed<unknown>("/recipes", {
        method: "POST",
        body: JSON.stringify(recipe),
      });
    } catch (error) {
      // 422 and nothing else, because 422 is the only failure POST /recipes
      // declares besides the 401 withSession already owns -- backend
      // openapi.json calls it "Validation Error", which is answered by typing
      // something different. The test is what the contract says the status
      // means on this route, not the number: the same 404 that is a state on
      // GET /profile/metrics is a failure on POST /profile/metrics. Anything
      // undeclared reaching here is not a thing the form can repair, so it
      // goes to the error boundary rather than being printed above a Save
      // button that cannot work.
      if (error instanceof ApiError && error.status === 422) {
        return error.message;
      }

      throw error;
    }

    // The whole list, not the search that was running. The modal is open
    // exactly while `new` is in the address, so dropping the query string
    // closes it -- and dropping `q` with it is what makes the recipe just
    // written visible. Carrying the search over was the first version and it
    // lies: someone who searched for a laksa, found none and then wrote a dal
    // would be returned to "Nothing matches laksa" with nothing on the screen
    // saying the save had worked, which reads exactly like a save that did
    // nothing. The new row appearing in the list is the confirmation.
    //
    // replace rather than redirect, so Back from the list goes wherever the
    // person came from rather than to ?new, which would reopen an empty form
    // one click from writing the same recipe twice.
    return replace(PATHS.recipes);
  });
}

// The one recipe the address names, for both the read view and the edit form
// drawn over the same record. GET /recipes/{recipe_id} declares 401, 404 and
// 422.
//
// Null is the 404, and it is not the null targetsLoader answers. There the
// status means a form has not been filled in yet; here backend/openapi.json
// says "No such recipe, or it belongs to another account", which means the
// address names nothing this account may read. That is still not a failure of
// the system, and it is not what the error boundary says: "Something went
// wrong" is false for a recipe deleted in another tab, and the boundary offers
// no way onward from an address that will never answer. So the loader answers
// null and recipe.tsx draws a not-found panel that links back to the library,
// which is the one thing the person can do about it. The contract's own
// sentence is not shown -- "or it belongs to another account" invites a reader
// to wonder whose, and the endpoint answers 404 rather than 403 precisely so
// that it does not confirm someone else's record exists.
//
// An id that is not a whole number is answered the same way without a request.
// The API would refuse /recipes/NaN with a 422 about the path parameter, which
// is a sentence about the address rather than about the recipe, and this screen
// already owns the right answer for an address that names nothing. The test is
// the raw segment and not Number(): "3.5", " 3", "0x10" and "1e3" all survive
// Number() and none of them is a recipe id.
function recipeLoader({
  params,
}: LoaderFunctionArgs): Promise<RecipeDetail | null> {
  if (!/^\d+$/.test(params.id ?? "")) {
    return Promise.resolve(null);
  }

  return withSession(async () => {
    try {
      return await authed<RecipeDetail>(`/recipes/${params.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }

      throw error;
    }
  });
}

// One action for the whole screen, branching on a submitted intent rather than
// giving each verb a route of its own -- ADR 002, and the shape plannerAction
// uses. A submission carrying no intent is the save, which is the convention
// C13 (nomadwiz/kete#178) set when it left RecipeForm with no intent field:
// the delete C15 (nomadwiz/kete#179) adds is its own Form carrying
// `intent=delete`, so its branch slots in beside this one and each branch owns
// its own destination -- a save lands back on the record, a delete cannot.
//
// PUT /recipes/{recipe_id} is a full replace and takes no partial update, so
// all nine RecipeIn fields travel whether or not they changed. The same nine
// are assembled in recipesAction above; the house rule extracts on the third
// repetition and there is no third -- a delete sends no body.
async function recipeAction({ params, request: req }: ActionFunctionArgs) {
  const form = await req.formData();
  const intent = String(form.get("intent") ?? "");

  return withSession(async () => {
    try {
      if (intent === "") {
        const recipe: RecipeIn = {
          name: String(form.get("name") ?? ""),
          cuisine: String(form.get("cuisine") ?? ""),
          ingredients: String(form.get("ingredients") ?? ""),
          steps: String(form.get("steps") ?? ""),
          servings: Number(form.get("servings")),
          energy_kcal: Number(form.get("energy_kcal")),
          protein_g: Number(form.get("protein_g")),
          carbs_g: Number(form.get("carbs_g")),
          fat_g: Number(form.get("fat_g")),
        };

        // The reply is the saved RecipeDetail and is discarded, as every other
        // write here discards its reply: the loader revalidates once this
        // returns, so the screen reads the record in one place rather than two
        // that can disagree.
        await authed<unknown>(`/recipes/${params.id}`, {
          method: "PUT",
          body: JSON.stringify(recipe),
        });
      } else {
        // Not a shrug. A submission from this screen carries either no intent
        // or one this branch knows, so an unrecognised one is a typo in a
        // hidden field -- which, returned as null, is indistinguishable from
        // the save that worked: the loader revalidates and the record redraws
        // unchanged.
        throw new Error(`Unknown recipe intent: ${intent}`);
      }
    } catch (error) {
      // 422 and nothing else, and the rule is what the contract says the
      // status means on this route rather than the number -- C26
      // (nomadwiz/kete#279), as corrected. PUT /recipes/{recipe_id} declares
      // 401, 404 and 422. The 401 is withSession's.
      //
      // The 404 is the interesting one, and it is not the planner's. There a
      // 404 meant one stale row in a grid of twenty others, the revalidation
      // repaired the view, and the person could choose again -- so
      // plannerAction returns it. Here it means the record being edited no
      // longer exists, and returning it would print the server's sentence into
      // a form that is about to be unmounted: the revalidation that follows
      // any returned string re-reads GET /recipes/{recipe_id}, which 404s in
      // turn, and the not-found panel replaces the page with the message and
      // the nine typed fields gone and nothing saying why. The boundary is the
      // honest surface for that, because the edit cannot be retried and there
      // is no form left to return to.
      //
      // A second intent is not a reason to make this the planner's
      // intent-keyed table. C15 (nomadwiz/kete#179) decides what DELETE's own
      // statuses mean on its own branch, and two rows is when a table starts
      // paying for itself.
      if (error instanceof ApiError && error.status === 422) {
        return error.message;
      }

      throw error;
    }

    // Back to the record just saved, which is what closes the edit view: the
    // form is drawn exactly while `edit` is in the address, so dropping the key
    // puts the read view back showing what the save wrote.
    //
    // replace rather than redirect, for the reason recipesAction gives: opening
    // the edit view is a link, so that entry is already in the history, and
    // pushing here would put Back one click from reopening a form over a record
    // that has just been saved.
    return replace(PATHS.recipe.replace(":id", String(params.id)));
  });
}

// Shared by /targets and /dashboard, which ask the same question of the same
// endpoint. One function rather than two copies, although this is only the
// second occurrence and the house rule extracts on the third: what is shared
// is the knowledge that a 404 here means no measurements saved, and ADR 004
// requires that rule live in one place.
//
// Null is a state and not a failure. GET /targets answers 404 until
// measurements have been saved, which ADR 001 records, so a screen renders its
// own empty panel for it rather than rethrowing. The error boundary now
// renders inside AppLayout, so a rethrow would no longer cost the navigation
// -- but it would still tell a user who has simply not filled the form in yet
// that something went wrong, which is the wrong answer whatever survives
// around it.
function targetsLoader(): Promise<Targets | null> {
  return withSession(async () => {
    try {
      return await authed<Targets>("/targets");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }

      throw error;
    }
  });
}

// The saved figures, so the form can offer them back rather than asking a
// returning user to remember what they last typed. GET /profile/metrics exists
// for that and for nothing else.
//
// Null is the same state targetsLoader answers for, at the other end of the
// same pair: this endpoint answers 404 until measurements have been saved, and
// backend/main.py declares that status as a state rather than a failure. So a
// first visit renders the empty form, which is the screen the person was sent
// here to fill in, rather than the error boundary telling them something went
// wrong.
function metricsLoader(): Promise<Metrics | null> {
  return withSession(async () => {
    try {
      return await authed<Metrics>("/profile/metrics");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }

      throw error;
    }
  });
}

// The week the address names, its filled positions, and the library a recipe
// is placed from. Two requests rather than one because the grid offers a
// choice of recipe in every empty position, and GET /mealplan answers only
// what is already placed. They go together rather than in turn: neither needs
// the other's answer.
//
// The week is returned alongside the slots because a PlanSlotOut carries no
// week field -- backend/openapi.json declares slot_id, day_of_week,
// meal_position and recipe, and nothing else -- so the answer cannot say which
// week it is an answer about, and the address need not have named one.
async function plannerLoader({
  request: req,
}: LoaderFunctionArgs): Promise<PlanWeek> {
  const asked = new URL(req.url).searchParams.get(QUERY.week);
  const thisWeek = isoWeek(new Date());

  // A week typed into the address that is not a week would be answered 422 and
  // reach the error boundary. Sending the reader to the week they will in fact
  // be shown is the better answer, and it leaves the address telling the truth
  // rather than drawing this week under a heading that says something else.
  //
  // isWeek and not the pattern alone: the pattern admits a 53rd week in every
  // year, and a POST from a screen drawn for 2025-W53 would write slots into a
  // bucket that no link can reach a second time, over seven days that another
  // address already owns.
  if (asked !== null && !isWeek(asked)) {
    throw redirect(`${PATHS.planner}?${QUERY.week}=${thisWeek}`);
  }

  const week = asked ?? thisWeek;

  return withSession(async () => {
    const [slots, recipes] = await Promise.all([
      authed<PlanSlot[]>(`/mealplan?${QUERY.week}=${week}`),
      authed<RecipeSummary[]>("/recipes"),
    ]);

    return { week, slots, recipes };
  });
}

// One action for the whole screen, branching on a hidden `intent` field rather
// than giving each verb a route of its own -- the shape C15 uses on
// /recipes/:id. C17 (nomadwiz/kete#181) added filling a whole week and
// clearing one as two more branches, POST /mealplan/generate and DELETE
// /mealplan/week/{week}, rather than routes of their own.
//
// A branch answers null when the server accepted the change and the server's
// own sentence when it did not. Either way the grid is redrawn from the
// loader, because React Router revalidates after an action -- so no branch
// returns the new state and nothing here holds a second copy of the week.
//
// The week is read once, at the top, because three of the four branches send
// it and the house rule extracts on the third. It is read off the hidden field
// the grid carries and never recomputed here: a week recomputed in an action
// is a different week from the one the person was looking at.

// Which failures this screen answers above the grid, per intent; everything
// else goes to the error boundary. Keyed by the intent and not by the status,
// because the same number means different things on the four routes and the
// meaning is what decides the surface -- the rule C26 (nomadwiz/kete#279) was
// corrected to. In backend/openapi.json's own words:
//
//   place, POST /mealplan
//     404 "No such recipe, or it belongs to another account" -- one stale row.
//     409 "That day and meal is already filled" -- another tab got there
//     first.
//     422 -- a value the enums refuse, answered by choosing again.
//
//   remove, DELETE /mealplan/{slot_id}
//     404 "No such plan slot, or it belongs to another account", and the same
//     422. No 409: that route declares 204, 401, 404 and 422 and nothing else.
//     The flat tuple this table replaced answered a 409 here, which the same
//     rule that made this a table forbids -- an undeclared failure printed
//     above the grid invites another go at something that cannot work.
//
//   generate, POST /mealplan/generate
//     400 "The recipe library is empty. Add at least one recipe before
//     generating a week." -- the library was there when the loader read it and
//     is not now, and the sentence names the thing to do about it.
//     409 "The week changed while it was being generated" -- the double click.
//     This route declares no 404 at all.
//
//   clear, DELETE /mealplan/week/{week}
//     declares 401 and 422 and nothing else -- no 404, because emptying a week
//     that is already empty is a success rather than a missing row, and no
//     409. Its 422 could come only from a malformed week, which plannerLoader
//     refuses before the screen is drawn, so this is the list that is nearly
//     empty, and that is the contract's doing rather than an oversight.
//
// In all four the session is intact, the week is intact, and the revalidation
// that follows repairs the view by itself, which is why none of them takes the
// whole grid to the boundary. Do not flatten these into one set: 400 on
// `place` and 404 on `generate` are undeclared, and an undeclared failure
// printed above the grid invites another go at something that cannot work.
// A Map rather than an object literal, because an object literal typed
// Record<string, ...> promises a row for every string and has one: "constructor"
// finds Object through the prototype, whose .includes is undefined and would
// replace a real ApiError with a TypeError inside the catch. A Map has no
// inherited keys and its get() is honestly optional.
const RECOVERABLE = new Map<string, readonly number[]>([
  ["place", [404, 409, 422]],
  ["remove", [404, 422]],
  ["generate", [400, 409, 422]],
  ["clear", [422]],
]);

async function plannerAction({ request: req }: ActionFunctionArgs) {
  const form = await req.formData();
  const intent = String(form.get("intent") ?? "");
  const week = String(form.get("week") ?? "");

  return withSession(async () => {
    try {
      if (intent === "remove") {
        // 204 with no body. http.ts answers undefined for that status, so
        // nothing here reads a result: asking for one would parse an empty
        // body as JSON and throw on a request that succeeded.
        await authed<void>(`/mealplan/${Number(form.get("slot_id"))}`, {
          method: "DELETE",
        });
      } else if (intent === "place") {
        // The two casts assert what the grid's own hidden fields carry, both
        // of which are enums in backend/main.py, so anything else is answered
        // 422 rather than filling the wrong position.
        const placement: PlanSlotIn = {
          recipe_id: Number(form.get("recipe_id")),
          week,
          day_of_week: String(form.get("day_of_week") ?? "") as DayOfWeek,
          meal_position: String(
            form.get("meal_position") ?? "",
          ) as MealPosition,
        };

        // The reply carries the new slot_id. It is discarded: the loader
        // redraws the week, so there is one place that knows what is in it.
        await authed<unknown>("/mealplan", {
          method: "POST",
          body: JSON.stringify(placement),
        });
      } else if (intent === "generate") {
        // Destructive, and the screen says so before it gets here:
        // backend/main.py empties the week and then deals the library out
        // across all twenty-one positions, so whatever was planned is gone.
        const whole: GenerateIn = { week };

        // The reply is GenerateOut, whose `created` is always 21 for that
        // reason. Discarded like the slot_id above, for the same reason.
        await authed<unknown>("/mealplan/generate", {
          method: "POST",
          body: JSON.stringify(whole),
        });
      } else if (intent === "clear") {
        // 204 with no body, as `remove` is. The week travels in the path on
        // this one route rather than in a body or a query.
        // encodeURIComponent, which no other call here needs: this is the
        // only route that puts a form value in a path. The loader has already
        // refused a week that is not one, so nothing reaches here through the
        // screen -- but a hand-edited hidden field of "../profile" would
        // otherwise aim the DELETE at another endpoint under the same bearer
        // token, and a malformed one would become a different address instead
        // of the 422 this intent's row exists to answer.
        await authed<void>(`/mealplan/week/${encodeURIComponent(week)}`, {
          method: "DELETE",
        });
      } else {
        // Not a shrug. Every form on the grid carries an intent, so an
        // unrecognised one is a typo in a hidden field -- which, returned as
        // null, is indistinguishable from success: the loader revalidates and
        // the grid redraws unchanged.
        throw new Error(`Unknown planner intent: ${intent}`);
      }
    } catch (error) {
      // The table above decides this. An intent with no row never reaches the
      // API -- the branch below throws on one before any call is made -- so a
      // missing row cannot arrive here with an ApiError beside it, and the ??
      // is the type being honest rather than a case anyone has seen.
      //
      // Do not "correct" this to match measurementsAction. The 404 that
      // profileAction and measurementsAction send to the boundary is a
      // different sentence -- "The account behind the token no longer exists"
      // -- and nothing on those screens can ever succeed after it. C26
      // (nomadwiz/kete#279) is about that one, not this one.
      if (
        error instanceof ApiError &&
        (RECOVERABLE.get(intent) ?? []).includes(error.status)
      ) {
        return error.message;
      }

      throw error;
    }

    return null;
  });
}

async function measurementsAction({ request: req }: ActionFunctionArgs) {
  const form = await req.formData();

  // The two casts assert what the selects offer and the server enforces: each
  // is a Literal in backend/main.py, so a value from anywhere else is answered
  // 422 rather than silently computing a target from the wrong factor. The
  // numbers need no such guard -- Number(null) is 0, which the server rejects.
  const metrics: Metrics = {
    weight_kg: Number(form.get("weight_kg")),
    height_cm: Number(form.get("height_cm")),
    age: Number(form.get("age")),
    sex: String(form.get("sex") ?? "") as Sex,
    activity_level: String(form.get("activity_level") ?? "") as ActivityLevel,
  };

  return withSession(async () => {
    try {
      // The response carries the targets this save computed. They are
      // discarded: the screen this redirects to reads them from GET /targets,
      // so there is one place that renders them rather than two that can
      // disagree.
      await authed<unknown>("/profile/metrics", {
        method: "POST",
        body: JSON.stringify(metrics),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return error.message;
      }

      throw error;
    }

    return redirect(PATHS.targets);
  });
}

async function signUpAction({ request: req }: ActionFunctionArgs) {
  const form = await req.formData();
  const details: Register = {
    first_name: String(form.get("first_name") ?? ""),
    last_name: String(form.get("last_name") ?? ""),
    username: String(form.get("username") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  };

  try {
    // Unauthenticated, so this is `request` rather than `authed`. The reply
    // carries a user id and no token, so a new account still signs in.
    await request<RegisterResult>("/register", {
      method: "POST",
      body: JSON.stringify(details),
    });

    return redirect(`${PATHS.sign_in}?${QUERY.account_created}=1`);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.message;
    }

    throw error;
  }
}

async function signInAction({ request: req }: ActionFunctionArgs) {
  const form = await req.formData();
  const credentials: SignIn = {
    username_or_email: String(form.get("username_or_email") ?? ""),
    password: String(form.get("password") ?? ""),
  };

  let result: SignInResult;

  try {
    result = await request<SignInResult>("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return error.message;
    }

    throw error;
  }

  if (!writeToken(result.token)) {
    return "Could not sign you in on this browser. Check that site data is enabled, then try again.";
  }

  // Unconditionally. A user with no saved measurements is told so by the
  // dashboard rather than routed around it -- ADR 004 -- which covers the
  // returning user who still holds a valid token and never reaches this
  // action at all. It also drops a round trip the destination repeats.
  return redirect(PATHS.dashboard);
}

function signOutAction() {
  clearToken();

  return redirect(PATHS.sign_in);
}

function signOutLoader() {
  return redirect(PATHS.home);
}

const routes = [
  {
    ErrorBoundary,
    children: [
      {
        Component: PublicLayout,
        children: [
          { path: PATHS.home, Component: HOME },
          { path: PATHS.sign_up, Component: SIGN_UP, action: signUpAction },
          { path: PATHS.sign_in, Component: SIGN_IN, action: signInAction },
        ],
      },
      {
        Component: AppLayout,
        loader: requireSession,
        children: [
          // The same ErrorBoundary as the one above, mounted a second time on a
          // route with no path and no component of its own. React Router renders
          // a boundary at the route carrying it, so the outer mount replaces
          // AppLayout and the navigation with it; this one is nested inside
          // AppLayout, so a failed page renders into its outlet and the
          // navigation survives. Putting the boundary on AppLayout itself does
          // not work -- that route would be the one it replaces. ADR 003.
          {
            ErrorBoundary,
            children: [
              {
                path: PATHS.dashboard,
                Component: DASHBOARD,
                loader: targetsLoader,
              },
              {
                path: PATHS.measurements,
                Component: MEASUREMENT,
                loader: metricsLoader,
                action: measurementsAction,
              },
              {
                path: PATHS.targets,
                Component: TARGETS,
                loader: targetsLoader,
              },
              {
                path: PATHS.recipes,
                Component: RECIPES,
                loader: recipesLoader,
                action: recipesAction,
              },
              {
                path: PATHS.recipe,
                Component: RECIPE_DETAIL,
                loader: recipeLoader,
                action: recipeAction,
              },
              {
                path: PATHS.planner,
                Component: PLANNER,
                loader: plannerLoader,
                action: plannerAction,
              },
              {
                path: PATHS.account,
                Component: ACCOUNT,
                loader: profileLoader,
                action: profileAction,
              },
            ],
          },
        ],
      },
      {
        path: PATHS.sign_out,
        action: signOutAction,
        loader: signOutLoader,
      },
      { path: PATHS.not_found, Component: NOT_FOUND },
    ],
  },
];

export { PATHS, QUERY, routes };
