import { expect, test } from "@playwright/test";
import path from "node:path";

test.describe("Unified Input production paths", () => {
  test("opens the single gateway and imports a TXT preview", async ({ page }) => {
    await page.goto("/input");
    await expect(page.getByRole("heading", { name: "Unified Input Orchestrator" })).toBeVisible();
    await expect(page.locator(".input-source-card").first()).toContainText("PNG/JPEG/JPE");
    const chooser = page.locator('.input-source-card input[type="file"]').first();
    await chooser.setInputFiles({ name: "lesson.txt", mimeType: "text/plain", buffer: Buffer.from("Tiêu đề\n\nNội dung kiểm thử production") });
    await page.getByRole("button", { name: /Xử lý & tạo preview/ }).click();
    await expect(page.getByText(/Preview đã sẵn sàng/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Commit vào H2OBOOK/ })).toBeVisible();
  });

  test("rejects an unsupported URL protocol before processing", async ({ page }) => {
    await page.goto("/input");
    await page.getByPlaceholder("https://...").fill("file:///etc/passwd");
    await page.getByRole("button", { name: "Dùng URL" }).click();
    await expect(page.locator(".input-stage-message")).toContainText("INPUT_URL_PROTOCOL_UNSUPPORTED");
  });

  test("shows recovery after a session is created", async ({ page }) => {
    await page.goto("/input");
    const chooser = page.locator('.input-source-card input[type="file"]').first();
    await chooser.setInputFiles({ name: "recovery.txt", mimeType: "text/plain", buffer: Buffer.from("Recovery fixture") });
    await page.getByRole("button", { name: /Xử lý & tạo preview/ }).click();
    await expect(page.getByRole("button", { name: /Recovery/ })).toBeVisible({ timeout: 15_000 });
  });

  test("keeps uploaded page images visible after commit and editor navigation", async ({ page }) => {
    test.setTimeout(60_000);
    const canvasWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("H2OBOOK canvas")) canvasWarnings.push(message.text());
    });

    await page.goto("/input");
    const chooser = page.locator('.input-source-card input[type="file"]').first();
    await chooser.setInputFiles([
      path.resolve("tests/fixtures/input/image-ocr.png"),
      path.resolve("tests/fixtures/input/image-transparent.png"),
    ]);
    await page.locator(".input-action-row .btn-primary").click();
    await expect(page.locator(".unified-preview")).toBeVisible({ timeout: 30_000 });
    await page.locator(".unified-preview .btn-primary").click();

    const editorLink = page.locator('.unified-preview a[href^="/editor/"]');
    await expect(editorLink).toBeVisible({ timeout: 15_000 });
    await page.goto(String(await editorLink.getAttribute("href")));
    await expect(page.locator(".page-thumb-v2")).toHaveCount(2);

    // A missing blob/asset URL leaves this Konva layer completely white. Sampling
    // its actual pixels verifies the source image was recovered and drawn.
    await expect.poll(async () => page.locator(".canvas-wrap canvas").first().evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (!context) return 0;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonWhite = 0;
      for (let index = 0; index < pixels.length; index += 16) {
        if (pixels[index + 3] > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) nonWhite += 1;
      }
      return nonWhite;
    }), { timeout: 15_000 }).toBeGreaterThan(40);
    expect(canvasWarnings).toEqual([]);
  });

  test("commits image pages into a current local-only book", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/input?bookId=book_makeup_pro");
    const chooser = page.locator('.input-source-card input[type="file"]').first();
    await chooser.setInputFiles([
      path.resolve("tests/fixtures/input/image-ocr.png"),
      path.resolve("tests/fixtures/input/image-transparent.png"),
    ]);
    await expect(page.locator('select').filter({ has: page.locator('option[value="append_chapter"]') }).first()).toHaveValue("append_chapter");
    await page.locator(".input-action-row .btn-primary").click();
    await expect(page.locator(".unified-preview")).toBeVisible({ timeout: 30_000 });
    await page.locator(".unified-preview .btn-primary").click();
    await expect(page.locator('.unified-preview a[href^="/editor/"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".input-stage-message")).not.toContainText("BOOK_NOT_FOUND");
  });
});
