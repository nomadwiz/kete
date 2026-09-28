import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The client's half of the contract check, mirroring backend/tests/
// test_contract.py on the other side of it. That test fails when
// backend/openapi.json stops describing the app main.py builds; this one fails
// when src/types/api.ts stops matching backend/openapi.json.
//
// `npm run build` regenerates the file before tsc reads it, so the build
// cannot type-check against a stale copy whatever is committed. Nothing
// regenerates it before `npm test` or `npm run dev`, and both read the
// committed copy -- so without this, a contract change that nobody
// regenerated for would be caught at build time and nowhere earlier, and the
// dev server would keep type-checking screens against a contract the API no
// longer serves.
//
// The generator writes to stdout when it is given no --output, and that output
// is byte-for-byte what the file should hold (C21, nomadwiz/kete#235).
describe("src/types/api.ts", () => {
  it("is what openapi-typescript generates from backend/openapi.json", () => {
    const generated = execFileSync(
      "node_modules/.bin/openapi-typescript",
      ["../backend/openapi.json"],
      { encoding: "utf8" },
    );

    expect(generated).toBe(readFileSync("src/types/api.ts", "utf8"));
  });
});
