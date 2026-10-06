import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QUERY } from "./routes";
import {
  jsonResponse,
  renderAt,
  stubFetch,
  summaryBody,
  TARGETS_BODY,
} from "./test/router";

// Every sign-in lands on /dashboard, which compares the current week, so the
// clock is pinned: Thursday 24 September 2026 is in 2026-W39, which
// ./api/week.test.ts pins.
const SUMMARY = "/mealplan/summary?week=2026-W39";

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

async function signIn() {
  const user = userEvent.setup();

  await user.type(
    await screen.findByLabelText("Username or email"),
    "jack@example.test",
  );
  await user.type(screen.getByLabelText("Password"), "a-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  // Only Date. Testing Library waits on real timers, and faking those hangs
  // the first query that has to wait for anything.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 24));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// The first two of the three behaviours C22 (nomadwiz/kete#236) names. The
// third is "a sign-in the API rejects", below.
// Every address behind the guard, not a sample of one. The guard is a loader
// on the layout route, so a screen reaches it only by being mounted inside
// that layout -- and a screen mounted as a sibling of it instead, beside
// /sign-out, would load and render for a signed-out visitor while a test of
// /dashboard alone went on passing. Naming each address is what catches that,
// and the list is short enough to be worth the repetition.
const PROTECTED = [
  "/dashboard",
  "/measurements",
  "/targets",
  "/recipes",
  "/recipes/1",
  "/planner",
  "/account",
  "/account/password",
  "/account/delete",
];

describe("the guard on the signed-in layout", () => {
  // The absence of the request is the assertion C2 (nomadwiz/kete#167) names,
  // and it is the stronger half. A guard that let the loader run and then
  // redirected on the 401 would land on /sign-in too and pass a check of the
  // address alone -- while having sent the API a request with no credential,
  // which is the thing the guard exists to make impossible.
  it.each(PROTECTED)(
    "turns a signed-out visitor away from %s without calling the API",
    async (path) => {
      const { calls } = stubFetch({});
      const { router } = renderAt(path);

      await screen.findByRole("heading", { name: "Sign in" });

      expect(router.state.location.pathname).toBe("/sign-in");
      expect(calls).toEqual([]);
    },
  );
});

// C31 (nomadwiz/kete#304) and C35 (nomadwiz/kete#357), the same rule inverted.
// The exact list of calls is the assertion that the guard asks nothing:
// /targets and the summary are the dashboard's own, so a guard that checked the
// token against the API would add a path to the list, or fail on the stub's
// unlisted-path error. Each address is paired with its form's submit button.
const GUARDED_FORMS = [
  ["/sign-in", "Sign in"],
  ["/sign-up", "Create an account"],
];

describe("the guard on sign in and sign up", () => {
  it.each(GUARDED_FORMS)(
    "sends a visitor who holds a token from %s to the dashboard without calling the API itself",
    async (path) => {
      signedIn();
      const { calls } = stubFetch({
        "/targets": async () => jsonResponse(200, TARGETS_BODY),
        [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
      });

      const { router } = renderAt(path);

      expect(await screen.findByText("2,480 kcal")).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard");
      expect(calls).toEqual(["/targets", SUMMARY]);
    },
  );

  it.each(GUARDED_FORMS)(
    "shows a visitor with no token the form at %s",
    async (path, button) => {
      const { calls } = stubFetch({});
      const { router } = renderAt(path);

      expect(
        await screen.findByRole("button", { name: button }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
      expect(calls).toEqual([]);
    },
  );
});

describe("signing out", () => {
  it("disposes the credential rather than ceasing to send it", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
      [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
    });

    const { router } = renderAt("/dashboard");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Sign out" }));

    await screen.findByRole("heading", { name: "Sign in" });

    expect(window.localStorage.getItem("kete.token")).toBeNull();
    expect(router.state.location.pathname).toBe("/sign-in");
  });
});

// ADR 004 in nomadwiz/kete-doc. Sign-in used to probe GET /targets itself and
// route on the answer, which covered a fresh sign-in and left the returning
// user with a valid token uncovered.
describe("where a fresh sign-in lands", () => {
  it("goes to the dashboard even with no measurements saved, and asks once", async () => {
    const { calls } = stubFetch({
      "/login": async () => jsonResponse(200, { token: "a-token" }),
      "/targets": async () => jsonResponse(404, { detail: "No targets" }),
      [SUMMARY]: async () => jsonResponse(404, { detail: "No targets yet" }),
    });

    const { router } = renderAt("/sign-in");

    await signIn();

    expect(
      await screen.findByRole("link", { name: "Add your measurements" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");

    // One probe, made by the screen that draws the answer. Sign-in asking as
    // well is the round trip ADR 004 removed. The summary is the dashboard's
    // own comparison of the week, C18 (nomadwiz/kete#182), not a second probe.
    expect(calls).toEqual(["/login", "/targets", SUMMARY]);
  });

  it("goes to the dashboard with measurements saved", async () => {
    stubFetch({
      "/login": async () => jsonResponse(200, { token: "a-token" }),
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
      [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
    });

    const { router } = renderAt("/sign-in");

    await signIn();

    expect(await screen.findByText("2,480 kcal")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });

  // nomadwiz/kete#252. firstScreen() answered /dashboard for every failure
  // that was not a 404, so a sign-in against a host that was not answering put
  // a signed-in user on a screen that could not load.
  it("puts a sign-in against an unreachable host in front of a message", async () => {
    stubFetch({
      "/login": async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    const { router } = renderAt("/sign-in");

    await signIn();

    expect(
      await screen.findByText(
        "The server could not be reached. Try again in a moment.",
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).not.toBe("/dashboard");
  });
});

// C22's third behaviour, and the half of the pair the dashboard's "signs the
// user out on a 401" test leaves: POST /login answers 401 by design, so that
// an attacker cannot learn which usernames exist. The assertion is the form's
// own role="alert" and not the message text -- ErrorBoundary prints the same
// sentence, so a check for the text alone still passes against an action that
// rethrows, which is the defect this test exists to catch.
describe("a sign-in the API rejects", () => {
  it("keeps the user on the page with the server's own message, rather than treating the 401 as an ended session", async () => {
    stubFetch({
      "/login": async () =>
        jsonResponse(401, { detail: "Incorrect username or password" }),
    });

    const { router } = renderAt("/sign-in");

    await signIn();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect username or password",
    );
    expect(router.state.location.pathname).toBe("/sign-in");
    expect(window.localStorage.getItem("kete.token")).toBeNull();
  });
});

// The third of C22's behaviours on a write. The dashboard's "signs the user
// out on a 401" test covers a loader, where nothing competes for the error;
// an action is where the rule is breakable, because several of them catch
// ApiError to put a refusal above the form the person is standing in.
//
// What keeps a 401 out of those catches is that authed() does not rethrow it
// as an ApiError at all -- it disposes the token and throws SessionExpired,
// which no `error instanceof ApiError` clause can match. That is a design
// choice stated in a comment above withSession and asserted nowhere, so an
// action rewritten to read `error.status` off a caught ApiError would print
// "Your session has ended" above a Save button, leave the user on /account
// holding a token that has already been thrown away, and break no test.
describe("a write refused with a 401", () => {
  it("disposes the credential and lands the user on sign in, rather than answering the form", async () => {
    signedIn();
    stubFetch({
      "/profile": async (init?: RequestInit) =>
        init?.method === "PUT"
          ? jsonResponse(401, { detail: "Expired" })
          : jsonResponse(200, {
              first_name: "Aroha",
              last_name: "Tane",
              username: "aroha",
              email: "aroha@example.com",
            }),
    });

    const { router } = renderAt("/account");

    const user = userEvent.setup();
    const username = await screen.findByLabelText("Username");

    await user.clear(username);
    await user.type(username, "renamed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("heading", { name: "Sign in" });

    expect(window.localStorage.getItem("kete.token")).toBeNull();
    expect(router.state.location.pathname).toBe("/sign-in");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// C25 (nomadwiz/kete#277). The address is the substance of this test. Every
// sign-in test above drives the bare /sign-in, where comparing
// navigation.formAction against PATHS.sign_in happens to hold; signUpAction
// sends a new account to /sign-in?created=1, and a react-router Form that
// declares no `action` submits to the current address including its search, so
// on that address the comparison is false for the whole submission and neither
// the disabled button nor aria-busy ever turns on.
describe("a sign-in from the address a new account lands on", () => {
  it("disables the button and marks the form busy while the submission is in flight", async () => {
    // POST /login is held open, because what is under test is the state during
    // the submission rather than where it lands. Nothing else can observe that
    // window: the action resolving immediately would close it before the test
    // could look.
    let answerLogin = () => {};
    const held = new Promise<void>((resolve) => {
      answerLogin = resolve;
    });

    stubFetch({
      "/login": async () => {
        await held;

        return jsonResponse(200, { token: "a-token" });
      },
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
      [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
    });

    renderAt(`/sign-in?${QUERY.account_created}=1`);

    await signIn();

    const submit = () => screen.getByRole("button", { name: /^Sign(ing)? in/ });

    // Released in a finally, so a failed assertion above does not leave the
    // request hanging and the router updating a tree the next test has
    // replaced -- which would report this defect as a failure in that test.
    try {
      await waitFor(() => expect(submit()).toBeDisabled());
      expect(submit().closest("form")).toHaveAttribute("aria-busy", "true");
    } finally {
      answerLogin();
    }

    await screen.findByText("2,480 kcal");
  });
});
