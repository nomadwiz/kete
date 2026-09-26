import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Each test drives the real route tree from a fresh memory router, so nothing
// may survive between them: a token left in storage would sign the next test
// in, and a mounted tree would leave two copies of the navigation in the DOM.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
