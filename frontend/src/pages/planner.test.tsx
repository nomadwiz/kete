import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch, summaryBody } from "../test/router";

// Every test that draws the grid names its week in the address. A test that
// let the screen choose would key its fetch stub on whichever week today falls
// in, pass this fortnight and fail the next -- and the one place a week is
// computed is tested on its own, in ../api/week.test.ts.
const WEEK = "2026-W39";
const PLAN = `/mealplan?week=${WEEK}`;
const SUMMARY = `/mealplan/summary?week=${WEEK}`;

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
//
// Within the grid, by its caption: the totals panel under it has a row header
// for every day as well.
function cellsOf(day: string) {
  const row = within(screen.getByRole("table", { name: /^Seven days/ }))
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
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    // By the grid rather than by the recipe's name: the name is also in every
    // one of the twenty selects offering it, so a text query for it matches
    // twenty-one elements.
    await screen.findByRole("table", { name: /^Seven days/ });

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
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
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
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
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
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
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
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
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

    // And the whole-week action above the grid, which would otherwise discard
    // the placement now in flight.
    expect(
      screen.getByRole("button", { name: "Fill the week from your library" }),
    ).toBeDisabled();

    answer();
    await vi.waitFor(() => expect(add()).toBeEnabled());
  });

  it("shows the server's own sentence when the position was filled first", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
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

  // The 404 on this route is "No such recipe, or it belongs to another
  // account" -- one stale row, with the session and the week both intact, and
  // the revalidation that follows repairs the grid by itself. So it belongs
  // above the grid with the other two and not at the error boundary, which
  // would take the whole week away because a recipe was deleted in a second
  // tab. It is not the 404 profileAction sends to the boundary.
  it("keeps a stale recipe on the page rather than at the error boundary", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () =>
        jsonResponse(404, {
          detail: "No such recipe, or it belongs to another account",
        }),
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
      "No such recipe, or it belongs to another account",
    );

    // The grid is still there and still offers the position.
    expect(
      screen.getByLabelText("Recipe for Monday breakfast"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  // And a status the contract does not declare still goes to the boundary, so
  // the widening above is three named codes and not a shrug.
  it("sends an undeclared failure to the error boundary", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () => jsonResponse(500, { detail: "Server error" }),
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

    expect(await screen.findByText("Status 500.")).toBeInTheDocument();

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
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    expect(
      await screen.findByText(/Nothing is planned for this week yet/),
    ).toBeInTheDocument();

    // An empty week is an empty array and not a 404, so nothing here is an
    // error and the grid is still the thing you fill the week from.
    expect(screen.getAllByRole("combobox")).toHaveLength(21);

    // Filling it is offered; clearing what is not there is not.
    expect(
      screen.getByRole("button", { name: "Fill the week from your library" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear the week" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends someone with no recipes at all to write one first", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, []),
    });

    renderAt(`/planner?week=${WEEK}`);

    expect(
      await screen.findByRole("link", { name: "Write your first recipe" }),
    ).toHaveAttribute("href", "/recipes");

    // Offering twenty-one choices of nothing is worse than offering none,
    // and so is a button that fills a week from a library with nothing in it.
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Fill the week from your library" }),
    ).not.toBeInTheDocument();
  });
});

describe("moving between weeks", () => {
  // The clock is pinned because the middle link addresses whichever week is
  // current. Thursday 24 September 2026 is in 2026-W39, which
  // ../api/week.test.ts pins.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 24));
  });

  // 2026-W52 is the week before a 53rd, which is the step a week number
  // incremented by hand gets wrong. The page and the helper agree here or the
  // links point a year away.
  it("steps to the week either side, and back to the current one", async () => {
    signedIn();
    stubFetch({
      "/mealplan?week=2026-W52": async () => jsonResponse(200, []),
      "/mealplan/summary?week=2026-W52": async () =>
        jsonResponse(200, summaryBody("2026-W52")),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt("/planner?week=2026-W52");

    const weeks = await screen.findByRole("navigation", { name: "Week" });

    expect(
      within(weeks)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/planner?week=2026-W51",
      `/planner?week=${WEEK}`,
      "/planner?week=2026-W53",
    ]);
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
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
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
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    const { router } = renderAt("/planner?week=2025-W53");

    await screen.findByRole("navigation", { name: "Week" });

    expect(router.state.location.search).toBe(`?week=${WEEK}`);
  });
});

