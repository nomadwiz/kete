import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";
import { request } from "./http";

// The first test in this project that drives the api layer directly rather
// than through renderAt, and deliberately so: C29 (nomadwiz/kete#288) asks for
// the traversal to be refused by request() itself, so a test that reached it
// through one screen would be a test of that screen's own guard instead --
// which is the thing the issue says is a convention rather than a mechanism.
// A third route that interpolates and forgets is what this has to catch, and
// no such route exists to render.
//
// VITE_API_BASE_URL is http://api.test here, set in vite.config.ts.

// The address is recorded here rather than read back off mock.calls, which is
// how stubFetch in src/test/router.tsx does it and what keeps the stub typed
// as fetch: a nullary vi.fn() has an empty tuple for its arguments, so
// mock.calls[0][0] does not compile.
function stub() {
  const sent: string[] = [];

  const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
    sent.push(String(input));

    return new Response(null, { status: 204 });
  });

  vi.stubGlobal("fetch", fetchStub);

  return { sent, fetchStub };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an address the URL parser would change", () => {
  // The defect itself. react-router decodes a path parameter before a loader
  // sees it, so /recipes/..%2Fprofile arrives as the path /recipes/../profile,
  // and the parser normalises that to /profile -- another endpoint under the
  // same bearer token.
  //
  // The absence of the call is the assertion, not the throw. An
  // implementation that sent the request and then complained would pass a
  // check on the rejection alone, having already done the thing the issue is
  // about.
  it("is refused before fetch is reached", async () => {
    const { fetchStub } = stub();

    await expect(request("/recipes/../profile")).rejects.toThrow(
      "Refusing to request an address that is not /recipes/../profile.",
    );
    expect(fetchStub).not.toHaveBeenCalled();
  });

  // The two spellings a check on the raw string would miss, which is why the
  // guard compares the parsed pathname instead of matching "../". Both
  // normalise to /profile, verified in node rather than assumed: a backslash
  // is a path separator for a special scheme, and %2e is decoded before the
  // segments are resolved. A single dot is here for the same reason -- it
  // changes the address without escaping anything.
  it.each([
    ["a backslash", "/recipes/..\\profile"],
    ["a percent-encoded dot", "/recipes/%2e%2e/profile"],
    ["a single-dot segment", "/recipes/./profile"],
  ])("is refused when the traversal is spelled with %s", async (_, path) => {
    const { fetchStub } = stub();

    await expect(request(path)).rejects.toThrow("Refusing to request");
    expect(fetchStub).not.toHaveBeenCalled();
  });

  // Not an ApiError, because no server answered. An ApiError carries a status
  // the screens branch on -- C26 (nomadwiz/kete#279) settled that each route
  // reads a status by what the contract says it means there -- and a status
  // nobody sent would be read as a refusal the person could act on. This is a
  // request the client built wrongly, so it belongs to the error boundary the
  // loader and action machinery throws it to.
  it("throws a plain Error and not an ApiError", async () => {
    stub();

    await expect(request("/recipes/../profile")).rejects.not.toBeInstanceOf(
      ApiError,
    );
  });
});

describe("an address the parser leaves alone", () => {
  // The guard has to be invisible to every call the application actually
  // makes. An implementation that refused too much would be caught here
  // rather than by a screen failing for an unrelated-looking reason.
  it.each([
    ["a plain path", "/profile", "http://api.test/profile"],
    ["an interpolated id", "/recipes/12", "http://api.test/recipes/12"],
    [
      "a query string",
      "/mealplan?week=2026-W39",
      "http://api.test/mealplan?week=2026-W39",
    ],
  ])("reaches fetch unchanged for %s", async (_, path, expected) => {
    const { sent } = stub();

    await request(path);

    expect(sent).toEqual([expected]);
  });

  // The escaped id recipeAction sends and the escaped week plannerAction's
  // clear branch sends, which both stay: %2F is not a separator, so the
  // parser keeps the segment whole and the address is the one that was asked
  // for. It travels to the API, which answers 422 -- a refusal the person can
  // read, rather than the error boundary this guard would otherwise hand
  // them. A guard that decoded before comparing would break both call sites.
  it("leaves an escaped segment escaped", async () => {
    const { sent } = stub();

    await request(`/recipes/${encodeURIComponent("../profile")}`);

    expect(sent).toEqual(["http://api.test/recipes/..%2Fprofile"]);
  });
});
