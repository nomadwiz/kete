import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch, TARGETS_BODY } from "./test/router";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

// Two of the three behaviours C22 (nomadwiz/kete#236) names. The third -- that
// a 401 from POST /login does not trigger the global sign-out redirect --
// stays with that issue.
describe("the guard on the signed-in layout", () => {
  it("turns a signed-out visitor away from the dashboard without calling the API", async () => {
    const { calls } = stubFetch({});
    const { router } = renderAt("/dashboard");

    await screen.findByRole("heading", { name: "Sign in" });

    expect(router.state.location.pathname).toBe("/sign-in");
    expect(calls).toEqual([]);
  });
});

describe("signing out", () => {
  it("disposes the credential rather than ceasing to send it", async () => {
    signedIn();
    stubFetch({ "/targets": async () => jsonResponse(200, TARGETS_BODY) });

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
    });

    const { router } = renderAt("/sign-in");

    await signIn();

    expect(
      await screen.findByRole("link", { name: "Add your measurements" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");

    // One probe, made by the screen that draws the answer. Sign-in asking as
    // well is the round trip ADR 004 removed.
    expect(calls).toEqual(["/login", "/targets"]);
  });

  it("goes to the dashboard with measurements saved", async () => {
    stubFetch({
      "/login": async () => jsonResponse(200, { token: "a-token" }),
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
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