// Every position of the week, so the grid after a generate can be asserted by
// the absence of a choice rather than by counting names: a filled cell offers
// no select, and twenty-one of them offer none between them.
const FULL_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].flatMap(
  (day, d) =>
    ["breakfast", "lunch", "dinner"].map((meal, m) => ({
      slot_id: d * 3 + m + 1,
      day_of_week: day,
      meal_position: meal,
      // Alternating only so the two fixtures both appear. Nothing here
      // asserts the order: the server does the dealing, and a client-side
      // assertion about it would assert the fixture.
      recipe: (d * 3 + m) % 2 === 0 ? SOUP : FRITTERS,
    })),
);

// window.confirm is the confirmation this screen puts in front of both
// destructive actions, so a test that does not answer it gets jsdom's
// unimplemented stub, which returns undefined and silently declines.
function stubConfirm(answer: boolean) {
  // Typed as window.confirm is rather than as a bare () => boolean, so the
  // message the screen passed can be read back off mock.calls: a vi.fn with no
  // declared parameter records an empty tuple and indexing it does not compile.
  const confirmStub = vi.fn<(message?: string) => boolean>(() => answer);

  vi.stubGlobal("confirm", confirmStub);

  return confirmStub;
}

describe("filling a whole week from the library", () => {
  it("fills every position, naming the week the screen is showing", async () => {
    signedIn();
    stubConfirm(true);

    let plan: unknown[] = [];
    const { fetchStub } = stubFetch({
      [PLAN]: async () => jsonResponse(200, plan),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan/generate": async () => {
        plan = FULL_WEEK;

        return jsonResponse(201, { created: 21 });
      },
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Fill the week from your library",
      }),
    );

    // Every cell holds a recipe, so not one of them offers a choice.
    await vi.waitFor(() =>
      expect(screen.queryAllByRole("combobox")).toHaveLength(0),
    );

    expect(cellsOf("Tuesday")[1]).toHaveTextContent(/soup|fritters/i);

    // The week the person was looking at, not one recomputed inside the
    // action: the body is the only place the server learns which it is.
    expect(postedBody(fetchStub.mock.calls)).toEqual({ week: WEEK });
  });

  it("says the week is replaced, and does not claim the recipes are chosen for you", async () => {
    signedIn();
    const confirmStub = stubConfirm(true);

    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan/generate": async () => jsonResponse(201, { created: 21 }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Fill the week from your library",
      }),
    );

    const asked = String(confirmStub.mock.calls[0]?.[0]);

    // backend/main.py clears the week before it deals, and always answers
    // created: 21. A confirmation that did not say so would lose a planned
    // week to a button whose label reads like an addition.
    expect(asked).toContain(WEEK);
    expect(asked).toMatch(/already planned for this week is replaced/);

    // And it may not imply the week is balanced against the targets. The
    // 15-09-2026 decision puts choosing recipes to hit them out of scope, and
    // the server deals them out without reading them.
    expect(asked).toMatch(/none is chosen to meet your targets/);
    expect(asked).not.toMatch(/balanc|optimis|for you|match/i);
  });

  it("sends nothing at all when the confirmation is declined", async () => {
    signedIn();
    stubConfirm(false);

    // /mealplan/generate is deliberately not stubbed: stubFetch throws on an
    // unstubbed path, so a request made here fails the test by name.
    const { calls } = stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Fill the week from your library",
      }),
    );

    expect(calls).not.toContain("/mealplan/generate");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // POST /mealplan/generate declares 400 and 409 and no 404, and the 400's own
  // sentence names the thing to do about it. The library was there when the
  // loader read it, so this is the second-tab case the 409 above is: the
  // session and the week are both intact and the revalidation repairs the
  // page.
  it("keeps an emptied library on the page rather than at the error boundary", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan/generate": async () =>
        jsonResponse(400, {
          detail:
            "Add at least one recipe before generating a week",
        }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Fill the week from your library",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add at least one recipe before generating a week",
    );
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  // And a status this route does not declare still goes to the boundary, so
  // the 400 above is a named code and not a widening to every failure.
  it("sends an undeclared failure to the error boundary", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan/generate": async () =>
        jsonResponse(500, { detail: "Server error" }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Fill the week from your library",
      }),
    );

    expect(await screen.findByText("Status 500.")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });
});

