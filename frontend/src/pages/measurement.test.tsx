import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch } from "../test/router";
import type { Metrics } from "../types/measurement";

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// The five fields MetricsOut answers with, spelled as backend/openapi.json
// spells them. Local to this file rather than beside TARGETS_BODY in
// src/test/router.tsx: one screen reads them, and the shared helper carries
// only what more than one file needs. `satisfies` rather than a bare object,
// so a field renamed in the type is a build failure here -- these assertions
// would otherwise still pass against a body the screen can no longer read.
const METRICS_BODY = {
  weight_kg: 82.5,
  height_cm: 178,
  age: 34,
  sex: "female",
  activity_level: "moderate",
} satisfies Metrics;

describe("the measurements form with values saved", () => {
  it("prefills all five controls from what the API answered", async () => {
    signedIn();
    stubFetch({
      "/profile/metrics": async () => jsonResponse(200, METRICS_BODY),
    });

    renderAt("/measurements");

    expect(await screen.findByLabelText("Weight (kg)")).toHaveValue(82.5);
    expect(screen.getByLabelText("Height (cm)")).toHaveValue(178);
    expect(screen.getByLabelText("Age")).toHaveValue(34);
    expect(screen.getByLabelText("Sex")).toHaveValue("female");
    expect(screen.getByLabelText("Activity level")).toHaveValue("moderate");
  });
});

// The status the form is built on. GET /profile/metrics answers 404 until
// something has been saved, which backend/main.py declares as a state rather
// than a failure, and a first-time visitor meeting an error page on the form
// they were sent to fill in is the defect this covers.
describe("the measurements form with nothing saved", () => {
  it("draws the empty form on a 404 rather than an error", async () => {
    signedIn();
    stubFetch({
      "/profile/metrics": async () =>
        jsonResponse(404, { detail: "No measurements saved" }),
    });

    renderAt("/measurements");

    expect(
      await screen.findByRole("button", { name: "Save and compute targets" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Weight (kg)")).toHaveValue(null);
    expect(screen.getByLabelText("Sex")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });
});

// GET answers the saved measurements, POST answers whatever the test asks
// for. One path, two methods, which is why stubFetch hands the init to its
// handlers -- the write's statuses mean different things from the read's, and
// a stub that could not tell them apart could not test the difference.
function stubMetrics(post: () => Promise<Response>) {
  return stubFetch({
    "/profile/metrics": async (init?: RequestInit) =>
      init?.method === "POST" ? post() : jsonResponse(200, METRICS_BODY),
  });
}

async function amendWeight(to: string) {
  const user = userEvent.setup();
  const weight = await screen.findByLabelText("Weight (kg)");

  await user.clear(weight);
  await user.type(weight, to);
  await user.click(
    screen.getByRole("button", { name: "Save and compute targets" }),
  );
}

// The two sides of one rule, and the reason the write does not share the
// read's catch. POST /profile/metrics declares 401, 404 and 422; the 401 is
// withSession's, so the screen's own choice is between the other two.
describe("the measurements form refused by the write", () => {
  // A catch taking every ApiError returned the 404's message, and
  // "The account behind the token no longer exists" was printed as an inline
  // validation message above a Save button that could never work. The
  // assertion is not the sentence -- ErrorBoundary prints what it caught too,
  // so a version that returned it would render the same words. What only the
  // form renders is its own role="alert", and that must be absent here.
  it("sends a 404 from the write to the error boundary", async () => {
    signedIn();
    stubMetrics(async () =>
      jsonResponse(404, {
        detail: "The account behind the token no longer exists",
      }),
    );

    renderAt("/measurements");

    await amendWeight("90.5");

    expect(await screen.findByText("Status 404.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // The other side. A narrowing that went too far -- rethrowing everything,
  // or matching the loader's 404 instead -- would take the page and the five
  // typed figures to the boundary for a status the person can answer by
  // typing a different one. So the message is the form's own alert, the
  // fields still carry what was typed, and the address never left
  // /measurements for the /targets a save redirects to.
  it("shows a 422 above the form with the typed values intact", async () => {
    signedIn();
    stubMetrics(async () =>
      jsonResponse(422, { detail: "Weight must be greater than zero" }),
    );

    const { router } = renderAt("/measurements");

    await amendWeight("90.5");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Weight must be greater than zero",
    );
    expect(screen.getByLabelText("Weight (kg)")).toHaveValue(90.5);
    expect(screen.getByLabelText("Age")).toHaveValue(34);
    expect(router.state.location.pathname).toBe("/measurements");
  });
});
