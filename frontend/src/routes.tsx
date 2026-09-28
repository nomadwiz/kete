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
import type { Profile } from "./types/profile";
import type { RecipeIn, RecipeSummary } from "./types/recipe";
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
              { path: PATHS.recipe, Component: RECIPE_DETAIL },
              { path: PATHS.planner, Component: PLANNER },
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