describe("clearing a week", () => {
  it("empties the week over a reply with no body, and says so afterwards", async () => {
    signedIn();
    const confirmStub = stubConfirm(true);

    let plan: unknown[] = SLOTS;
    const { calls, fetchStub } = stubFetch({
      [PLAN]: async () => jsonResponse(200, plan),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      // 204 and genuinely empty, as DELETE /mealplan/{slot_id} is. The week
      // travels in the path, so the address is the assertion.
      [`/mealplan/week/${WEEK}`]: async () => {
        plan = [];

        return new Response(null, { status: 204 });
      },
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Clear the week" }));

    expect(
      await screen.findByText(/Nothing is planned for this week yet/),
    ).toBeInTheDocument();

    expect(calls).toContain(`/mealplan/week/${WEEK}`);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // The method as well as the address. `calls` records the path alone, and
    // the stub answers 204 whatever the method is, so without this a GET to
    // the same address passes -- and a GET is exactly what a clear that read
    // its reply would have to be.
    const cleared = fetchStub.mock.calls.find((call) =>
      String(call[0]).endsWith(`/mealplan/week/${WEEK}`),
    );

    expect(cleared?.[1]?.method).toBe("DELETE");

    // Clearing is as destructive as generating and has no undo, so it is
    // asked the same question -- and the answer names what survives it.
    const asked = String(confirmStub.mock.calls[0]?.[0]);

    expect(asked).toContain(WEEK);
    expect(asked).toMatch(/recipes are not touched/);
  });
});

// The one row of the table this change altered outside its own two branches.
// DELETE /mealplan/{slot_id} declares 204, 401, 404 and 422 and no 409, so a
// 409 from it is a failure nobody predicted rather than a position somebody
// else filled -- and the sentence that would otherwise be printed above the
// grid invites a second Remove that cannot work either.
describe("removing a slot", () => {
  it("sends an undeclared 409 to the error boundary", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan/7": async () =>
        jsonResponse(409, { detail: "That day and meal is already filled" }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Remove Kumara and lentil soup from Tuesday lunch",
      }),
    );

    expect(await screen.findByText("Status 409.")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });
});

describe("more of what filling a week answers for", () => {
  // The other half of generate's row, and the status the confirmation's own
  // double click produces. Without it the row could lose its 409 and every
  // other test would still pass.
  it("shows the server's own sentence when the week moved under the request", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan/generate": async () =>
        jsonResponse(409, {
          detail: "That week changed while it was being generated — try again",
        }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Fill the week from your library",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That week changed while it was being generated — try again",
    );
  });

  // A recipe deleted in another tab between the library read and the slot
  // insert is a 409 here, not a 404: a retry rereads the library and
  // succeeds (nomadwiz/kete#295). It must not reach the boundary.
  it("shows the server's own sentence when a recipe was deleted under the request", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan/generate": async () =>
        jsonResponse(409, {
          detail:
            "A recipe was deleted while the week was being generated — try again",
        }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Fill the week from your library",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A recipe was deleted while the week was being generated",
    );
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});

describe("what clearing a week answers for", () => {
  // DELETE /mealplan/week/{week} declares 401 and 422 and nothing else, so 422
  // is the whole of that intent's row. Untested, the row could be empty and
  // every other test would still pass.
  it("keeps a refused week on the page rather than at the error boundary", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      [`/mealplan/week/${WEEK}`]: async () =>
        jsonResponse(422, { detail: "week: string does not match pattern" }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Clear the week" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "does not match pattern",
    );
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("sends an undeclared failure to the error boundary", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      [`/mealplan/week/${WEEK}`]: async () =>
        jsonResponse(500, { detail: "Server error" }),
    });

    renderAt(`/planner?week=${WEEK}`);

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Clear the week" }));

    expect(await screen.findByText("Status 500.")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });
});

