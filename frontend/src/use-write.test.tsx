import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useFetcher } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch } from "./test/router";
import { useWrite } from "./use-write";

// The behaviour src/use-write.ts gives every screen at once, tested in one
// place for the reason it was written in one place: C28 (nomadwiz/kete#285)
// says the fix must not be done per screen, because eight screens is eight
// chances to do it differently -- and eight test files asserting eight
// slightly different things is how that would happen anyway.
//
// What jsdom cannot answer is written above the tests it limits. There is no
// screen reader here and no real focus model, so every assertion below is
// about the DOM these two defects are visible in, and none of them is the
// keyboard pass the issue asks for.

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const PROFILE = {
  first_name: "Aroha",
  last_name: "Tane",
  username: "aroha",
  email: "aroha@example.com",
};

const WEEK = "2026-W39";
const PLAN = `/mealplan?week=${WEEK}`;

const SOUP = {
  recipe_id: 3,
  name: "Kumara and lentil soup",
  energy_kcal: 540,
  protein_g: 22,
  carbs_g: 71,
  fat_g: 16,
};

const LIBRARY = [{ ...SOUP, cuisine: "New Zealand", photo_url: null }];

const LAKSA = {
  recipe_id: 7,
  name: "Laksa",
  cuisine: "Malaysian",
  energy_kcal: 1240,
  photo_url: null,
  ingredients: "Noodles",
  steps: "Simmer",
  servings: 4,
  protein_g: 38,
  carbs_g: 96,
  fat_g: 44,
};

async function saveTheAccount() {
  const user = userEvent.setup();
  const username = await screen.findByLabelText("Username");

  await user.clear(username);
  await user.type(username, "aroha-t");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
}

// Focus is the half of C28 with no screen reader in it, so jsdom can see some
// of it -- but only some, and the boundary was measured rather than assumed.
// jsdom 30 does not blur a focused element when it is disabled, where every
// browser does: with the restoration in src/use-write.ts cut out, the first
// two tests below still pass and only the third fails. So the third is the one
// that pins the mechanism, because there the element genuinely goes and jsdom
// genuinely drops focus to <body>. The first two pin the outcome a browser has
// to reach, and a person at a keyboard is still the only thing that can say
// they do.
describe("focus after a write", () => {
  // Catches the implementation that disables the button and forgets it: with
  // no restoration this is document.body, and the next Tab starts from the top
  // of the page rather than from the control that was just used.
  it("puts focus back on the button a save left standing", async () => {
    signedIn();
    stubFetch({
      "/profile": async (init?: RequestInit) =>
        init?.method === "PUT"
          ? jsonResponse(200, PROFILE)
          : jsonResponse(200, PROFILE),
    });

    renderAt("/account");

    await saveTheAccount();

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Save changes" }),
    );
  });

  // The same rule on the path where the form stays put for a different reason.
  // A person who has just been told what to retype is the person who can least
  // afford to be put back at the top of the document.
  it("puts focus back on the button after a refusal", async () => {
    signedIn();
    stubFetch({
      "/profile": async (init?: RequestInit) =>
        init?.method === "PUT"
          ? jsonResponse(409, { detail: "That username is already taken" })
          : jsonResponse(200, PROFILE),
    });

    renderAt("/account");

    await saveTheAccount();

    await screen.findByRole("alert");

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Save changes" }),
    );
  });

  // The case the naive fix gets wrong, and the reason the hook records a chain
  // of ancestors rather than one element. Adding a recipe replaces the whole
  // contents of that cell -- the select and the Add button go, a name and a
  // Remove button arrive -- so the element focus was on no longer exists, and
  // an implementation that called focus() on it would put focus nowhere at
  // all. The cell is still there, and a cell in this table is announced with
  // its day and its meal.
  it("puts focus in the cell when the button that was clicked has gone", async () => {
    signedIn();
    let placed = false;

    stubFetch({
      [PLAN]: async () =>
        jsonResponse(
          200,
          placed
            ? [
                {
                  slot_id: 9,
                  day_of_week: "Mon",
                  meal_position: "breakfast",
                  recipe: SOUP,
                },
              ]
            : [],
        ),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () => {
        placed = true;

        return jsonResponse(201, { slot_id: 9 });
      },
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

    await screen.findByRole("button", {
      name: "Remove Kumara and lentil soup from Monday breakfast",
    });

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.tagName).toBe("TD");
    expect(document.activeElement).toHaveTextContent("Kumara and lentil soup");
  });
});

