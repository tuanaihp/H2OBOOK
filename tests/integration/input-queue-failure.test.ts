import { afterEach, describe, expect, it } from "vitest";
import { enqueueDocumentJob } from "@/lib/queue/document-queue";

const previousMode = process.env.NEXT_PUBLIC_APP_MODE;
const previousRedis = process.env.REDIS_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_APP_MODE = previousMode;
  if (previousRedis === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = previousRedis;
});

describe("Queue outage policy", () => {
  it("fails closed in production when Redis is absent", async () => {
    process.env.NEXT_PUBLIC_APP_MODE = "production";
    delete process.env.REDIS_URL;
    await expect(enqueueDocumentJob({ organizationId: crypto.randomUUID(), type: "ocr", input: { format: "png", mode: "ocr" } })).rejects.toThrow("REDIS_NOT_CONFIGURED");
  });
});
