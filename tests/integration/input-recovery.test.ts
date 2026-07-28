import { describe, expect, it } from "vitest";
import { createOrchestratedSession, inputStatusCanRetry, transitionInputSession } from "@h2obook/input-core";

describe("Input recovery policy", () => {
  it("caps attempts and preserves a recovery path", () => {
    const source = { kind: "file" as const, fileName: "scan.pdf", mimeType: "application/pdf", sizeBytes: 100 };
    let session = createOrchestratedSession({ sourceName: "scan.pdf", format: "pdf", mode: "ocr", source, destination: { type: "new_book" } });
    session = transitionInputSession(session, "failed", { attempt: 2, retryable: true });
    expect(inputStatusCanRetry(session)).toBe(true);
    session = { ...session, attempt: 3 };
    expect(inputStatusCanRetry(session)).toBe(false);
  });
});
