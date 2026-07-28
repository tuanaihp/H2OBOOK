import { expect, test } from "@playwright/test";

test("public academy is accessible without workspace chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Biến kiến thức nghề Makeup/i })).toBeVisible();
  await expect(page.getByText("Strategy Intelligence Hub", { exact: false })).toBeVisible();
  await expect(page.locator(".quantum-sidebar")).toHaveCount(0);
});

test("student learning command center has learner navigation", async ({ page }) => {
  await page.goto("/student");
  await expect(page.getByRole("heading", { name: /Chào buổi sáng/i })).toBeVisible();
  await expect(page.getByText("NHIỆM VỤ HÔM NAY")).toBeVisible();
  await expect(page.getByRole("link", { name: /H2O Mentor/i }).first()).toBeVisible();
});

test("workspace business routes remain available", async ({ page }) => {
  await page.goto("/store");
  await expect(page.getByRole("heading", { name: /H2OBOOK Store/i })).toBeVisible();
});
