import {
  redirect,
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
import type { RecipeSummary } from "./types/recipe";
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

function recipesLoader(): Promise<RecipeSummary[]> {
  return withSession(() => authed<RecipeSummary[]>("/recipes"));
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
//     409 and 422.
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
const RECOVERABLE: Record<string, readonly number[]> = {
  place: [404, 409, 422],
  remove: [404, 409, 422],
  generate: [400, 409, 422],
  clear: [422],
};

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
        await authed<void>(`/mealplan/week/${week}`, { method: "DELETE" });
      } else {
        // Not a shrug. Every form on the grid carries an intent, so an
        // unrecognised one is a typo in a hidden field -- which, returned as
        // null, is indistinguishable from success: the loader revalidates and
        // the grid redraws unchanged.
        throw new Error(`Unknown planner intent: ${intent}`);
      }
    } catch (error) {
      // The table above decides this, and the branch that throws on an
      // unknown intent is what makes the lookup safe: an intent with no row
      // never reaches the API, so nothing it could throw is an ApiError.
      //
      // Do not "correct" this to match measurementsAction. The 404 that
      // profileAction and measurementsAction send to the boundary is a
      // different sentence -- "The account behind the token no longer exists"
      // -- and nothing on those screens can ever succeed after it. C26
      // (nomadwiz/kete#279) is about that one, not this one.
      if (
        error instanceof ApiError &&
        RECOVERABLE[intent].includes(error.status)
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
              },
              { path: PATHS.recipe, Component: RECIPE_DETAIL },
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
