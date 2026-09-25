import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// defineConfig comes from vitest/config rather than vite, which is the same
// function widened to accept the `test` block below. The build is unaffected.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // http.ts reads this once at module load and never hardcodes an address.
    // The tests stub fetch, so nothing is served here -- the value exists so
    // that the URL a stub is asserted against is stable and obviously fake.
    // TZ is pinned because targets.tsx formats on the machine's own zone: the
    // en-NZ locale fixes the order of the parts, not the offset. Without this
    // the timestamp assertion would pass in Auckland and fail everywhere else.
    env: { VITE_API_BASE_URL: "http://api.test", TZ: "Pacific/Auckland" },
  },
});
