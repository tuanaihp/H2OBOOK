import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: {
    "@": path.resolve(__dirname, "."),
    "@h2obook/content-core": path.resolve(__dirname, "packages/content-core/src/index.ts"),
    "@h2obook/publishing-core": path.resolve(__dirname, "packages/publishing-core/src/index.ts"),
    "@h2obook/ingestion-core": path.resolve(__dirname, "packages/ingestion-core/src/index.ts"),
    "@h2obook/automation-core": path.resolve(__dirname, "packages/automation-core/src/index.ts"),
    "@h2obook/growth-reader-core": path.resolve(__dirname, "packages/growth-reader-core/src/index.ts"),
    "@h2obook/education-core": path.resolve(__dirname, "packages/education-core/src/index.ts"),
    "@h2obook/analytics-core": path.resolve(__dirname, "packages/analytics-core/src/index.ts"),
    "@h2obook/optional-assist-core": path.resolve(__dirname, "packages/optional-assist-core/src/index.ts"),
    "@h2obook/enterprise-core": path.resolve(__dirname, "packages/enterprise-core/src/index.ts"),
    "@h2obook/input-core": path.resolve(__dirname, "packages/input-core/src/index.ts")
  } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: { reporter: ["text", "json-summary", "html"] }
  }
});
