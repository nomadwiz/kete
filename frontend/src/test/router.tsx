import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";

import { routes } from "../routes";

// The real route array from routes.tsx, not a reconstruction of it. That is
// the point of these tests: where the error boundaries are mounted and which
// loader a path carries are the things under test, so a test tree that
// declared its own routes would assert nothing about the application.
export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  return { router, ...render(<RouterProvider router={router} />) };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// One fetch stub, keyed on the path. An unlisted path fails the test loudly
// rather than returning a plausible empty answer, because a screen quietly
// rendering from a request nobody meant to allow is the thing worth catching.
//
// The handler is given the request's own init, so a path a screen both reads
// and writes -- /profile, which the account screen GETs and PUTs -- can answer
// each method differently. Ignoring it is fine and most stubs do.
export function stubFetch(
  byPath: Record<string, (init?: RequestInit) => Promise<Response>>,
) {
  const calls: string[] = [];

  const fetchStub = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const path = url.replace("http://api.test", "");

      calls.push(path);

      const handler = byPath[path];

      if (!handler) {
        throw new Error(`No stub for ${path}`);
      }

      return handler(init);
    },
  );

  vi.stubGlobal("fetch", fetchStub);

  return { calls, fetchStub };
}

export const TARGETS_BODY = {
  energy_kcal: 2480,
  protein_g: 186,
  carbs_g: 248,
  fat_g: 83,
  computed_at: "2026-09-25T09:14:00Z",
};
