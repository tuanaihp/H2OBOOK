import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSignedUrlMock } = vi.hoisted(() => ({
  getSignedUrlMock: vi.fn().mockResolvedValue("https://upload.example.test/signed")
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: getSignedUrlMock }));

import { createUploadUrl } from "@/lib/storage/r2";

const r2Environment = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
const previousEnvironment = new Map<string, string | undefined>();

describe("R2 upload presigning", () => {
  beforeEach(() => {
    getSignedUrlMock.mockClear();
    for (const key of r2Environment) previousEnvironment.set(key, process.env[key]);
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET = "test-bucket";
  });

  afterEach(() => {
    for (const key of r2Environment) {
      const previous = previousEnvironment.get(key);
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
    previousEnvironment.clear();
  });

  it("signs only headers that the browser upload actually replays", async () => {
    await createUploadUrl({
      key: "organization/assets/2026-09-02/photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024
    });

    expect(getSignedUrlMock).toHaveBeenCalledOnce();
    const command = getSignedUrlMock.mock.calls[0]?.[1] as { input: Record<string, unknown> };
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "organization/assets/2026-09-02/photo.jpg",
      ContentType: "image/jpeg"
    });
    expect(command.input).not.toHaveProperty("ContentLength");
    expect(command.input).not.toHaveProperty("Metadata");
  });
});
