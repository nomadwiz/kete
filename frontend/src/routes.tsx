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

// Query keys, beside the paths and for the same reason as ADR 002 gives for
// them: written once here, imported by the screens that read them. State a
// visitor would expect to survive a refresh belongs in the address.
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
    // Anything the API answered with is something this person can act on from
    // this page — a taken username, a rejected email — and returning it keeps
    // the five fields they typed. Only a request that never got an answer
    // goes to the ErrorBoundary, because there is no form left to return to.
    if (error instanceof ApiError) {
      return error.message;
    }

    throw error;
  }
}

// Where a signed-in user starts. `GET /targets` answers 404 until the body
// measurements have been saved, which ADR 001 settles; nothing reads the
// measurements themselves back, so that status is the only signal there is.
async function firstScreen(): Promise<string> {
  try {
    await authed<unknown>("/targets");

    return PATHS.dashboard;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return PATHS.measurements;
    }

    // The sign-in itself already succeeded, so nothing this probe runs into is
    // worth holding someone on the form for. `SessionExpired` lands here too:
    // `authed` has cleared the token by then, so the guard on the signed-in
    // layout turns this redirect straight back into sign-in.
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

  // Its own try, so that a 404 from the probe below cannot be mistaken for
  // something this person typed and printed above the form.
  try {
    result = await request<SignInResult>("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  } catch (error) {
    // `request` rather than `authed`, deliberately: the API answers a wrong
    // password with 401 so that an attacker cannot learn which usernames
    // exist, and `authed` would read that as an expired session and clear a
    // token this person may still hold in another tab.
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

export { PATHS, QUERY, routes };
