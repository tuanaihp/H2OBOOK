import { expect, test } from "@playwright/test";

test("dashboard and authoring routes render", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("body")).toContainText(/H2OBOOK|Smart/i);
  await page.goto("/books");
  await expect(page.locator("body")).toContainText(/Sách|Book/i);
});
