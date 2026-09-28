import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch } from "../test/router";

// Every test that draws the grid names its week in the address. A test that
// let the screen choose would key its fetch stub on whichever week today falls
// in, pass this fortnight and fail the next -- and the one place a week is
// computed is tested on its own, in ../api/week.test.ts.
const WEEK = "2026-W39";
const PLAN = `/mealplan?week=${WEEK}`;

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

const SOUP = {
  recipe_id: 3,
  name: "Kumara and lentil soup",
  energy_kcal: 540,
  protein_g: 22,
  carbs_g: 71,
  fat_g: 16,
};

const FRITTERS = {
  recipe_id: 4,
  name: "Corn fritters",
  energy_kcal: 1240,
  protein_g: 31,
  carbs_g: 96,
  fat_g: 58,
};

// PlanSlotOut carries no week: these are in the week that was asked for
// because that is the question they answered.
const SLOTS = [
  { slot_id: 7, day_of_week: "Tue", meal_position: "lunch", recipe: SOUP },
  { slot_id: 8, day_of_week: "Sun", meal_position: "dinner", recipe: FRITTERS },
];

// RecipeSummary, which is a different shape from the PlanRecipe above: cuisine
// and a photo, and only the one nutrition figure.
const LIBRARY = [
  { ...SOUP, cuisine: "New Zealand", photo_url: null },
  { ...FRITTERS, cuisine: "American", photo_url: null },
];

// The three cells of one day, left to right, which is breakfast, lunch and
// dinner. The day's own <th scope="row"> is a rowheader and not a cell, so it
// is not among them -- and finding the row through it is the assertion that
// the header is a header.
function cellsOf(day: string) {
  const row = screen
    .getByRole("rowheader", { name: new RegExp(`^${day}`) })
    .closest("tr");

  return within(row!).getAllByRole("cell");
}

// The body of the one POST among the calls. It cannot be the last call:
// React Router revalidates the loader as soon as the action returns, so two
// GETs follow it.
function postedBody(calls: [RequestInfo | URL, RequestInit?][]): unknown {
  const posted = calls.find((call) => call[1]?.method === "POST");

  return JSON.parse(String(posted![1]!.body));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a week with recipes in it", () => {
  it("draws each recipe in its own day and meal, and nowhere else", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    // By the row header rather than by the recipe's name: the name is also in
    // every one of the twenty selects offering it, so a text query for it
    // matches twenty-one elements.
    await screen.findByRole("rowheader", { name: /^Tuesday/ });

    // Tuesday lunch is the second of Tuesday's three cells, and Sunday dinner
    // the third of Sunday's. Both are asserted, because a grid that put every
    // slot in the first cell of the right row would satisfy either on its own.
    expect(cellsOf("Tuesday")[1]).toHaveTextContent("Kumara and lentil soup");
    expect(cellsOf("Sunday")[2]).toHaveTextContent("Corn fritters");

    // And the neighbouring positions of the same row are empty. The test is
    // whether the cell offers a choice or holds one: a text query cannot
    // answer it, because an empty cell's select lists every recipe by name.
    expect(
      within(cellsOf("Tuesday")[1]).queryByRole("combobox"),
    ).not.toBeInTheDocument();
    expect(
      within(cellsOf("Tuesday")[0]).getByRole("combobox"),
    ).toBeInTheDocument();
    expect(
      within(cellsOf("Tuesday")[2]).getByRole("combobox"),
    ).toBeInTheDocument();
  });

  it("prints the energy the server sent, and sums nothing", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    expect(await screen.findByText("1,240 kcal")).toBeInTheDocument();

    // 540 and 1240 come to 1780. The client never computes a nutrition figure
    // -- implementation.md section 1 -- and the totals against targets are C18
    // (nomadwiz/kete#182), so no total of any pair of these may appear.
    expect(screen.queryByText(/1,780/)).not.toBeInTheDocument();
  });

  it("removes a placed recipe by its own slot id, over a reply with no body", async () => {
    signedIn();
    const { calls } = stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      // 204, and genuinely empty. Reading it as JSON throws, which is what
      // http.ts returning undefined for that status exists to prevent.
      "/mealplan/7": async () => new Response(null, { status: 204 }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Remove Kumara and lentil soup from Tuesday lunch",
      }),
    );

    expect(calls).toContain("/mealplan/7");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("placing a recipe", () => {
  it("names the week, the day and the meal the position stands for", async () => {
    signedIn();
    const { calls, fetchStub } = stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () => jsonResponse(201, { slot_id: 9 }),
    });

    renderAt(`/planner?week=${WEEK}`);

    const user = userEvent.setup();

    await user.selectOptions(
      await screen.findByLabelText("Recipe for Monday breakfast"),
      "3",
    );
    await user.click(
      screen.getByRole("button", { name: "Add a recipe to Monday breakfast" }),
    );

    await vi.waitFor(() => expect(calls).toContain("/mealplan"));

    // The week is the field the answer never carries back, so it is the one
    // most easily left out of the request.
    expect(postedBody(fetchStub.mock.calls)).toEqual({
      recipe_id: 3,
      week: WEEK,
      day_of_week: "Mon",
      meal_position: "breakfast",
    });
  });

  // The guard against a second click, which is not cosmetic: the first POST
  // has usually been committed by the time the second is sent, so the second
  // is answered 409 and the person is told the position was already filled by
  // the very click that filled it.
  it("refuses a second click while the first is still in flight", async () => {
    signedIn();

    // The POST is held open, so the screen stays in the state under test
    // rather than passing through it.
    let answer = () => {};
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });

    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () => {
        await held;

        return jsonResponse(201, { slot_id: 9 });
      },
    });

    renderAt(`/planner?week=${WEEK}`);

    const user = userEvent.setup();
    const add = () =>
      screen.getByRole("button", { name: "Add a recipe to Monday breakfast" });

    await user.selectOptions(
      await screen.findByLabelText("Recipe for Monday breakfast"),
      "3",
    );
    await user.click(add());

    await vi.waitFor(() => expect(add()).toBeDisabled());

    // Every other position too: one request is in flight, not one cell.
    expect(
      screen.getByRole("button", { name: "Add a recipe to Sunday dinner" }),
    ).toBeDisabled();

    answer();
    await vi.waitFor(() => expect(add()).toBeEnabled());
  });

  it("shows the server's own sentence when the position was filled first", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () =>
        jsonResponse(409, { detail: "That day and meal is already filled" }),
    });

    renderAt(`/planner?week=${WEEK}`);

    const user = userEvent.setup();

    await user.selectOptions(
      await screen.findByLabelText("Recipe for Monday breakfast"),
      "3",
    );
    await user.click(
      screen.getByRole("button", { name: "Add a recipe to Monday breakfast" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That day and meal is already filled",
    );
  });

  // The other half of the narrowing: only 409 and 422 come back as a message.
  // A 404 means the recipe has gone or was never this account's, which no
  // second Add can put right, so printing it above the grid would invite one.
  it("sends a failure the grid cannot answer to the error boundary", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () => jsonResponse(404, { detail: "No such recipe" }),
    });

    renderAt(`/planner?week=${WEEK}`);

    const user = userEvent.setup();

    await user.selectOptions(
      await screen.findByLabelText("Recipe for Monday breakfast"),
      "3",
    );
    await user.click(
      screen.getByRole("button", { name: "Add a recipe to Monday breakfast" }),
    );

    expect(await screen.findByText("Status 404.")).toBeInTheDocument();

    // Inside the shell, per ADR 003: the boundary mounted within AppLayout is
    // what keeps the navigation under a failed page.
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });
});

