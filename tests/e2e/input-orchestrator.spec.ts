import { expect, test } from "@playwright/test";

test.describe("Unified Input production paths", () => {
  test("opens the single gateway and imports a TXT preview", async ({ page }) => {
    await page.goto("/input");
    await expect(page.getByRole("heading", { name: "Unified Input Orchestrator" })).toBeVisible();
    await expect(page.getByText(/DOCX, PDF, PNG, JPEG\/JPE/)).toBeVisible();
    const chooser = page.locator('input[type="file"]');
    await chooser.setInputFiles({ name: "lesson.txt", mimeType: "text/plain", buffer: Buffer.from("Tiêu đề\n\nNội dung kiểm thử production") });
    await expect(page.getByText(/Preview|Sẵn sàng|đã sẵn sàng/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Commit vào H2OBOOK/ })).toBeVisible();
  });

  test("rejects an unsupported URL protocol before processing", async ({ page }) => {
    await page.goto("/input");
    await page.getByPlaceholder("https://...").fill("file:///etc/passwd");
    await page.getByRole("button", { name: "Dùng URL" }).click();
    await expect(page.getByText(/URL|protocol|hợp lệ|INVALID/i)).toBeVisible();
  });

  test("shows recovery after a session is created", async ({ page }) => {
    await page.goto("/input");
    const chooser = page.locator('input[type="file"]');
    await chooser.setInputFiles({ name: "recovery.txt", mimeType: "text/plain", buffer: Buffer.from("Recovery fixture") });
    await page.getByRole("button", { name: /Xử lý & tạo preview/ }).click();
    await expect(page.getByRole("button", { name: /Recovery/ })).toBeVisible({ timeout: 15_000 });
  });
});
