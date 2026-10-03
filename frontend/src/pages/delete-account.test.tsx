import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderAt, stubFetch } from "../test/router";

function signedIn() {
  window.localStorage.setItem("kete.token", "a-token");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function deleteAccount() {
  const user = userEvent.setup();

  await user.type(await screen.findByLabelText("Password"), "kumara-42");
  await user.click(
    screen.getByRole("button", { name: "Delete your account" }),
  );
}

// A JSON body on a DELETE, which is unusual enough to assert: the API reads the
// password from it, and a DELETE sent without one is answered 422.
describe("deleting the account", () => {
  it("sends the password, clears the token and lands on the home page", async () => {
    signedIn();
    const { fetchStub } = stubFetch({
      "/profile": async () => new Response(null, { status: 204 }),
    });

    const { router } = renderAt("/account/delete");

    await deleteAccount();

    expect(
      await screen.findByRole("heading", {
        name: "A week you can check before you cook.",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(window.localStorage.getItem("kete.token")).toBeNull();

    const [, init] = fetchStub.mock.calls[0];

    expect(init?.method).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({ password: "kumara-42" });
  });
});

// 403 is a wrong password, not a session end: the person is still signed in,
// so the token stays, and the message reaches the form's own role="alert"
// rather than the boundary that would print the same sentence.
describe("the delete form refused", () => {
  it("shows a 403 on the form and keeps the token", async () => {
    signedIn();
    stubFetch({
      "/profile": async () =>
        jsonResponse(403, { detail: "Current password is incorrect" }),
    });

    const { router } = renderAt("/account/delete");

    await deleteAccount();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Current password is incorrect",
    );
    expect(router.state.location.pathname).toBe("/account/delete");
    expect(window.localStorage.getItem("kete.token")).toBe("a-token");
  });

  it("sends a 404 to the error boundary", async () => {
    signedIn();
    stubFetch({
      "/profile": async () => jsonResponse(404, { detail: "User not found" }),
    });

    renderAt("/account/delete");

    await deleteAccount();

    expect(await screen.findByText("Status 404.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
