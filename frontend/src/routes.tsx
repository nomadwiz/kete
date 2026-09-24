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
import type { SignIn, SignInResult } from "./types/auth";
import type { RecipeSummary } from "./types/recipe";

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
          { path: PATHS.sign_up, Component: SIGN_UP },
          { path: PATHS.sign_in, Component: SIGN_IN, action: signInAction },
        ],
      },
      {
        Component: AppLayout,
        loader: requireSession,
        children: [
          { path: PATHS.dashboard, Component: DASHBOARD },
          { path: PATHS.measurements, Component: MEASUREMENT },
          { path: PATHS.targets, Component: TARGETS },
          { path: PATHS.recipes, Component: RECIPES, loader: recipesLoader },
          { path: PATHS.recipe, Component: RECIPE_DETAIL },
          { path: PATHS.planner, Component: PLANNER },
          { path: PATHS.account, Component: ACCOUNT },
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

export { PATHS, routes };
