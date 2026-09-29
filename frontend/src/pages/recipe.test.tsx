import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch } from "../test/router";
import type { RecipeDetail } from "../types/recipe";

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Spelled with `satisfies` on the reasoning account.test.tsx gives: a field
// renamed in the contract fails the build here rather than leaving these
// assertions passing against a body the screen can no longer read. Both text
// fields carry a newline, because the line breaks somebody typed are the only
// structure either field has.
const LAKSA = {
  recipe_id: 7,
  name: "Laksa",
  cuisine: "Malaysian",
  energy_kcal: 1240,
  photo_url: "https://storage.test/laksa.jpg?signature=abc",
  ingredients: "Noodles\nCoconut milk",
  steps: "Simmer the paste.\nAdd the noodles.",
  servings: 4,
  protein_g: 38,
  carbs_g: 1096,
  fat_g: 44,
} satisfies RecipeDetail;

// The panel a figure is drawn in, found through its own name. A text assertion
// across the whole page would pass on four figures printed in the wrong order
// or against the wrong labels, which is the defect worth catching -- carbs and
// protein transposed reads perfectly and is wrong on every screen that
// compares a week against them.
function figure(name: string) {
  return screen.getByText(name, { selector: "dt" }).closest("div")!;
}

describe("the recipe detail page", () => {
  it("draws the ingredients, the method, the servings and all four figures", async () => {
    signedIn();
    stubFetch({ "/recipes/7": async () => jsonResponse(200, LAKSA) });

    renderAt("/recipes/7");

    expect(await screen.findByRole("heading", { name: "Laksa" })).toBeVisible();
    expect(screen.getByText("Malaysian")).toBeVisible();
    expect(screen.getByText("Makes 4 servings")).toBeVisible();

    expect(figure("Energy")).toHaveTextContent("1,240 kcal");
    expect(figure("Protein")).toHaveTextContent("38 g");
    expect(figure("Carbohydrate")).toHaveTextContent("1,096 g");
    expect(figure("Fat")).toHaveTextContent("44 g");

    // Both fields are free text, and the line breaks somebody typed are the
    // only structure either of them has -- which is what makes a method of
    // several steps readable at all. The assertion is on textContent rather
    // than through toHaveTextContent, which normalises whitespace and would
    // pass against a page that had collapsed the breaks. The class is asserted
    // beside it because the break in the text node is only half of it: without
    // pre-wrap the browser collapses it whatever the DOM holds.
    //
    // `steps` is the contract's name and Method is the cook's, so the heading
    // takes the human word, as RecipeForm's label does.
    const ingredients = screen.getByText(/Noodles/);

    expect(ingredients.textContent).toBe("Noodles\nCoconut milk");
    expect(ingredients).toHaveClass("recipe__text");

    expect(screen.getByRole("heading", { name: "Method" })).toBeVisible();
    expect(screen.getByText(/Simmer the paste/).textContent).toBe(
      "Simmer the paste.\nAdd the noodles.",
    );

    // Read straight off the loader's answer: photo_url is a presigned link
    // that expires an hour after the API minted it, so it is never cached or
    // persisted anywhere. Queried as an element rather than by role, because
    // alt="" makes it decorative and it carries no img role at all -- which is
    // itself asserted here, since the name is above it and describing the dish
    // twice is noise.
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      LAKSA.photo_url,
    );
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  // photo_url is optional and nullable, so the absent case is a state this page
  // draws rather than an <img> pointed at nothing -- which renders as a broken
  // image glyph in every browser. This is the assertion that catches a page
  // built as one.
  it("draws a panel and no image for a recipe carrying no photograph", async () => {
    signedIn();
    stubFetch({
      "/recipes/7": async () =>
        jsonResponse(200, { ...LAKSA, photo_url: null }),
    });

    renderAt("/recipes/7");

    await screen.findByRole("heading", { name: "Laksa" });

    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector(".recipe__photo--none")).toBeVisible();

    // Decorative: the name is above it, and a screen reader reading a
    // description of the dish straight after its name says the same thing
    // twice.
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  // ADR 002's test. A fresh mount at ?edit is a refresh, and the form is there
  // prefilled: nothing in this component remembers either fact.
  it("opens the edit form from the address, prefilled from the record", async () => {
    signedIn();
    stubFetch({ "/recipes/7": async () => jsonResponse(200, LAKSA) });

    renderAt("/recipes/7?edit");

    expect(await screen.findByLabelText("Name")).toHaveValue("Laksa");
    expect(screen.getByLabelText("Servings")).toHaveValue(4);
    expect(screen.getByLabelText("Method")).toHaveValue(LAKSA.steps);
    expect(screen.getByLabelText("Energy (kcal)")).toHaveValue(1240);

    // The fields replace the read view rather than floating over it, so the
    // figures and the way in to the form are both gone. The legend inside the
    // fieldset says the same words as the read view's heading, which is why
    // this asks for the heading role rather than the text.
    expect(
      screen.queryByRole("heading", { name: "Nutrition per serving" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit this recipe" })).toBeNull();
  });

  it("offers the edit form at an address, and nothing else at the plain one", async () => {
    signedIn();
    stubFetch({ "/recipes/7": async () => jsonResponse(200, LAKSA) });

    renderAt("/recipes/7");

    expect(
      await screen.findByRole("link", { name: "Edit this recipe" }),
    ).toHaveAttribute("href", "/recipes/7?edit");
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  // Cancel drops the key, and dropping the key is the whole of closing the
  // edit view -- the form is drawn exactly while the key is there. Replacing
  // rather than pushing is asserted too: opening the form is a link, so that
  // entry is already in the history, and a push here would put Back one click
  // from reopening a form somebody had just dismissed.
  it("closes the edit form without saving when Cancel is pressed", async () => {
    signedIn();
    const { fetchStub } = stubFetch({
      "/recipes/7": async () => jsonResponse(200, LAKSA),
    });

    const { router } = renderAt("/recipes/7?edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(router.state.location.search).toBe("");
    expect(router.state.historyAction).toBe("REPLACE");
    // The read view is awaited before the form's absence is asserted, rather
    // than after it. Both orders assert the same switch; only this one cannot
    // race it. Cancel is a navigation, so react-router runs the loader again
    // and React commits the swapped branch a render after the router's own
    // state changes -- the two assertions above already pass at that point. A
    // synchronous queryBy ahead of the wait reads the DOM inside that gap and
    // finds the form still mounted, which it did in roughly one run in four
    // once C28 (#285) put another render on this path. Nothing about the page
    // was wrong: the test was asserting how quickly the switch happened rather
    // than that it happened.
    expect(
      await screen.findByRole("heading", { name: "Nutrition per serving" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Name")).toBeNull();

    // Nothing was written. A Cancel that submitted would look identical on
    // screen, because the loader answers the same record either way. The
    // assertion is on the methods rather than on the call count: dropping the
    // key is a navigation, so react-router runs the loader again and the read
    // is made twice, which is the same thing closing the modal on /recipes
    // does. `authed` sends a GET by passing no method at all.
    expect(
      fetchStub.mock.calls
        .map(([, init]) => init?.method)
        .filter((method) => method !== undefined),
    ).toEqual([]);
  });

  // The one time Cancel is refused. The PUT may already have reached the API,
  // so leaving would abandon it in the browser and discard both the nine typed
  // fields and any refusal coming back, leaving somebody unable to tell
  // whether the recipe was saved. `disabled` is how a button refuses; a link
  // has no equivalent, which is why this control is not one.
  it("refuses Cancel while a save is in flight", async () => {
    signedIn();
    stubFetch({
      "/recipes/7": async (init?: RequestInit) =>
        init?.method === "PUT"
          ? new Promise<Response>(() => {})
          : jsonResponse(200, LAKSA),
    });

    renderAt("/recipes/7?edit");

    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Save changes" }),
    );

    // The submit button renaming itself is the signal that the host passed
    // `busy` down, so this waits on the thing under test rather than on a
    // timer.
    expect(
      await screen.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  // All nine fields, spelled as RecipeIn spells them, and the method asserted
  // explicitly. stubFetch keys on the path alone, so one handler answers both
  // the read and the write here -- without the method assertion a save issued
  // as a POST, or as a second GET, would satisfy every other test on this page.
  it("saves by sending all nine fields as a full PUT", async () => {
    signedIn();
    const { fetchStub } = stubFetch({
      "/recipes/7": async (init?: RequestInit) =>
        init?.method === "PUT"
          ? jsonResponse(200, { ...LAKSA, name: "Laksa lemak" })
          : jsonResponse(200, LAKSA),
    });

    renderAt("/recipes/7?edit");

    const user = userEvent.setup();
    const name = await screen.findByLabelText("Name");

    await user.clear(name);
    await user.type(name, "Laksa lemak");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const written = fetchStub.mock.calls
      .map(([, init]) => init)
      .filter((init) => init?.method === "PUT");

    expect(written).toHaveLength(1);

    // The typed change and the eight fields nobody touched, together: PUT is a
    // full replace and there is no partial update, so a body carrying only the
    // edited field would empty the rest of the record.
    expect(JSON.parse(String(written[0]!.body))).toEqual({
      name: "Laksa lemak",
      cuisine: "Malaysian",
      servings: 4,
      ingredients: "Noodles\nCoconut milk",
      steps: "Simmer the paste.\nAdd the noodles.",
      energy_kcal: 1240,
      protein_g: 38,
      carbs_g: 1096,
      fat_g: 44,
    });
  });

  // The save path end to end. PUT answers the saved record and the action
  // discards it, so the new name can only arrive from the loader running again
  // -- which is the mechanism that lets this screen hold no state. The address
  // is asserted as well: leaving `edit` on it would redraw the form over a
  // record that had just been saved.
  it("closes the edit form on a save and shows what the loader then answers", async () => {
    signedIn();
    let saved = false;

    stubFetch({
      "/recipes/7": async (init?: RequestInit) => {
        if (init?.method === "PUT") {
          saved = true;

          return jsonResponse(200, { ...LAKSA, name: "Laksa lemak" });
        }

        return jsonResponse(
          200,
          saved ? { ...LAKSA, name: "Laksa lemak" } : LAKSA,
        );
      },
    });

    const { router } = renderAt("/recipes/7?edit");

    const user = userEvent.setup();
    const name = await screen.findByLabelText("Name");

    await user.clear(name);
    await user.type(name, "Laksa lemak");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("heading", { name: "Laksa lemak" }),
    ).toBeVisible();
    expect(router.state.location.search).toBe("");
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  // The 422 PUT /recipes/{recipe_id} declares, which is the one failure on this
  // route the person can answer by typing something else. The assertions are
  // the form's own role="alert" and the value still in the field, not the
  // message text: ErrorBoundary prints the same sentence, so a page that threw
  // this to the boundary would satisfy a text assertion while having thrown
  // away every field the person filled in.
  it("shows a refused save inside the form, with the typed values intact", async () => {
    signedIn();
    stubFetch({
      "/recipes/7": async (init?: RequestInit) =>
        init?.method === "PUT"
          ? jsonResponse(422, { detail: "Energy must be a whole number." })
          : jsonResponse(200, LAKSA),
    });

    const { router } = renderAt("/recipes/7?edit");

    const user = userEvent.setup();
    const energy = await screen.findByLabelText("Energy (kcal)");

    await user.clear(energy);
    await user.type(energy, "1300");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const refusal = await screen.findByRole("alert");

    expect(refusal).toHaveTextContent("Energy must be a whole number.");
    expect(refusal.closest("form")).toHaveClass("recipe-form");
    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).toBeNull();

    // Still in the edit view, which is what stops the form remounting and is
    // therefore what keeps the typed value.
    expect(router.state.location.search).toBe("?edit");
    expect(screen.getByLabelText("Energy (kcal)")).toHaveValue(1300);
    expect(screen.getByLabelText("Name")).toHaveValue("Laksa");
  });

  // The other 404 on this route, and it is sent to the same surface as the
  // read's. Letting it reach the error boundary was the first version: the
  // boundary renders an ApiError's message verbatim, so it would have printed
  // "or it belongs to another account" -- the clause this page suppresses
  // precisely because the endpoint answers 404 rather than 403 so as not to
  // confirm that somebody else's record exists. The two assertions on the
  // absent alert and the absent boundary are what pin that: the panel's own
  // sentence says the recipe may have been deleted, which is why the save
  // could not land.
  it("sends a save of a recipe that has gone to the not-found panel", async () => {
    signedIn();
    let deleted = false;

    stubFetch({
      "/recipes/7": async (init?: RequestInit) => {
        if (init?.method === "PUT") {
          deleted = true;

          return jsonResponse(404, {
            detail: "No such recipe, or it belongs to another account",
          });
        }

        return deleted
          ? jsonResponse(404, {
              detail: "No such recipe, or it belongs to another account",
            })
          : jsonResponse(200, LAKSA);
      },
    });

    const { router } = renderAt("/recipes/7?edit");

    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Save changes" }),
    );

    expect(
      await screen.findByRole("heading", { name: "No such recipe" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to your recipes" }),
    ).toHaveAttribute("href", "/recipes");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).toBeNull();
    expect(screen.queryByText(/belongs to another account/)).toBeNull();

    // The edit address is left behind rather than pushed over, so Back does
    // not return to a form for a recipe that is not there.
    expect(router.state.location.search).toBe("");
  });

  // The read's 404, which is the whole subject of this page rather than one
  // stale row on it. "Something went wrong" is false for a recipe deleted in
  // another tab and the boundary offers no way onward, so the page draws its
  // own state -- and the contract's "or it belongs to another account" is not
  // repeated, because the endpoint answers 404 rather than 403 so as not to
  // confirm that somebody else's record exists.
  it("draws a way back to the library when there is no such recipe", async () => {
    signedIn();
    stubFetch({
      "/recipes/99": async () =>
        jsonResponse(404, {
          detail: "No such recipe, or it belongs to another account",
        }),
    });

    renderAt("/recipes/99");

    expect(
      await screen.findByRole("heading", { name: "No such recipe" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to your recipes" }),
    ).toHaveAttribute("href", "/recipes");

    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).toBeNull();
    expect(screen.queryByText(/belongs to another account/)).toBeNull();
  });

  // The other half of the same rule, and the reason the loader catches a 422
  // beside the 404: this id is all digits, so the guard passes it, and the only
  // parameter on this route is the id in the path -- so a 422 is a sentence
  // about the address rather than about the recipe, and the address names
  // nothing.
  it("draws the same panel for an id the API refuses as out of range", async () => {
    signedIn();
    stubFetch({
      "/recipes/99999999999999999999": async () =>
        jsonResponse(422, {
          detail: [{ msg: "Input should be a valid integer" }],
        }),
    });

    renderAt("/recipes/99999999999999999999");

    expect(
      await screen.findByRole("heading", { name: "No such recipe" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).toBeNull();
  });

  // react-router decodes a path parameter before a loader or an action sees
  // it, so this address arrives as `../profile`. Unescaped, the template would
  // build /recipes/../profile, and the browser normalises that to /profile
  // when it parses the address -- aiming a PUT carrying a recipe body at the
  // account endpoint under the same bearer token. The second assertion is the
  // one that matters and it is deliberately not about the string: it resolves
  // what was requested the way fetch does, so it goes red with the real
  // destination rather than with a spelling.
  //
  // The action is driven through the router rather than through the screen,
  // because there is no screen: recipeLoader refuses this id, so the page
  // draws the not-found panel and there is no form to submit. That is the
  // control this one backs up rather than duplicates.
  it("escapes the id it writes to, so a hand-edited address cannot reach another endpoint", async () => {
    signedIn();
    const { calls } = stubFetch({
      "/recipes/..%2Fprofile": async () => jsonResponse(200, LAKSA),
    });

    const { router } = renderAt("/recipes/..%2Fprofile");

    await screen.findByRole("heading", { name: "No such recipe" });

    const body = new FormData();

    body.set("name", "Laksa");

    await router.navigate("/recipes/..%2Fprofile", {
      formMethod: "post",
      formData: body,
    });

    expect(calls).toContain("/recipes/..%2Fprofile");
    expect(
      calls.map((path) => new URL(path, "http://api.test").pathname),
    ).not.toContain("/profile");
  });

  // An id that is not a whole number is the same thing as a recipe that is not
  // there, and the loader answers it without a request. The empty `calls` is
  // the assertion: stubFetch throws on any path it was not given, so a page
  // that asked the API for /recipes/NaN would fail here rather than render a
  // 422 about a path parameter.
  it("answers a malformed id the same way, without asking the API", async () => {
    signedIn();
    const { calls } = stubFetch({});

    renderAt("/recipes/abc");

    expect(
      await screen.findByRole("heading", { name: "No such recipe" }),
    ).toBeVisible();
    expect(calls).toEqual([]);
  });
});

// The second of these in the project and not yet an extraction: planner.test.tsx
// declares the same four lines, and the house rule extracts on the third
// repetition. window.confirm is what both destructive controls put in front of
// themselves, and jsdom's own stub returns undefined -- which reads as a
// decline, so a test that does not answer it silently asserts nothing.
function stubConfirm(answer: boolean) {
  // Typed as window.confirm is rather than as a bare () => boolean, so the
  // message can be read back off mock.calls: a vi.fn with no declared
  // parameter records an empty tuple and indexing it does not compile.
  const confirmStub = vi.fn<(message?: string) => boolean>(() => answer);

  vi.stubGlobal("confirm", confirmStub);

  return confirmStub;
}

// The methods a run issued, in order. stubFetch records the path alone, so
// every assertion about a verb on this page reads fetchStub.mock.calls --
// without which a DELETE answered by the GET handler for the same path passes.
function methodsOf(fetchStub: { mock: { calls: [unknown, RequestInit?][] } }) {
  return fetchStub.mock.calls
    .map(([, init]) => init?.method)
    .filter((method) => method !== undefined);
}

const GONE = { detail: "No such recipe, or it belongs to another account" };

describe("deleting a recipe", () => {
  // The substance of C15 (nomadwiz/kete#179). backend/schema.sql declares
  // plan_slots.recipe_id ON DELETE CASCADE, so deleting a recipe empties every
  // position holding it, in every week -- and this sentence is the only place
  // in the application that is ever said. A generic "Are you sure?" fails the
  // issue.
  it("says every position holding the recipe is emptied, and claims no number", async () => {
    signedIn();
    const confirmStub = stubConfirm(false);
    stubFetch({ "/recipes/7": async () => jsonResponse(200, LAKSA) });

    renderAt("/recipes/7");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Delete this recipe" }));

    const asked = String(confirmStub.mock.calls[0]?.[0]);

    expect(asked).toContain("Laksa");
    expect(asked).toMatch(/every position in every week/);
    expect(asked).toMatch(/no undo/);

    // No digit anywhere in the sentence this page wrote. Nothing here counts
    // the slots pointing at the recipe, so any number would be invented -- and
    // a confirmation saying "2 meals" when it is nine is worse than one that
    // says neither. The name is taken out first, because a fixture renamed to
    // "Laksa 2" would otherwise fail this for a reason that has nothing to do
    // with what it asserts.
    expect(asked.replace(LAKSA.name, "")).not.toMatch(/\d/);
  });

  // react-router's Form runs onSubmit and then returns on a prevented default,
  // so a decline costs no request rather than one whose answer is discarded.
  // The assertion is on the methods: the GET that drew the page went to the
  // same path, so a path-level assertion would pass against a DELETE.
  it("sends no request at all when the confirmation is declined", async () => {
    signedIn();
    stubConfirm(false);
    const { fetchStub } = stubFetch({
      "/recipes/7": async () => jsonResponse(200, LAKSA),
    });

    renderAt("/recipes/7");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Delete this recipe" }));

    expect(methodsOf(fetchStub)).toEqual([]);
    expect(screen.getByRole("heading", { name: "Laksa" })).toBeVisible();
  });

  // The destination is the assertion C12 (nomadwiz/kete#177) left this test to
  // make. A tail shared below the branch would have handed the delete
  // replace(here) -- a redirect to the record just deleted, whose loader 404s,
  // landing the person on the not-found panel instead of their library.
  it("issues a DELETE and lands on the library rather than on the deleted record", async () => {
    signedIn();
    stubConfirm(true);
    let gone = false;

    const { fetchStub } = stubFetch({
      "/recipes/7": async (init?: RequestInit) => {
        if (init?.method === "DELETE") {
          gone = true;

          return new Response(null, { status: 204 });
        }

        return gone ? jsonResponse(404, GONE) : jsonResponse(200, LAKSA);
      },
      "/recipes": async () => jsonResponse(200, []),
    });

    const { router } = renderAt("/recipes/7");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Delete this recipe" }));

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/recipes"),
    );

    expect(methodsOf(fetchStub)).toEqual(["DELETE"]);
    expect(
      screen.queryByRole("heading", { name: "No such recipe" }),
    ).toBeNull();

    // Replaced rather than pushed, so Back does not return to the address of a
    // record that no longer answers.
    expect(router.state.historyAction).toBe("REPLACE");
  });

  // The same guard the save carries, on the same route. react-router decodes a
  // path parameter before an action sees it, so this address arrives as
  // `../profile` and an unescaped template would build /recipes/../profile --
  // which the browser normalises to /profile when it parses the address,
  // aiming a DELETE at the account endpoint under the same bearer token. The
  // action is driven through the router because there is no screen: the loader
  // refuses this id, so the page draws the not-found panel and carries no
  // delete button.
  it("escapes the id it deletes, so a hand-edited address cannot reach another endpoint", async () => {
    signedIn();
    const { calls, fetchStub } = stubFetch({
      "/recipes/..%2Fprofile": async () => new Response(null, { status: 204 }),
      "/recipes": async () => jsonResponse(200, []),
    });

    const { router } = renderAt("/recipes/..%2Fprofile");

    await screen.findByRole("heading", { name: "No such recipe" });

    const body = new FormData();

    body.set("intent", "delete");

    await router.navigate("/recipes/..%2Fprofile", {
      formMethod: "post",
      formData: body,
    });

    expect(calls).toContain("/recipes/..%2Fprofile");
    expect(
      calls.map((path) => new URL(path, "http://api.test").pathname),
    ).not.toContain("/profile");

    // The verb as well as the address, for the reason methodsOf is declared:
    // this stub answers every method with a 204, so without this the test
    // passes unchanged against a branch that had started sending a PUT.
    expect(methodsOf(fetchStub)).toEqual(["DELETE"]);
  });

  // The 404 on DELETE /recipes/{recipe_id}, which on this verb is the outcome
  // that was asked for: the person wanted the record gone and it is gone. The
  // three negative assertions are the point -- ErrorBoundary renders an
  // ApiError's message verbatim, so a rethrow would print "or it belongs to
  // another account", the clause the endpoint answers 404 rather than 403
  // precisely to avoid.
  it("treats a recipe already gone as the deletion that was asked for", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      "/recipes/7": async (init?: RequestInit) =>
        init?.method === "DELETE"
          ? jsonResponse(404, GONE)
          : jsonResponse(200, LAKSA),
      "/recipes": async () => jsonResponse(200, []),
    });

    const { router } = renderAt("/recipes/7");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Delete this recipe" }));

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/recipes"),
    );

    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "No such recipe" }),
    ).toBeNull();
    expect(screen.queryByText(/belongs to another account/)).toBeNull();
  });

  // The other half of the same catch, and the half the five tests above do not
  // reach: a guard weakened to swallow every ApiError passes every one of
  // them. It is also the failure that matters most in front of a deployed API,
  // because a 500 from the backend or a 502 from the gateway is likelier here
  // than the 404 -- and either leaves the recipe exactly where it was. Reported
  // as a deletion it would drop the person on a library still showing the row,
  // which reads as a list that has not caught up. Nothing on this screen
  // repairs a 500, so it belongs to the error boundary.
  it("does not report a failed delete as a deletion", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      "/recipes/7": async (init?: RequestInit) =>
        init?.method === "DELETE"
          ? jsonResponse(500, { detail: "Internal Server Error" })
          : jsonResponse(200, LAKSA),
    });

    const { router } = renderAt("/recipes/7");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Delete this recipe" }));

    expect(
      await screen.findByRole("heading", { name: "Something went wrong" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/recipes/7");
  });

  // The button names the write that is in flight, as RecipeForm's does, and is
  // dead while it runs: a second click on a delete that has already reached
  // the API is answered 404, which this action then reports as a success --
  // correct, but it would also have been a request nobody meant to send.
  it("renames itself and refuses a second click while the delete is in flight", async () => {
    signedIn();
    stubConfirm(true);

    stubFetch({
      "/recipes/7": async (init?: RequestInit) =>
        init?.method === "DELETE"
          ? new Promise<Response>(() => {})
          : jsonResponse(200, LAKSA),
    });

    renderAt("/recipes/7");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Delete this recipe" }));

    const button = await screen.findByRole("button", { name: "Deleting…" });

    expect(button).toBeDisabled();

    // The pair src/use-submitting.ts names: aria-busy on the form beside
    // disabled on its submit. It carries more here than on the planner,
    // because this button renames itself as it goes dead -- a change a screen
    // reader is otherwise told nothing about, on an element that has just lost
    // focus to the body.
    expect(button.closest("form")).toHaveAttribute("aria-busy", "true");
  });
});
