import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PATHS } from "../routes";
import { jsonResponse, renderAt, stubFetch, submitTo } from "../test/router";
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

    // Each fact on its own, rather than the single string the two used to be
    // joined into. C30 (nomadwiz/kete#303) split them onto separate lines:
    // "A \u00b7 B" is template chrome that appears whatever the subject, and it
    // truncates badly when a cuisine name is long. What this test is for --
    // its own name says so -- is that the name, the cuisine and the energy all
    // reach the card, and that is what it now asserts. The punctuation between
    // them was never the subject.
    expect(cardFor("Laksa")).toHaveTextContent("Malaysian");
    expect(cardFor("Laksa")).toHaveTextContent("1,240 kcal a serving");
    expect(cardFor("Dal")).toHaveTextContent("Indian");
    expect(cardFor("Dal")).toHaveTextContent("430 kcal a serving");
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

  // Without this the recipe detail page is reachable only by typing an address.
  // C11 (nomadwiz/kete#176) left the link to C12 (nomadwiz/kete#177), which
  // owns that page. The href is asserted rather than followed: the destination
  // has its own tests, and what this screen owes is the correct address.
  it("opens a recipe from its card", async () => {
    signedIn();
    stubFetch({ "/recipes": async () => jsonResponse(200, RECIPES) });

    renderAt("/recipes");

    expect(await screen.findByRole("link", { name: "Laksa" })).toHaveAttribute(
      "href",
      "/recipes/1",
    );
    expect(screen.getByRole("link", { name: "Dal" })).toHaveAttribute(
      "href",
      "/recipes/2",
    );

    // On the name and not around the whole card: a card-sized anchor takes the
    // photograph and the figures into its own accessible name, and a screen
    // reader then reads the entire tile as the link text.
    expect(cardFor("Laksa").querySelectorAll("a")).toHaveLength(1);
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

  // Fills the nine controls RecipeForm draws and submits. Every one of them is
  // sent whether or not it was typed into, because RecipeIn takes no partial
  // create -- which is what the body assertion below checks.
  async function writeARecipe() {
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Name"), "Laksa");
    await user.type(screen.getByLabelText("Cuisine"), "Malaysian");
    await user.type(screen.getByLabelText("Servings"), "4");
    await user.type(screen.getByLabelText("Ingredients"), "Noodles");
    await user.type(screen.getByLabelText("Method"), "Simmer");
    await user.type(screen.getByLabelText("Energy (kcal)"), "1240");
    await user.type(screen.getByLabelText("Protein (g)"), "38");
    await user.type(screen.getByLabelText("Carbohydrate (g)"), "96");
    await user.type(screen.getByLabelText("Fat (g)"), "44");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));
  }

  // The create path end to end. POST /recipes answers a recipe id and nothing
  // else, so the row can only arrive from the loader running again -- which is
  // the mechanism that lets this screen hold no state. The address is asserted
  // as well as the shut dialog: leaving `new` on it would reopen the modal the
  // moment anything re-rendered, and keeping `q` would return someone who had
  // searched to a list their new recipe may not be in.
  it("closes the modal on a save and shows the recipe the loader then answers", async () => {
    signedIn();
    let written = false;

    stubFetch({
      "/recipes?q=laksa": async () => jsonResponse(200, []),
      "/recipes": async (init?: RequestInit) => {
        if (init?.method === "POST") {
          written = true;

          return jsonResponse(201, { recipe_id: 7 });
        }

        return jsonResponse(200, written ? [RECIPES[0]] : []);
      },
    });

    const { router } = renderAt("/recipes?q=laksa&new");

    await writeARecipe();

    expect(await screen.findByRole("heading", { name: "Laksa" })).toBeVisible();
    expect(openDialog()!.open).toBe(false);
    expect(router.state.location.pathname).toBe("/recipes");
    expect(router.state.location.search).toBe("");
  });

  // All nine fields, spelled as RecipeIn spells them. Without this a save that
  // posted eight of them, or posted `method` for `steps`, would pass every
  // other test on this screen -- the 422 stub reads no body and the create
  // test only cares that something was written.
  it("posts the nine fields the contract asks for", async () => {
    signedIn();
    const { fetchStub } = stubFetch({
      "/recipes": async (init?: RequestInit) =>
        init?.method === "POST"
          ? jsonResponse(201, { recipe_id: 7 })
          : jsonResponse(200, []),
    });

    renderAt("/recipes?new");

    await writeARecipe();

    const posted = fetchStub.mock.calls
      .map(([, init]) => init)
      .filter((init) => init?.method === "POST");

    expect(posted).toHaveLength(1);
    expect(JSON.parse(String(posted[0]!.body))).toEqual({
      name: "Laksa",
      cuisine: "Malaysian",
      servings: 4,
      ingredients: "Noodles",
      steps: "Simmer",
      energy_kcal: 1240,
      protein_g: 38,
      carbs_g: 96,
      fat_g: 44,
    });
  });

  // Cancel shuts the element, and the element firing `close` is what puts the
  // address back. A close that shut the dialog and left `new` where it was
  // would look right for exactly as long as nothing re-rendered, and the
  // effect would then reopen the form over the page.
  it("puts the address back when the modal is dismissed", async () => {
    signedIn();
    stubFetch({ "/recipes": async () => jsonResponse(200, RECIPES) });

    const { router } = renderAt("/recipes?new");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(router.state.location.search).toBe("");
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

    await writeARecipe();

    const refusal = await screen.findByRole("alert");

    expect(refusal).toHaveTextContent("Energy must be a whole number.");
    expect(refusal.closest("form")).toHaveClass("recipe-form");
    expect(openDialog()!.open).toBe(true);
    expect(screen.getByLabelText("Name")).toHaveValue("Laksa");
    expect(screen.getByLabelText("Energy (kcal)")).toHaveValue(1240);
  });
});

