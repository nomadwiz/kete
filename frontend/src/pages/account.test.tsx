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

    // Nothing has been submitted, so nothing is confirmed. The screen tells a
    // save that worked from a form nobody has touched by the difference
    // between the null its action returns and the undefined React Router
    // answers until one has run -- so a release that stopped making that
    // distinction would greet every visitor with "Your details are saved."
    expect(screen.queryByRole("status")).toBeNull();
  });

  // The one place this screen departs from the two loaders beside it. GET
  // /profile answers 404 when the account behind the token is gone, which is a
  // failure rather than the "not filled in yet" state the metrics and targets
  // loaders catch -- and a later edit making all three consistent would leave
  // the screen reading fields off null.
  it("sends a 404 to the error boundary rather than drawing an empty form", async () => {
    signedIn();
    stubFetch({
      "/profile": async () => jsonResponse(404, { detail: "No such account" }),
    });

    renderAt("/account");

    expect(await screen.findByText("Status 404.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});

// The statuses the screen is built around. PUT /profile answers 409 when the
// username or email is already somebody else's, in one sentence for each, and
// 403 when either changes without the right current password. A person who has
// just typed a name has to see why while still holding what they typed.
//
// The assertion is not the message text alone. ErrorBoundary prints whatever
// it caught too, so a version that threw this status rather than returning it
// would render the same sentence and pass -- the defect C22 (#236) found on
// sign-in. What only the form renders is its own role="alert", above fields
// that still carry the typed values, at the address that was never left.
describe("the account form refused", () => {
  it.each([
    [409, "That username is already taken"],
    [409, "That email is already taken"],
    [403, "Current password is incorrect"],
  ])('shows a %i "%s" with the typed values intact', async (status, detail) => {
    signedIn();
    stubProfile(async () => jsonResponse(status, { detail }));

    const { router } = renderAt("/account");

    await amendUsername("taken");

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.getByLabelText("Username")).toHaveValue("taken");
    expect(screen.getByLabelText("First name")).toHaveValue("Aroha");
    expect(router.state.location.pathname).toBe("/account");
  });

  // The other half of the same rule. 403, 409 and 422 are answered by typing
  // something different; every other status the write can answer with is not,
  // so it goes to the boundary rather than appearing above a Save button that
  // can never work. A catch that took every ApiError would print "No such
  // account" as though it were a validation message.
  it("sends a 404 from the write to the error boundary", async () => {
    signedIn();
    stubProfile(async () => jsonResponse(404, { detail: "No such account" }));

    renderAt("/account");

    await amendUsername("taken");

    expect(await screen.findByText("Status 404.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
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

    const put = fetchStub.mock.calls.find(([, init]) => init?.method === "PUT");

    // Exactly these four, so the blank current password is not sent either:
    // the form sends nothing the person did not type. Leaving it out changes
    // nothing the API decides -- it treats an empty password as an absent one,
    // and asks for one only when the username or email changes.
    expect(put).toBeDefined();
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      ...PROFILE_BODY,
      username: "aroha-t",
    });
  });

  it("sends the current password when one is typed", async () => {
    signedIn();
    const { fetchStub } = stubProfile(async () =>
      jsonResponse(200, { ...PROFILE_BODY, username: "aroha-t" }),
    );

    renderAt("/account");

    await userEvent.type(
      await screen.findByLabelText(/Current password/),
      "kumara-42",
    );
    await amendUsername("aroha-t");

    await screen.findByRole("status");

    const put = fetchStub.mock.calls.find(([, init]) => init?.method === "PUT");

    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      ...PROFILE_BODY,
      username: "aroha-t",
      current_password: "kumara-42",
    });
  });
});
