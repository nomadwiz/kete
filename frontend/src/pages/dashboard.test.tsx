import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  jsonResponse,
  renderAt,
  stubFetch,
  summaryBody,
  TARGETS_BODY,
} from "../test/router";

// The dashboard compares the current week, so the clock is pinned and the
// week is a literal: Thursday 24 September 2026 is in 2026-W39, which
// ../api/week.test.ts pins. Computing it here with the function the loader
// calls would assert only that the loader called it.
const SUMMARY = "/mealplan/summary?week=2026-W39";

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
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

describe("the dashboard with targets saved", () => {
  it("draws the four figures in order, with the unit inside each value", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
      [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
    });

    renderAt("/dashboard");

    // By text and up to the list, not findByRole("term", { name }): the ARIA
    // term role takes no accessible name from its content, so that query
    // matches nothing however the markup is written.
    const list = (await screen.findByText("Daily energy")).closest("dl");

    expect(list).not.toBeNull();
    expect(
      Array.from(list!.querySelectorAll("dt")).map((dt) => dt.textContent),
    ).toEqual(["Daily energy", "Protein", "Carbs", "Fat"]);
    expect(
      Array.from(list!.querySelectorAll("dd")).map((dd) => dd.textContent),
    ).toEqual(["2,480 kcal", "186 g", "248 g", "83 g"]);
  });

  it("offers the three principal areas, each reaching its own address", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
      [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
    });

    renderAt("/dashboard");

    const areas = await screen.findByRole("navigation", { name: "Areas" });

    expect(
      within(areas)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/recipes", "/planner", "/account"]);
  });

  it("sends anyone asking where the figures come from to the targets screen", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
      [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
    });

    renderAt("/dashboard");

    expect(
      await screen.findByRole("link", { name: "How these are worked out" }),
    ).toHaveAttribute("href", "/targets");
  });
});

// C18 (nomadwiz/kete#182). The dashboard compares the week the person is in.
describe("the dashboard's week against targets", () => {
  it("asks for the summary of the current week", async () => {
    signedIn();
    const { calls } = stubFetch({
      "/targets": async () => jsonResponse(200, TARGETS_BODY),
      [SUMMARY]: async () => jsonResponse(200, summaryBody("2026-W39")),
    });

    renderAt("/dashboard");

    await screen.findByText("Daily energy");

    expect(calls).toContain(SUMMARY);
  });
});

describe("the dashboard with no measurements saved", () => {
  it("names what is missing and reaches the form, without announcing a failure", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(404, { detail: "No targets" }),
      [SUMMARY]: async () => jsonResponse(404, { detail: "No targets yet" }),
    });

    renderAt("/dashboard");

    expect(
      await screen.findByRole("link", { name: "Add your measurements" }),
    ).toHaveAttribute("href", "/measurements");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("keeps the shell's navigation, so the user is not stranded", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(404, { detail: "No targets" }),
      [SUMMARY]: async () => jsonResponse(404, { detail: "No targets yet" }),
    });

    renderAt("/dashboard");

    await screen.findByRole("link", { name: "Add your measurements" });

    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });

  it("still offers the three areas, because a hub that withholds itself is a redirect", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(404, { detail: "No targets" }),
      [SUMMARY]: async () => jsonResponse(404, { detail: "No targets yet" }),
    });

    renderAt("/dashboard");

    const areas = await screen.findByRole("navigation", { name: "Areas" });

    expect(within(areas).getAllByRole("link")).toHaveLength(3);
  });
});

describe("the dashboard when the API answers badly", () => {
  it("signs the user out on a 401 and lands them on sign in", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(401, { detail: "Expired" }),
      [SUMMARY]: async () => jsonResponse(401, { detail: "Expired" }),
    });

    const { router } = renderAt("/dashboard");

    await screen.findByRole("heading", { name: "Sign in" });

    expect(window.localStorage.getItem("kete.token")).toBeNull();
    expect(router.state.location.pathname).toBe("/sign-in");
  });

  // nomadwiz/kete#243. The boundary used to sit only on the outermost pathless
  // parent, so this rendered the message with no navigation at all and the
  // user could leave only by pressing Back.
  it("shows the error inside the shell, with the navigation still usable", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => {
        throw new TypeError("Failed to fetch");
      },
      [SUMMARY]: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    renderAt("/dashboard");

    expect(
      await screen.findByText(
        "The server could not be reached. Try again in a moment.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recipes" })).toBeInTheDocument();
  });
});
