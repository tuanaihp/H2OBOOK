import { expect, test } from "@playwright/test";

test("knowledge universe preview is interactive", async ({ page }) => {
  await page.goto("/academy/knowledge-universe");
  await expect(page.getByRole("heading", { name: /Một bộ não tri thức/i })).toBeVisible();
  // Each node appears twice: as an orbiting planet (aria-label "<name>. <access>")
  // and as a plain link in the mobile rail. Target the planet explicitly, otherwise
  // the locator is ambiguous under strict mode and may resolve to the rail instead.
  await expect(page.locator('a[aria-label^="Thư viện sách"]')).toBeVisible();
  await page.locator('a[aria-label^="Strategy Hub"]').focus();
  await expect(page.getByRole("heading", { name: "Strategy Hub" })).toBeVisible();
});

test("knowledge universe has a mobile fallback", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/academy/knowledge-universe");
  await expect(page.getByLabel("Các hành tinh tri thức")).toBeVisible();
});
