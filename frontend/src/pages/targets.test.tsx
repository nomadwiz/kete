import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  jsonResponse,
  renderAt,
  stubFetch,
  TARGETS_BODY,
} from "../test/router";

// The checks C9 drove in headless Chrome against a stub kept outside both
// repositories, brought into the runner so they survive the branch that built
// the screen. Two of that set are not here and cannot be: no horizontal
// overflow at 375px and at 320px are layout assertions, and jsdom has no
// layout engine -- every element measures zero. Those stay manual.

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the targets screen", () => {
  it("draws the four labels verbatim and in order", async () => {
    signedIn();
    stubFetch({ "/targets": async () => jsonResponse(200, TARGETS_BODY) });

    renderAt("/targets");

    const list = (await screen.findByText("Daily energy")).closest("dl");

    expect(
      Array.from(list!.querySelectorAll("dt")).map((dt) => dt.textContent),
    ).toEqual(["Daily energy", "Protein", "Carbs", "Fat"]);
  });

  it("draws the four values as sent, with the unit inside and a comma in the energy", async () => {
    signedIn();
    stubFetch({ "/targets": async () => jsonResponse(200, TARGETS_BODY) });

    renderAt("/targets");

    const list = (await screen.findByText("Daily energy")).closest("dl");

    expect(
      Array.from(list!.querySelectorAll("dd")).map((dd) => dd.textContent),
    ).toEqual(["2,480 kcal", "186 g", "248 g", "83 g"]);
  });

  it("writes the timestamp dd-mm-yyyy HH:MM, on a fixed locale", async () => {
    signedIn();
    stubFetch({ "/targets": async () => jsonResponse(200, TARGETS_BODY) });

    renderAt("/targets");

    // 09:14 UTC on 25-09-2026 is 21:14 in Auckland: New Zealand daylight time
    // begins on the last Sunday of September, which is the 27th that year, so
    // the offset is +12 and not +13.
    expect(
      await screen.findByText("Worked out 25-09-2026 21:14"),
    ).toBeInTheDocument();

    // And independently of the literal above, in case the pinned zone ever
    // moves: en-GB orders the parts the same way, so the same instant
    // rearranged from a different formatter has to agree.
    const [date, time] = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(new Date(TARGETS_BODY.computed_at))
      .split(", ");

    expect(
      screen.getByText(`Worked out ${date.replaceAll("/", "-")} ${time}`),
    ).toBeInTheDocument();
  });

  it("drops the timestamp line when the API sends none, and keeps the figures", async () => {
    signedIn();
    stubFetch({
      "/targets": async () =>
        jsonResponse(200, { ...TARGETS_BODY, computed_at: null }),
    });

    renderAt("/targets");

    const list = (await screen.findByText("Daily energy")).closest("dl");

    expect(list!.querySelectorAll("dd")).toHaveLength(4);
    expect(screen.queryByText(/^Worked out/)).not.toBeInTheDocument();
  });

  // The note stops before saying how the day's energy is divided, because
  // MACRO_SPLIT in backend/main.py is uncited -- nomadwiz/kete#251. A digit
  // appearing here is the defect that check exists to catch: on screen and in
  // a report screenshot it would read exactly like a sourced figure.
  it("says where the figures come from without printing a single digit", async () => {
    signedIn();
    stubFetch({ "/targets": async () => jsonResponse(200, TARGETS_BODY) });

    renderAt("/targets");

    const note = await screen.findByText(/^Kete worked these out/);

    expect(note.textContent).not.toMatch(/\d/);
  });

  it("names the missing measurements on a 404, without announcing a failure", async () => {
    signedIn();
    stubFetch({
      "/targets": async () => jsonResponse(404, { detail: "No targets" }),
    });

    renderAt("/targets");

    expect(
      await screen.findByRole("link", { name: "Add your measurements" }),
    ).toHaveAttribute("href", "/measurements");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });
});
