import { expect, test } from "@playwright/test";

test("customer portal renders for the demo owner", async ({ page }) => {
  await page.goto("/customer");
  await expect(page).toHaveURL(/\/customer$/);
  await expect(page.getByText("Tổng quan đăng ký", { exact: false })).toBeVisible();
});

test("instructor workspace renders for the demo owner", async ({ page }) => {
  await page.goto("/instructor/classes");
  await expect(page).toHaveURL(/\/instructor\/classes$/);
  await expect(page.getByRole("link", { name: "Command Center" })).toBeVisible();
});

test("operations center renders admissions pipeline", async ({ page }) => {
  await page.goto("/operations/admissions");
  await expect(page).toHaveURL(/\/operations\/admissions$/);
  await expect(page.getByText("Pipeline tuyển sinh", { exact: false })).toBeVisible();
});

test("platform admin is unreachable until a real platform_admin role exists", async ({ page }) => {
  await page.goto("/platform-admin");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("certificate verification is public and shows only public fields", async ({ page }) => {
  await page.goto("/verify/H2O-MUP-2026-0018");
  await expect(page.getByText("Chứng nhận hợp lệ")).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/verificationToken|verification_token/i);
});

test("unknown certificate number reports invalid, not an error page", async ({ page }) => {
  const response = await page.goto("/verify/DOES-NOT-EXIST-0000");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Không tìm thấy chứng nhận hợp lệ")).toBeVisible();
});

test("workspace sidebar surfaces Operations Center under System", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.locator('a[href="/operations"]')).toBeVisible();
});
