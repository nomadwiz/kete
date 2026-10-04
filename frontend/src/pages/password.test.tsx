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

async function changePassword() {
  const user = userEvent.setup();

  await user.type(
    await screen.findByLabelText("Current password"),
    "kumara-42",
  );
  await user.type(screen.getByLabelText("New password"), "pikopiko-77");
  await user.click(screen.getByRole("button", { name: "Change password" }));
}

describe("changing the password", () => {
  it("sends both passwords and says the password is changed", async () => {
    signedIn();
    const { fetchStub } = stubFetch({
      "/profile/password": async () => new Response(null, { status: 204 }),
    });

    renderAt("/account/password");

    await changePassword();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your password is changed.",
    );

    const [, init] = fetchStub.mock.calls[0];

    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({
      current_password: "kumara-42",
      new_password: "pikopiko-77",
    });
  });

  // The form is uncontrolled, so without a reset both passwords would sit
  // under the confirmation, and a second Change would re-send the old current
  // password and be refused for it.
  it("empties both password fields after a change that worked", async () => {
    signedIn();
    stubFetch({
      "/profile/password": async () => new Response(null, { status: 204 }),
    });

    renderAt("/account/password");

    await changePassword();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your password is changed.",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  // useWrite's `succeeded` is true after each of these, so this is the case
  // that shows the reset follows every change and not only the first.
  it("empties them again after a second change in a row", async () => {
    signedIn();
    const { fetchStub } = stubFetch({
      "/profile/password": async () => new Response(null, { status: 204 }),
    });

    renderAt("/account/password");

    await changePassword();
    await screen.findByRole("status");
    await changePassword();

    await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your password is changed.",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });
});

// The form's own role="alert", not the text alone: ErrorBoundary prints the
// same sentence, so a 403 thrown rather than returned would pass a text match.
// 403 is a wrong current password, not a session end, so the person stays.
describe("the password form refused", () => {
  it("shows a 403 on the form, at the same address", async () => {
    signedIn();
    stubFetch({
      "/profile/password": async () =>
        jsonResponse(403, { detail: "Current password is incorrect" }),
    });

    const { router } = renderAt("/account/password");

    await changePassword();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Current password is incorrect",
    );
    expect(router.state.location.pathname).toBe("/account/password");
  });

  // The reason the form is uncontrolled: a refusal keeps what was typed.
  it("keeps both typed passwords after a 403", async () => {
    signedIn();
    stubFetch({
      "/profile/password": async () =>
        jsonResponse(403, { detail: "Current password is incorrect" }),
    });

    renderAt("/account/password");

    await changePassword();

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Current password")).toHaveValue("kumara-42");
    expect(screen.getByLabelText("New password")).toHaveValue("pikopiko-77");
  });

  it("sends a 404 to the error boundary", async () => {
    signedIn();
    stubFetch({
      "/profile/password": async () =>
        jsonResponse(404, { detail: "User not found" }),
    });

    renderAt("/account/password");

    await changePassword();

    expect(await screen.findByText("Status 404.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
