import { redirect, type ActionFunctionArgs } from "react-router";

import { ApiError, SessionExpired } from "./api/errors";
import { request } from "./api/http";
import { authed } from "./api/session";
import { clearToken, readToken, writeToken } from "./api/token";
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
} as const;

function requireSession() {
  if (!readToken()) {
    clearToken();

    throw redirect(PATHS.sign_in);
  }

  return null;
}

async function recipesLoader(): Promise<RecipeSummary[]> {
  try {
    return await authed<RecipeSummary[]>("/recipes");
  } catch (error) {
    if (error instanceof SessionExpired) {
      throw redirect(PATHS.sign_in);
    }

    throw error;
  }
}

// Null is a state and not a failure. GET /targets answers 404 until
// measurements have been saved, which ADR 001 records and which firstScreen()
// below already relies on, so the screen renders its own empty panel for it
// rather than rethrowing. The error boundary now renders inside AppLayout, so
// a rethrow would no longer cost the navigation -- but it would still tell a
// user who has simply not filled the form in yet that something went wrong,
// which is the wrong answer whatever survives around it.
async function targetsLoader(): Promise<Targets | null> {
  try {
    return await authed<Targets>("/targets");
  } catch (error) {
    if (error instanceof SessionExpired) {
      throw redirect(PATHS.sign_in);
    }

    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
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

  try {
    // The response carries the targets this save computed. They are discarded:
    // the screen this redirects to reads them from GET /targets, so there is
    // one place that renders them rather than two that can disagree.
    await authed<unknown>("/profile/metrics", {
      method: "POST",
      body: JSON.stringify(metrics),
    });
  } catch (error) {
    if (error instanceof SessionExpired) {
      throw redirect(PATHS.sign_in);
    }

    if (error instanceof ApiError) {
      return error.message;
    }

    throw error;
  }

  return redirect(PATHS.targets);
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

async function firstScreen(): Promise<string> {
  try {
    await authed<unknown>("/targets");

    return PATHS.dashboard;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return PATHS.measurements;
    }

    return PATHS.dashboard;
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

  return redirect(await firstScreen());
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
              { path: PATHS.dashboard, Component: DASHBOARD },
              {
                path: PATHS.measurements,
                Component: MEASUREMENT,
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
              { path: PATHS.planner, Component: PLANNER },
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
