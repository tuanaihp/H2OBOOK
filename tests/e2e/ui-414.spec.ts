import { expect, test } from "@playwright/test";

test("public academy is accessible without workspace chrome", async ({ page }) => {
  await page.goto("/");
  // The public hero is the Knowledge Universe landing surface; the legacy hero copy
  // ("Biến kiến thức nghề Makeup") only renders when
  // NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1=false.
  await expect(page.getByRole("heading", { name: /Từ kiến thức Makeup đến/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chiến lược phát triển nghề" })).toBeVisible();
  await expect(page.locator(".quantum-sidebar")).toHaveCount(0);
});

test("student learning command center has learner navigation", async ({ page }) => {
  await page.goto("/student");
  await expect(page.getByRole("heading", { name: /^Chào,/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ưu tiên hôm nay" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Hỏi trợ lý học tập/i }).first()).toBeVisible();
});

test("workspace business routes remain available", async ({ page }) => {
  await page.goto("/store");
  await expect(page.getByRole("heading", { name: /H2OBOOK Store/i })).toBeVisible();
});
