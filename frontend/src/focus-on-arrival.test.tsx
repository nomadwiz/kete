import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  jsonResponse,
  renderAt,
  stubFetch,
  summaryBody,
  TARGETS_BODY,
} from "./test/router";

// C38 (nomadwiz/kete#379), ADR 015 in nomadwiz/kete-doc. Each test drives the
// real route tree and asserts where focus is once the destination has drawn,
// because the defect was focus left on <body> after a write that redirects.

// The dashboard compares the current week, so the clock is pinned as in
// routes.test.tsx: Thursday 24 September 2026 is in 2026-W39.
const SUMMARY = "/mealplan/summary?week=2026-W39";

const LAKSA = {
  recipe_id: 7,
  name: "Laksa",
  cuisine: "Malaysian",
  energy_kcal: 1240,
  photo_url: null,
  ingredients: "Noodles",
  steps: "Simmer.",
  servings: 4,
  protein_g: 38,
  carbs_g: 1096,
  fat_g: 44,
};

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

function dashboardStubs() {
  return {
    "/targets": async () => jsonResponse(200, TARGETS_BODY),
    [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
  };
}

async function expectFocusOn(heading: string) {
  const h1 = await screen.findByRole("heading", { level: 1, name: heading });

  await waitFor(() => expect(h1).toHaveFocus());
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 24));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a write that redirects puts focus on the destination's heading", () => {
  it("signing up lands on Sign in", async () => {
    stubFetch({ "/register": async () => jsonResponse(201, { user_id: 1 }) });
    renderAt("/sign-up");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("First name"), "Aroha");
    await user.type(screen.getByLabelText("Last name"), "Tane");
    await user.type(screen.getByLabelText("Username"), "aroha");
    await user.type(screen.getByLabelText("Email"), "aroha@example.test");
    await user.type(screen.getByLabelText("Password"), "a-password");
    await user.click(screen.getByRole("button", { name: "Create an account" }));

    await expectFocusOn("Sign in");
  });

  it("signing in lands on Dashboard", async () => {
    stubFetch({
      "/login": async () => jsonResponse(200, { token: "a-token" }),
      ...dashboardStubs(),
    });
    renderAt("/sign-in");
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText("Username or email"),
      "aroha@example.test",
    );
    await user.type(screen.getByLabelText("Password"), "a-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await expectFocusOn("Dashboard");
  });

  it("saving measurements lands on Your targets", async () => {
    signedIn();
    stubFetch({
      "/profile/metrics": async (init?: RequestInit) =>
        init?.method === "POST"
          ? jsonResponse(200, TARGETS_BODY)
          : jsonResponse(404, { detail: "No measurements saved yet" }),
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
    });
    renderAt("/measurements");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Weight (kg)"), "82.5");
    await user.type(screen.getByLabelText("Height (cm)"), "178");
    await user.type(screen.getByLabelText("Age"), "34");
    await user.selectOptions(screen.getByLabelText("Sex"), "female");
    await user.selectOptions(
      screen.getByLabelText("Activity level"),
      "moderate",
    );
    await user.click(
      screen.getByRole("button", { name: "Save and compute targets" }),
    );

    await expectFocusOn("Your targets");
  });

  it("deleting a recipe lands on Recipes", async () => {
    signedIn();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    stubFetch({
      "/recipes/7": async (init?: RequestInit) =>
        init?.method === "DELETE"
          ? new Response(null, { status: 204 })
          : jsonResponse(200, LAKSA),
      "/recipes": async () => jsonResponse(200, []),
    });
    renderAt("/recipes/7");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Delete this recipe" }));

    await expectFocusOn("Recipes");
  });

  it("signing out lands on Sign in", async () => {
    signedIn();
    stubFetch(dashboardStubs());
    renderAt("/dashboard");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Sign out" }));

    await expectFocusOn("Sign in");
  });

  it("deleting the account lands on the home page", async () => {
    signedIn();
    stubFetch({ "/profile": async () => new Response(null, { status: 204 }) });
    renderAt("/account/delete");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Password"), "kumara-42");
    await user.click(
      screen.getByRole("button", { name: "Delete your account" }),
    );

    await expectFocusOn("A week you can check before you cook.");
  });
});

describe("what does not move focus", () => {
  it("leaves focus alone on the first page drawn", async () => {
    stubFetch({});
    renderAt("/sign-in");

    await screen.findByRole("heading", { level: 1, name: "Sign in" });

    expect(document.body).toHaveFocus();
  });

  // The planner's week links, a recipe saved in place and a recipe created
  // from the list all stay on one pathname, and src/use-write.ts already puts
  // focus back for the writes among them.
  it("leaves focus alone when only the query string changes", async () => {
    stubFetch({});
    const { router } = renderAt("/sign-in");
    const field = await screen.findByLabelText("Username or email");

    field.focus();
    await act(() => router.navigate("/sign-in?created=1"));

    await screen.findByText("Account created. Sign in to start.");
    expect(field).toHaveFocus();
  });

  it("moves it on a link as well as after a write", async () => {
    stubFetch({});
    renderAt("/sign-in");

    await userEvent
      .setup()
      .click(await screen.findByRole("link", { name: "Create an account" }));

    await expectFocusOn("Create an account");
  });
});

// A live region inserted already holding its text is commonly not announced,
// which is why StatusRegion exists. The observable difference is the mutation:
// a region on the page before its text arrives sees a childList change of its
// own, and one inserted whole never does.
describe("the sentence a new account lands on", () => {
  it("arrives in a status region that was on the page before it", async () => {
    stubFetch({ "/register": async () => jsonResponse(201, { user_id: 1 }) });
    renderAt("/sign-up");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("First name"), "Aroha");
    await user.type(screen.getByLabelText("Last name"), "Tane");
    await user.type(screen.getByLabelText("Username"), "aroha");
    await user.type(screen.getByLabelText("Email"), "aroha@example.test");
    await user.type(screen.getByLabelText("Password"), "a-password");

    const changed: Node[] = [];
    const observer = new MutationObserver((records) =>
      records.forEach((record) => changed.push(record.target)),
    );
    observer.observe(document.body, { childList: true, subtree: true });

    await user.click(screen.getByRole("button", { name: "Create an account" }));

    const region = await screen.findByRole("status");

    await waitFor(() =>
      expect(region).toHaveTextContent("Account created. Sign in to start."),
    );
    observer.disconnect();

    expect(changed).toContain(region);
    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toHaveFocus();
  });
});
