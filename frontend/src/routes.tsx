import { redirect, type ActionFunctionArgs } from "react-router";

import { ApiError, SessionExpired } from "./api/errors";
import { request } from "./api/http";
import { authed } from "./api/session";
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

// This file owns every address, so it is also where an ended session becomes
// a destination. The API layer raises SessionExpired and says nothing about
// where to send anyone, which is what keeps it free of the router.
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

// The one place a failed call is deliberately kept off the error boundary.
// POST /login answers 401 for an unknown username and a wrong password
// identically, by design, so an attacker cannot discover which accounts
// exist — which makes the server's own message the answer this form shows.
async function signInAction({ request: req }: ActionFunctionArgs) {
  const form = await req.formData();
  const credentials: SignIn = {
    username_or_email: String(form.get("username_or_email") ?? ""),
    password: String(form.get("password") ?? ""),
  };

  try {
    const result = await request<SignInResult>("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    // Storage can refuse the write in a private window. Redirecting anyway
    // would send a correctly signed-in user to a protected route with no
    // credential, bouncing them straight back here with nothing to diagnose.
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
