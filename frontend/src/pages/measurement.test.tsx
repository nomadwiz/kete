import { screen } from "@testing-library/react";
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
