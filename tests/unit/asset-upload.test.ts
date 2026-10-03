import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAsset } from "@/lib/assets/asset-client";

describe("browser asset upload", () => {
  const previousMode = process.env.NEXT_PUBLIC_APP_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_MODE = "production";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (previousMode === undefined) delete process.env.NEXT_PUBLIC_APP_MODE;
    else process.env.NEXT_PUBLIC_APP_MODE = previousMode;
    vi.unstubAllGlobals();
  });

  it("attempts the direct presigned R2 PUT before any proxy fallback", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "evidence.jpg", { type: "image/jpeg" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: "cloud", key: "org-1/student-competency/evidence.jpg", uploadUrl: "https://r2.example.test/signed" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ asset: { id: "asset-1", storage_key: "org-1/student-competency/evidence.jpg", mime_type: "image/jpeg", original_name: "evidence.jpg", quarantine_status: "clean" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:preview") });

    const result = await uploadAsset(file, { organizationId: "org-1", category: "student-competency", assetType: "image" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://r2.example.test/signed");
    expect(result).toMatchObject({ assetId: "asset-1", mode: "cloud", scanStatus: "clean", previewUrl: "/api/assets/asset-1/raw" });
  });

  it("falls back to the same-origin proxy only when the direct PUT fails (bucket CORS missing)", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "evidence.jpg", { type: "image/jpeg" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: "cloud", key: "org-1/student-competency/evidence.jpg", uploadUrl: "https://r2.example.test/signed" }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch")) // blocked preflight surfaces as a network TypeError
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ asset: { id: "asset-1", storage_key: "org-1/student-competency/evidence.jpg", mime_type: "image/jpeg", original_name: "evidence.jpg", quarantine_status: "clean" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:preview") });

    const result = await uploadAsset(file, { organizationId: "org-1", category: "student-competency", assetType: "image" });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/storage/upload-proxy");
    expect(result).toMatchObject({ assetId: "asset-1", mode: "cloud" });
  });

  it("compresses image batches at 80% without reducing their pixel dimensions", async () => {
    const file = new File([new Uint8Array(100)], "page.png", { type: "image/png" });
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 2480, height: 3508, close }));
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => callback(new Blob([new Uint8Array(10)], { type })));
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob };
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: "cloud", key: "org-1/book-pages/page.webp", uploadUrl: "https://r2.example.test/signed" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ asset: { id: "asset-page", storage_key: "org-1/book-pages/page.webp", mime_type: "image/webp", original_name: "page.webp", quarantine_status: "clean" }, scan: { status: "clean" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadAsset(file, { organizationId: "org-1", category: "book-pages", compress: true });

    expect(canvas.width).toBe(2480);
    expect(canvas.height).toBe(3508);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.8);
    expect(close).toHaveBeenCalledOnce();
    expect(result.previewUrl).toBe("/api/assets/asset-page/raw");
  });
});
