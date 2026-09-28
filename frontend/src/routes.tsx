import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { ApiError, SessionExpired } from "./api/errors";
import { request } from "./api/http";
import { authed } from "./api/session";
import { clearToken, readToken, writeToken } from "./api/token";
import { isoWeek, WEEK_PATTERN } from "./api/week";
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
  MealPosition,
  PlanSlot,
  PlanSlotIn,
  PlanWeek,
} from "./types/plan";
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
  if (asked !== null && !WEEK_PATTERN.test(asked)) {
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
// /recipes/:id. C17 (nomadwiz/kete#181) adds generating a week and clearing
// one as two more branches here, POST /mealplan/generate and DELETE
// /mealplan/week/{week}, rather than rewriting this.
//
// A branch answers null when the server accepted the change and the server's
// own sentence when it did not. Either way the grid is redrawn from the
// loader, because React Router revalidates after an action -- so no branch
// returns the new state and nothing here holds a second copy of the week.
async function plannerAction({ request: req }: ActionFunctionArgs) {
  const form = await req.formData();
  const intent = String(form.get("intent") ?? "");

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
        //
        // 409 is the position already being filled, which happens when a
        // second tab filled it first. The catch below turns it into the
        // server's own sentence above the grid, and the revalidation that
        // follows shows what is actually there.
        const placement: PlanSlotIn = {
          recipe_id: Number(form.get("recipe_id")),
          week: String(form.get("week") ?? ""),
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
      }
    } catch (error) {
      if (error instanceof ApiError) {
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
              { path: PATHS.account, Component: ACCOUNT },
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
