import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch } from "../test/router";
import type { RecipeSummary } from "../types/recipe";

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Two rows, one carrying a photograph and one not, because photo_url is the
// only optional field on RecipeSummary and the card has to draw both. Spelled
// with `satisfies` on the same reasoning account.test.tsx gives: a field
// renamed in the contract fails the build here rather than leaving these
// assertions passing against a body the screen can no longer read.
const RECIPES = [
  {
    recipe_id: 1,
    name: "Laksa",
    cuisine: "Malaysian",
    energy_kcal: 1240,
    photo_url: "https://storage.test/laksa.jpg?signature=abc",
  },
  {
    recipe_id: 2,
    name: "Dal",
    cuisine: "Indian",
    energy_kcal: 430,
    photo_url: null,
  },
] satisfies RecipeSummary[];

function cardFor(name: string) {
  return screen.getByRole("heading", { name }).closest("li")!;
}

function openDialog() {
  return document.querySelector("dialog");
}

// The cards, and not the six list items AppLayout's navigation contributes to
// the same document -- getAllByRole("listitem") sees both, and a count taken
// across the page would move every time the shell gains a destination.
function cards() {
  return document.querySelectorAll(".recipes__card");
}

describe("the recipe list", () => {
  it("draws a card per recipe with its name, cuisine and energy", async () => {
    signedIn();
    stubFetch({ "/recipes": async () => jsonResponse(200, RECIPES) });

    renderAt("/recipes");

    expect(await screen.findByRole("heading", { name: "Laksa" })).toBeVisible();
    expect(cardFor("Laksa")).toHaveTextContent(
      "Malaysian · 1,240 kcal a serving",
    );
    expect(cardFor("Dal")).toHaveTextContent("Indian · 430 kcal a serving");
    expect(cards()).toHaveLength(2);
  });

  // photo_url is optional and nullable, so the absent case is a state the card
  // draws rather than an <img> pointed at nothing. An <img> with an empty or
  // missing src renders as a broken-image glyph in every browser, and this is
  // the assertion that catches a card built as one.
  it("draws a panel and no image for a recipe carrying no photograph", async () => {
    signedIn();
    stubFetch({ "/recipes": async () => jsonResponse(200, RECIPES) });

    renderAt("/recipes");

    await screen.findByRole("heading", { name: "Dal" });

    expect(cardFor("Dal").querySelector("img")).toBeNull();
    expect(cardFor("Laksa").querySelector("img")).toHaveAttribute(
      "src",
      RECIPES[0].photo_url,
    );

    // The photograph is decorative: the name is beside it, and a screen reader
    // reading a description of the dish straight after its name says the same
    // thing twice.
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("sends a user with nothing written to the form that writes one", async () => {
    signedIn();
    stubFetch({ "/recipes": async () => jsonResponse(200, []) });

    renderAt("/recipes");

    expect(
      await screen.findByRole("link", { name: "Write your first one" }),
    ).toHaveAttribute("href", "/recipes?new");
    expect(cards()).toHaveLength(0);
  });

  // A different sentence from the one above, and the difference is the whole
  // point: a search that matched nothing does not mean the library is empty,
  // and telling someone it is would be false on the evidence they can see.
  it("says nothing matched, not that nothing is written, after an empty search", async () => {
    signedIn();
    stubFetch({ "/recipes?q=laksa": async () => jsonResponse(200, []) });

    renderAt("/recipes?q=laksa");

    expect(await screen.findByText(/Nothing matches/)).toHaveTextContent(
      "Nothing matches “laksa”.",
    );
    expect(
      screen.getByRole("link", { name: "Show every recipe" }),
    ).toHaveAttribute("href", "/recipes");
  });

  // The assertion is the request, not what came back. A screen that fetched
  // every recipe and filtered the array here would render the same two cards
  // and pass any test written against the list -- so this stubs the searched
  // address alone, and stubFetch throws on any other, which sends a client
  // filter to the error boundary instead.
  it("asks the API for the search rather than filtering what it fetched", async () => {
    signedIn();
    const { calls } = stubFetch({
      "/recipes?q=laksa": async () => jsonResponse(200, [RECIPES[0]]),
    });

    renderAt("/recipes?q=laksa");

    await screen.findByRole("heading", { name: "Laksa" });

    expect(calls).toEqual(["/recipes?q=laksa"]);
    expect(screen.getByLabelText("Search your recipes")).toHaveValue("laksa");
  });

  // ADR 002's test, in the two halves it has. A fresh mount at ?new is a
  // refresh, and the form is there: nothing in this component remembers it.
  // The re-render is the other half -- the modal is not reopened, because it
  // was never closed and never reopened by anything but the address.
  it("opens the modal from the address and keeps it open across a re-render", async () => {
    signedIn();
    stubFetch({ "/recipes": async () => jsonResponse(200, RECIPES) });

    const { router, rerender } = renderAt("/recipes?new");

    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(openDialog()!.open).toBe(true);

    rerender(<RouterProvider router={router} />);

    expect(openDialog()!.open).toBe(true);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("leaves the modal shut at an address that does not ask for it", async () => {
    signedIn();
    stubFetch({ "/recipes": async () => jsonResponse(200, RECIPES) });

    renderAt("/recipes");

    await screen.findByRole("heading", { name: "Laksa" });

    expect(openDialog()!.open).toBe(false);
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  // The 422 POST /recipes declares, which is the one failure on this route the
  // person can answer by typing something else. The assertions are the form's
  // own role="alert" and the value still in the field, not the message text:
  // ErrorBoundary prints the same sentence, so a screen that threw this to the
  // boundary would satisfy a text assertion while having thrown away every
  // field the person filled in.
  it("shows a refused save inside the modal, with the typed values intact", async () => {
    signedIn();
    stubFetch({
      "/recipes": async (init?: RequestInit) =>
        init?.method === "POST"
          ? jsonResponse(422, { detail: "Energy must be a whole number." })
          : jsonResponse(200, []),
    });

    renderAt("/recipes?new");

    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Name"), "Laksa");
    await user.type(screen.getByLabelText("Cuisine"), "Malaysian");
    await user.type(screen.getByLabelText("Servings"), "4");
    await user.type(screen.getByLabelText("Energy (kcal)"), "1240");
    await user.type(screen.getByLabelText("Protein (g)"), "38");
    await user.type(screen.getByLabelText("Carbohydrate (g)"), "96");
    await user.type(screen.getByLabelText("Fat (g)"), "44");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));

    const refusal = await screen.findByRole("alert");

    expect(refusal).toHaveTextContent("Energy must be a whole number.");
    expect(refusal.closest("form")).toHaveClass("recipe-form");
    expect(openDialog()!.open).toBe(true);
    expect(screen.getByLabelText("Name")).toHaveValue("Laksa");
    expect(screen.getByLabelText("Energy (kcal)")).toHaveValue(1240);
  });
});