// C25 (nomadwiz/kete#277). A GET submission sets navigation.formAction just as
// a POST does, so a busy check on the address alone puts the creation modal
// into a saving state while somebody is merely searching. This page is the one
// that carries both kinds of Form, so it is the only place the method half of
// useSubmitting can be observed at all.
describe("a search running underneath the creation modal", () => {
  it("leaves the modal's save control alone, because the search is a GET", async () => {
    signedIn();

    // The search loader is held open, because what is under test is the state
    // during the navigation rather than what it answers.
    let answerSearch = () => {};
    const held = new Promise<void>((resolve) => {
      answerSearch = resolve;
    });

    stubFetch({
      "/recipes": async () => jsonResponse(200, RECIPES),
      "/recipes?q=laksa": async () => {
        await held;

        return jsonResponse(200, [RECIPES[0]]);
      },
    });

    const { router } = renderAt("/recipes?new");
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText("Search your recipes"),
      "laksa",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    try {
      await waitFor(() =>
        expect(router.state.navigation.state).toBe("loading"),
      );

      // Spelled upper case, which is the whole of the second trap: react-router
      // reports the method this way whatever the markup said, so a comparison
      // against "post" never matches and reads exactly like the address defect.
      expect(router.state.navigation.formMethod).toBe("GET");

      // Matched on a prefix that both labels share, so a modal wrongly in the
      // saving state is found and then fails on what is wrong with it, rather
      // than not being found at all.
      const save = screen.getByRole("button", { name: /^Sav/ });

      expect(save).toBeEnabled();
      expect(save).toHaveTextContent("Save recipe");
      expect(save.closest("form")).toHaveAttribute("aria-busy", "false");
    } finally {
      answerSearch();
    }

    await screen.findByRole("heading", { name: "Laksa" });
  });
});

// C14 (nomadwiz/kete#184). A photograph chosen in the creation modal is
// uploaded against the id POST /recipes answers. The action is called
// directly, because no form can deliver a chosen file under jsdom -- see
// src/test/setup.ts.
describe("creating a recipe with a photograph", () => {
  const PHOTO = new File(["jpeg bytes"], "dal.jpg", { type: "image/jpeg" });

  function creating(file: File) {
    const form = new FormData();

    for (const [key, value] of Object.entries({
      name: "Dal",
      cuisine: "Indian",
      ingredients: "Lentils",
      steps: "Simmer",
      servings: "4",
      energy_kcal: "420",
      protein_g: "22",
      carbs_g: "60",
      fat_g: "9",
    })) {
      form.set(key, value);
    }

    form.set("file", file);

    return submitTo(PATHS.recipes, form);
  }

  function created() {
    return jsonResponse(201, { recipe_id: 12 });
  }

  it("shows the optional photograph input in the modal", async () => {
    signedIn();
    stubFetch({ "/recipes": async () => jsonResponse(200, []) });

    renderAt("/recipes?new");

    const input = await screen.findByLabelText("Photograph (optional)");

    expect(input).toHaveAttribute("type", "file");
    expect(input).not.toBeRequired();
    expect(input.closest("form")).toHaveAttribute(
      "enctype",
      "multipart/form-data",
    );
  });

  it("creates the recipe, then uploads the photograph against its new id", async () => {
    signedIn();
    const { calls, fetchStub } = stubFetch({
      "/recipes": async () => created(),
      "/recipes/12/photo": async () =>
        jsonResponse(200, { photo_url: "https://storage.test/x" }),
    });

    const answer = (await creating(PHOTO)) as Response;

    expect(calls).toEqual(["/recipes", "/recipes/12/photo"]);
    expect(
      (fetchStub.mock.calls[1][1]?.body as FormData).get("file"),
    ).toBeTruthy();
    expect(answer.headers.get("Location")).toBe("/recipes");
  });

  // Nothing chosen still submits an entry: an empty File with no name.
  it("creates the recipe alone when no photograph was chosen", async () => {
    signedIn();
    const { calls } = stubFetch({ "/recipes": async () => created() });

    await creating(new File([], "", { type: "application/octet-stream" }));

    expect(calls).toEqual(["/recipes"]);
  });

  // Refused before the recipe is written, so the modal stays open over
  // nothing saved and can be corrected and saved again.
  it("refuses a file the API would refuse before creating anything", async () => {
    signedIn();
    const { calls } = stubFetch({});

    const answer = await creating(
      new File(["gif"], "a.gif", { type: "image/gif" }),
    );

    expect(typeof answer).toBe("string");
    expect(calls).toEqual([]);
  });

  // The one partial failure. The recipe exists, so the modal must not stay
  // open to be saved twice: the person goes to the new recipe's edit view,
  // told why its photograph is missing.
  it.each([
    [
      "storage refuses it",
      async () => jsonResponse(502, { detail: "Could not store the image." }),
    ],
    [
      "the connection drops",
      async (): Promise<Response> => {
        throw new TypeError("Failed to fetch");
      },
    ],
  ])("sends a recipe to its edit view when %s", async (_, answerUpload) => {
    signedIn();
    stubFetch({
      "/recipes": async () => created(),
      "/recipes/12/photo": answerUpload,
    });

    const thrown = await creating(PHOTO).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("Location")).toBe(
      "/recipes/12?edit&photo",
    );
  });
});
