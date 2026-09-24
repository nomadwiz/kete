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

<<<<<<< Updated upstream
// The guard on the signed-in layout. A loader runs before the route's
// component renders, which is the whole of what ADR 002 bought over a
// component-level check: no protected content appears and is then withdrawn.
//
// It answers one question — is there a credential on this browser? An expired
// credential still looks like one from here, because only the API can reject
// it. That is why recipesLoader below keeps its own SessionExpired catch: two
// different failures, detected in two different places.
function requireSession() {
  if (!readToken()) {
    // Cleared on the way out for the same reason authed() clears it: what
    // readToken rejects is not only an absent key but an empty one, and a
    // guard that redirects while leaving that behind has not made its own
    // postcondition true. After this line there is definitively no credential.
    clearToken();

    // Thrown, not returned. Throwing abandons the navigation at this line, so
    // nothing below it can run and no child loader's result can be mistaken
    // for this route's data — the same idiom recipesLoader uses.
    throw redirect(PATHS.sign_in);
  }

  // A loader must return something; undefined is not allowed. Null is the
  // conventional answer from a loader that exists for its check rather than
  // for data, and AppLayout reads nothing from it.
  return null;
}

=======
<<<<<<< Updated upstream
>>>>>>> Stashed changes
// This file owns every address, so it is also where an ended session becomes
// a destination. The API layer raises SessionExpired and says nothing about
// where to send anyone, which is what keeps it free of the router.
=======
function requireSession() {
  if (!readToken()) {
    clearToken();

    throw redirect(PATHS.sign_in);
  }

  return null;
}

>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
// FR-14 asks that signing out disposes the credential rather than merely
// ceasing to send it. There is no POST /logout to call — the token is a
// twelve-hour JWT with no server-side revocation — so disposal is this
// removal and nothing else. An action rather than a click handler, so the
// client's one non-API write still goes through the router.
function signOutAction() {
  clearToken();

  return redirect(PATHS.sign_in);
}

// The same address reached by typing it rather than by submitting the form.
// It disposes of nothing: a GET that changed the session would be mutated by
// a prefetch or a bookmark. The route has no component, so without this a
// real address would answer with a blank page.
function signOutLoader() {
  return redirect(PATHS.home);
}

// One pathless parent carries the error boundary for every route beneath it.
// Two more pathless parents beneath it carry the two layouts, so which shell
// a screen renders inside is decided by where it sits in this tree and by
// nothing else. The catch-all stays outside both: at an unmatched address the
// application does not know which state the visitor is in.
=======
<<<<<<< Updated upstream
// One pathless parent carries the error boundary for every route beneath it.
// Its Component is deliberately absent: C4 (#169) fills that slot with the
// navigation chrome, so this file is restructured once rather than twice.
=======
function signOutAction() {
  clearToken();

  return redirect(PATHS.sign_in);
}

function signOutLoader() {
  return redirect(PATHS.home);
}

>>>>>>> Stashed changes
>>>>>>> Stashed changes
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
