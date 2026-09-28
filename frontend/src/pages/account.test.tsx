import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch } from "../test/router";
import type { Profile } from "../types/profile";

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// The four fields ProfileOut answers with, spelled as backend/openapi.json
// spells them. `satisfies` rather than a bare object, so a field renamed in
// the type fails the build here -- these assertions would otherwise go on
// passing against a body the screen can no longer read.
const PROFILE_BODY = {
  first_name: "Aroha",
  last_name: "Tane",
  username: "aroha",
  email: "aroha@example.com",
} satisfies Profile;

// GET answers the saved account, PUT answers whatever the test asks for. One
// path, two methods, which is why stubFetch hands the init to its handlers.
function stubProfile(put: () => Promise<Response>) {
  return stubFetch({
    "/profile": async (init?: RequestInit) =>
      init?.method === "PUT" ? put() : jsonResponse(200, PROFILE_BODY),
  });
}

async function amendUsername(to: string) {
  const user = userEvent.setup();
  const username = await screen.findByLabelText("Username");

  await user.clear(username);
  await user.type(username, to);
  await user.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("the account form", () => {
  it("prefills all four controls from what GET /profile answered", async () => {
    signedIn();
    stubProfile(async () => jsonResponse(200, PROFILE_BODY));

    renderAt("/account");

    expect(await screen.findByLabelText("First name")).toHaveValue("Aroha");
    expect(screen.getByLabelText("Last name")).toHaveValue("Tane");
    expect(screen.getByLabelText("Username")).toHaveValue("aroha");
    expect(screen.getByLabelText("Email")).toHaveValue("aroha@example.com");
  });
});

// The status the screen is built around. PUT /profile answers 409 when the
// username or email is already somebody else's, and a person who has just
// typed a name has to see why while still holding what they typed.
//
// The assertion is not the message text alone. ErrorBoundary prints whatever
// it caught too, so a version that threw this status rather than returning it
// would render the same sentence and pass -- the defect C22 (#236) found on
// sign-in. What only the form renders is its own role="alert", above fields
// that still carry the typed values, at the address that was never left.
describe("the account form refused with a 409", () => {
  it("shows the server's message with the typed values intact", async () => {
    signedIn();
    stubProfile(async () =>
      jsonResponse(409, { detail: "That username is already taken" }),
    );

    const { router } = renderAt("/account");

    await amendUsername("taken");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That username is already taken",
    );
    expect(screen.getByLabelText("Username")).toHaveValue("taken");
    expect(screen.getByLabelText("First name")).toHaveValue("Aroha");
    expect(router.state.location.pathname).toBe("/account");
  });
});

// PUT /profile is a full replace, so the contract's trap is a form that posts
// only what changed: the other three fields would be blanked. This asserts the
// body rather than the screen, because nothing on screen would show it.
describe("amending one field", () => {
  it("sends all four back and says the details are saved", async () => {
    signedIn();
    const { fetchStub } = stubProfile(async () =>
      jsonResponse(200, { ...PROFILE_BODY, username: "aroha-t" }),
    );

    renderAt("/account");

    await amendUsername("aroha-t");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your details are saved.",
    );

    const put = fetchStub.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
    );

    expect(JSON.parse(String((put?.[1] as RequestInit).body))).toEqual({
      ...PROFILE_BODY,
      username: "aroha-t",
    });
  });
});
