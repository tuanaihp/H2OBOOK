import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { APP_VERSION, APP_VERSION_SHORT } from "@/lib/version";

describe("application version", () => {
  it("has exactly one value across lib/version.ts, package.json and VERSION", () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(readFileSync("VERSION", "utf8").trim()).toBe(APP_VERSION);
  });

  it("derives the short badge from the full version", () => {
    expect(APP_VERSION.startsWith(`${APP_VERSION_SHORT}.`)).toBe(true);
  });
});