describe("a week with nothing in it", () => {
  it("says so, and still offers all twenty-one positions", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    expect(
      await screen.findByText(/Nothing is planned for this week yet/),
    ).toBeInTheDocument();

    // An empty week is an empty array and not a 404, so nothing here is an
    // error and the grid is still the thing you fill the week from.
    expect(screen.getAllByRole("combobox")).toHaveLength(21);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends someone with no recipes at all to write one first", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, []),
    });

    renderAt(`/planner?week=${WEEK}`);

    expect(
      await screen.findByRole("link", { name: "Write your first recipe" }),
    ).toHaveAttribute("href", "/recipes");

    // Offering twenty-one choices of nothing is worse than offering none.
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });
});

describe("moving between weeks", () => {
  // 2026-W52 is the week before a 53rd, which is the step a week number
  // incremented by hand gets wrong. The page and the helper agree here or the
  // links point a year away.
  it("steps to the week either side, in the address", async () => {
    signedIn();
    stubFetch({
      "/mealplan?week=2026-W52": async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt("/planner?week=2026-W52");

    const weeks = await screen.findByRole("navigation", { name: "Week" });

    expect(
      within(weeks)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/planner?week=2026-W51", "/planner?week=2026-W53"]);
  });
});

// Both of these land on whichever week is current, so the clock is pinned and
// the expected value is a literal. Computing it here with the same function
// the loader calls would assert only that the loader called it. Thursday
// 24 September 2026 is in 2026-W39, which ../api/week.test.ts pins.
describe("a week the address gets wrong", () => {
  beforeEach(() => {
    // Only Date. Testing Library waits on real timers, and faking those hangs
    // the first query that has to wait for anything.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 24));
  });

  it("turns away a week number no year has", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    const { router } = renderAt("/planner?week=2026-W99");

    await screen.findByRole("navigation", { name: "Week" });

    // Rather than drawing this week under an address that names another, and
    // rather than passing it on to be answered 422.
    expect(router.state.location.search).toBe(`?week=${WEEK}`);
  });

  // The harder half, and the one a pattern cannot catch: 2025-W53 matches the
  // expression the API enforces and names the seven days that belong to
  // 2026-W01. Left alone it is a second address for the same week, holding a
  // different plan that nothing can navigate back to.
  it("turns away a 53rd week in a year that has 52", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    const { router } = renderAt("/planner?week=2025-W53");

    await screen.findByRole("navigation", { name: "Week" });

    expect(router.state.location.search).toBe(`?week=${WEEK}`);
  });
});
