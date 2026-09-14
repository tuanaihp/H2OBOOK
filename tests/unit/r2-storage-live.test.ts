import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createUploadUrl, headStoredObject } from "@/lib/storage/r2";

const runLiveR2Test = process.env.RUN_R2_INTEGRATION === "1";

function loadLocalEnvironment() {
  const source = readFileSync(".env.local", "utf8");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

if (runLiveR2Test) loadLocalEnvironment();

function liveClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
    }
  });
}

describe("R2 live upload", () => {
  it.runIf(runLiveR2Test)("accepts the same presigned PUT headers used by the browser", async () => {
    for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
      expect(process.env[name], `${name} must be configured`).toBeTruthy();
    }

    const body = new TextEncoder().encode(`h2obook-r2-integration-${crypto.randomUUID()}`);
    const key = `integration-tests/presigned-put/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.txt`;
    const client = liveClient();

    try {
      const uploadUrl = await createUploadUrl({ key, contentType: "text/plain", sizeBytes: body.byteLength });
      const signedHeaders = new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders") ?? "";
      expect(signedHeaders).not.toContain("content-length");
      expect(signedHeaders).not.toContain("x-amz-meta-");

      const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;
      const preflight = await fetch(uploadUrl, {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "PUT",
          "access-control-request-headers": "content-type"
        }
      });
      expect(preflight.status, `R2 CORS preflight failed for ${origin}`).toBe(200);
      expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
      expect(preflight.headers.get("access-control-allow-methods")).toContain("PUT");

      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body
      });

      expect(response.status, await response.text()).toBe(200);
      await expect(headStoredObject(key)).resolves.toMatchObject({
        sizeBytes: body.byteLength,
        contentType: "text/plain"
      });
    } finally {
      await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
      client.destroy();
    }
  });
});
