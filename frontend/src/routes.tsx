import { redirect, type ActionFunctionArgs } from "react-router";

import { apiAuth, apiPublic } from "./api/client";
import { ApiError } from "./api/errors";
import { writeToken } from "./api/token";
import ErrorBoundary from "./components/error-boundary";
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
import type { SignIn, SignInResult } from "./types/auth";
import type { RecipeSummary } from "./types/recipe";

const PATHS = {
  home: "/",
  sign_up: "/sign-up",
  sign_in: "/sign-in",
  measurements: "/measurements",
  targets: "/targets",
  dashboard: "/dashboard",
  recipes: "/recipes",
  recipe: "/recipes/:id",
  planner: "/planner",
  account: "/account",
  not_found: "*",
} as const;

function recipesLoader(): Promise<RecipeSummary[]> {
  return apiAuth<RecipeSummary[]>("/recipes");
}

// The one place in the client where a failed call is deliberately not sent to
// the error boundary. POST /login answers 401 for an unknown username and for
// a wrong password identically, by design, so an attacker cannot discover
// which accounts exist — which makes the server's own message the answer this
// form has to show rather than a page failure.
async function signInAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const credentials: SignIn = {
    username_or_email: String(form.get("username_or_email") ?? ""),
    password: String(form.get("password") ?? ""),
  };

  try {
    const result = await apiPublic<SignInResult>("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    // Storage can refuse the write in a private window or with site data
    // blocked. Redirecting anyway would send a correctly signed-in user to a
    // protected route with no credential, which bounces straight back here
    // and reads as a broken login with nothing to diagnose it from.
    if (!writeToken(result.token)) {
      return "Could not sign you in on this browser. Check that site data is enabled, then try again.";
    }

    return redirect(PATHS.dashboard);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.message;
    }

    throw error;
  }
}

// One pathless parent carries the error boundary for every route beneath it.
// Its Component is deliberately absent: C4 (#169) fills that slot with the
// navigation chrome, so this file is restructured once rather than twice.
const routes = [
  {
    ErrorBoundary,
    children: [
      { path: PATHS.home, Component: HOME },
      { path: PATHS.sign_up, Component: SIGN_UP },
      { path: PATHS.sign_in, Component: SIGN_IN, action: signInAction },
      { path: PATHS.measurements, Component: MEASUREMENT },
      { path: PATHS.targets, Component: TARGETS },
      { path: PATHS.dashboard, Component: DASHBOARD },
      { path: PATHS.recipes, Component: RECIPES, loader: recipesLoader },
      { path: PATHS.recipe, Component: RECIPE_DETAIL },
      { path: PATHS.planner, Component: PLANNER },
      { path: PATHS.account, Component: ACCOUNT },
      { path: PATHS.not_found, Component: NOT_FOUND },
    ],
  },
];

export { PATHS, routes };