// C18 (nomadwiz/kete#182). The totals come from GET /mealplan/summary, which
// does the arithmetic -- ADR 001 -- so the loader asks for them beside the
// week, for the week the address names.
describe("the week's totals against targets", () => {
  it("asks for the summary of the week on screen", async () => {
    signedIn();
    const { calls } = stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    await screen.findByRole("table", { name: /^Seven days/ });

    expect(calls).toContain(SUMMARY);
  });

  // ADR 004: GET /mealplan/summary answers 404 until measurements are saved,
  // which is a state. The week can still be planned without targets, so the
  // grid draws and nothing announces a failure.
  it("still draws the week when no measurements are saved", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      [SUMMARY]: async () => jsonResponse(404, { detail: "No targets yet" }),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    expect(
      await screen.findByRole("table", { name: /^Seven days/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});

// The panel under the grid: one table per nutrient, a row per day, and the
// four figures the server sent. product.md section 3: figures, no verdict.
describe("the totals panel", () => {
  // The cells of one day's row in one nutrient's table, after its row header:
  // total, target, difference and percent of target.
  function figuresOf(caption: string, day: string) {
    const table = screen.getByRole("table", { name: caption });
    const row = within(table)
      .getByRole("rowheader", { name: day })
      .closest("tr");

    return within(row!)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
  }

  it("draws one table per nutrient, a row per day and a column per figure", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    const energy = await screen.findByRole("table", { name: "Energy (kcal)" });

    for (const caption of ["Protein (g)", "Carbohydrate (g)", "Fat (g)"]) {
      expect(screen.getByRole("table", { name: caption })).toBeInTheDocument();
    }
    expect(
      within(energy)
        .getAllByRole("rowheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(
      within(energy)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Total", "Target", "Difference", "% of target"]);
  });

  // The server's figures are deliberately not the sum of SLOTS: Tuesday's slot
  // carries 540 kcal and the summary says 999. A screen that added up the slots
  // would print 540.
  it("prints the server's figures as sent, with the difference signed", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      [SUMMARY]: async () =>
        jsonResponse(
          200,
          summaryBody(WEEK, {
            Tue: [999, 22, 71, 16],
            Sun: [2600, 186, 96, 58],
          }),
        ),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    await screen.findByRole("table", { name: "Energy (kcal)" });

    expect(figuresOf("Energy (kcal)", "Tuesday")).toEqual([
      "999",
      "2,480",
      "-1,481",
      "40%",
    ]);
    expect(figuresOf("Energy (kcal)", "Sunday")).toEqual([
      "2,600",
      "2,480",
      "+120",
      "105%",
    ]);
    // On target exactly carries no sign at all.
    expect(figuresOf("Protein (g)", "Sunday")).toEqual([
      "186",
      "186",
      "0",
      "100%",
    ]);
  });

  // ADR 001: an empty day is a result. Its figures are printed as the server
  // sent them, and nothing is added to say the week is empty.
  it("prints an empty day's zeros and full shortfall as sent", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, []),
      [SUMMARY]: async () => jsonResponse(200, summaryBody(WEEK)),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    await screen.findByRole("table", { name: "Fat (g)" });

    expect(figuresOf("Fat (g)", "Monday")).toEqual(["0", "83", "-83", "0%"]);
  });

  it("says what is missing where the panel would be, when no measurements are saved", async () => {
    signedIn();
    stubFetch({
      [PLAN]: async () => jsonResponse(200, SLOTS),
      [SUMMARY]: async () => jsonResponse(404, { detail: "No targets yet" }),
      "/recipes": async () => jsonResponse(200, LIBRARY),
    });

    renderAt(`/planner?week=${WEEK}`);

    expect(
      await screen.findByRole("link", { name: "Add your measurements" }),
    ).toHaveAttribute("href", "/measurements");
    expect(
      screen.queryByRole("table", { name: "Energy (kcal)" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
