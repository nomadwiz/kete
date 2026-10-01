import { render } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from "react-router";
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
// each method differently. Ignoring it is fine and most stubs do. `calls`
// still records the path alone, so a test that needs the method or the body
// reads fetchStub.mock.calls; widening `calls` would reword every assertion
// already written against it.
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

// The action a route pattern carries, found in the same real route tree
// renderAt draws, and called with a FormData the test built. This is how a
// submission carrying a file is tested: no form can deliver one under jsdom
// (src/test/setup.ts says why), but an action handed a FormData directly
// never builds a Request at all. `id` fills the one path parameter the recipe
// routes have.
export async function submitTo(
  path: string,
  form: FormData,
  id?: string,
): Promise<unknown> {
  const stack: RouteObject[] = [...routes];

  while (stack.length > 0) {
    const route = stack.pop()!;

    if (route.path === path && typeof route.action === "function") {
      return await route.action({
        params: { id },
        request: { formData: async () => form } as Request,
        context: {},
      } as never);
    }

    stack.push(...(route.children ?? []));
  }

  throw new Error(`No action on ${path}.`);
}

// GET /mealplan/summary's answer: seven days, Mon to Sun, each nutrient against
// TARGETS_BODY. Days not named are the empty day the contract describes --
// zero totals, the full negative difference, 0 percent. The two derived
// figures are worked out here the way ADR 007 says anything outside the server
// must, multiplying before dividing, so a fixture cannot disagree with the
// server by a rounding step. This is the test's arithmetic, not the screen's:
// the screen only prints what it is sent.
export function summaryBody(
  week: string,
  totals: Record<string, [number, number, number, number]> = {},
) {
  const nutrients = ["energy_kcal", "protein_g", "carbs_g", "fat_g"] as const;

  return {
    week,
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day_of_week: day,
      ...Object.fromEntries(
        nutrients.map((nutrient, index) => {
          const total = totals[day]?.[index] ?? 0;
          const target = TARGETS_BODY[nutrient];

          return [
            nutrient,
            {
              total,
              target,
              difference: total - target,
              percent: Math.round((total * 100) / target),
            },
          ];
        }),
      ),
    })),
  };
}