// The second defect. role="status" is a live region, which aria-busy on a form
// or a table is not -- and nothing here can prove a screen reader speaks it.
// What these assert is that the region exists, carries a sentence, and is not
// there before there is anything to say.
describe("what a screen says when a write worked", () => {
  // One sentence for four intents, which is what the count buys. A version
  // naming the verb would need the submitted intent, which is gone by the time
  // the grid has redrawn.
  it("says how much of the week is planned after a placement", async () => {
    signedIn();
    let placed = false;

    stubFetch({
      [PLAN]: async () =>
        jsonResponse(
          200,
          placed
            ? [
                {
                  slot_id: 9,
                  day_of_week: "Mon",
                  meal_position: "breakfast",
                  recipe: SOUP,
                },
              ]
            : [],
        ),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () => {
        placed = true;

        return jsonResponse(201, { slot_id: 9 });
      },
    });

    renderAt(`/planner?week=${WEEK}`);

    const user = userEvent.setup();

    // Nothing has been written, so there is nothing to announce. Without this
    // a hook that reported every idle render as a success would greet every
    // visitor with a sentence about a write they never made.
    await screen.findByLabelText("Recipe for Monday breakfast");
    expect(screen.queryByRole("status")).toBeNull();

    await user.selectOptions(
      screen.getByLabelText("Recipe for Monday breakfast"),
      "3",
    );
    await user.click(
      screen.getByRole("button", { name: "Add a recipe to Monday breakfast" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your week is updated: 1 of 21 positions planned.",
    );
  });

  // Why the hook keys the answer to a location rather than holding a boolean.
  // This screen stays mounted across a change of week, so a flag set by the
  // Add above would still be set here -- announcing that a week the person has
  // only just looked at had been updated by them.
  it("stops saying it once the person steps to another week", async () => {
    signedIn();
    let placed = false;

    stubFetch({
      [PLAN]: async () =>
        jsonResponse(
          200,
          placed
            ? [
                {
                  slot_id: 9,
                  day_of_week: "Mon",
                  meal_position: "breakfast",
                  recipe: SOUP,
                },
              ]
            : [],
        ),
      "/mealplan?week=2026-W40": async () => jsonResponse(200, []),
      "/recipes": async () => jsonResponse(200, LIBRARY),
      "/mealplan": async () => {
        placed = true;

        return jsonResponse(201, { slot_id: 9 });
      },
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

    await screen.findByRole("status");

    await user.click(screen.getByRole("link", { name: "Next week" }));

    await screen.findByText(/Nothing is planned for this week yet/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  // The screen that cannot work this out for itself. recipesAction answers a
  // save that worked with replace(), so useActionData is undefined by the time
  // the list redraws -- the same undefined a page nobody has submitted sees.
  // Without the hook remembering across that redirect there is nothing here to
  // render a sentence from, and the modal simply vanishes.
  it("says a recipe is saved once the modal has closed over it", async () => {
    signedIn();
    let written = false;

    stubFetch({
      "/recipes": async (init?: RequestInit) => {
        if (init?.method === "POST") {
          written = true;

          return jsonResponse(201, { recipe_id: 7 });
        }

        return jsonResponse(
          200,
          written ? [{ ...SOUP, cuisine: "New Zealand", photo_url: null }] : [],
        );
      },
    });

    renderAt("/recipes?new");

    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Name"), "Soup");
    await user.type(screen.getByLabelText("Servings"), "4");
    await user.type(screen.getByLabelText("Energy (kcal)"), "540");
    await user.type(screen.getByLabelText("Protein (g)"), "22");
    await user.type(screen.getByLabelText("Carbohydrate (g)"), "71");
    await user.type(screen.getByLabelText("Fat (g)"), "16");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your recipe is saved. It is in the list below.",
    );
  });

  // The edit form is swapped for the read view in place, under a heading that
  // does not change, so without this the save is invisible to anyone not
  // watching the middle of the page.
  it("says the changes are saved once the edit view has closed", async () => {
    signedIn();
    stubFetch({
      "/recipes/7": async (init?: RequestInit) =>
        init?.method === "PUT"
          ? jsonResponse(200, LAKSA)
          : jsonResponse(200, LAKSA),
    });

    renderAt("/recipes/7?edit");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your changes are saved.",
    );
  });

  // The other write on that route, and it must announce nothing: it lands on a
  // screen that performed no write. A hook that carried its answer across the
  // redirect rather than keying it to the address would tell the library that
  // something on it had just been saved.
  it("says nothing on the list a delete lands on", async () => {
    signedIn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

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

    expect(
      await screen.findByText(/You have not written a recipe yet/),
    ).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

// The guard C28 decided to keep rather than replace with aria-disabled. It is
// the reason focus had to be restored at all, so a change that dropped it
// would make every test above pass while removing the thing they exist for.
describe("the button is still dead while the write is in flight", () => {
  it("disables the account form's submit until the PUT answers", async () => {
    signedIn();

    let answer = () => {};
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });

    stubFetch({
      "/profile": async (init?: RequestInit) => {
        if (init?.method === "PUT") {
          await held;
        }

        return jsonResponse(200, PROFILE);
      },
    });

    renderAt("/account");

    await saveTheAccount();

    const save = () => screen.getByRole("button", { name: "Saving…" });

    await vi.waitFor(() => expect(save()).toBeDisabled());

    answer();

    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).toBeEnabled(),
    );
  });
});

// C14 (nomadwiz/kete#184). A fetcher is invisible to the navigation, so the
// hook has to be handed it. No screen can drive this under jsdom -- the one
// fetcher form in the client uploads a file, which jsdom never puts in a
// submission (recipe.test.tsx says why) -- so the route here is the test's own,
// with a form that sends text.
describe("a write posted through a fetcher", () => {
  function Probe() {
    const fetcher = useFetcher<string | null>();
    const { busy, succeeded } = useWrite("POST", fetcher);

    return (
      <fetcher.Form method="post">
        <label htmlFor="answer">Answer</label>
        <input id="answer" name="answer" />
        <button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send"}
        </button>
        {succeeded ? <p role="status">Sent.</p> : null}
      </fetcher.Form>
    );
  }

  it("is busy while it runs, and only an answer that is not a string succeeds", async () => {
    let answer: () => void = () => {};

    const router = createMemoryRouter([
      {
        path: "/",
        Component: Probe,
        action: async ({ request }) => {
          const said = String((await request.formData()).get("answer"));

          await new Promise<void>((resolve) => {
            answer = resolve;
          });

          return said === "no" ? "Refused." : null;
        },
      },
    ]);

    render(<RouterProvider router={router} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Answer"), "no");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByRole("button", { name: "Sending…" }),
    ).toBeDisabled();

    answer();

    await screen.findByRole("button", { name: "Send" });
    expect(screen.queryByRole("status")).toBeNull();

    await user.clear(screen.getByLabelText("Answer"));
    await user.type(screen.getByLabelText("Answer"), "yes");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("button", { name: "Sending…" });

    answer();

    expect(await screen.findByRole("status")).toHaveTextContent("Sent.");
  });
});
