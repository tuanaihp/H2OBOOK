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

  it("falls back to the same-origin proxy when browser CORS blocks the signed PUT", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "evidence.jpg", { type: "image/jpeg" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: "cloud", key: "org-1/student-competency/evidence.jpg", uploadUrl: "https://r2.example.test/signed" }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ asset: { id: "asset-1", storage_key: "org-1/student-competency/evidence.jpg", mime_type: "image/jpeg", original_name: "evidence.jpg", quarantine_status: "clean" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:preview") });

    const result = await uploadAsset(file, { organizationId: "org-1", category: "student-competency", assetType: "image" });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/storage/upload-proxy");
    expect(result).toMatchObject({ assetId: "asset-1", mode: "cloud", scanStatus: "clean" });
  });
});
