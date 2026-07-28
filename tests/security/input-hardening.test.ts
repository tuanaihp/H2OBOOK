import { describe, expect, it } from "vitest";
import { computeRetryDelayMs, redactInputTelemetry, validateCorrections, validateInputSessionEnvelope } from "@h2obook/input-core";

describe("Input production hardening", () => {
  it("uses bounded retry backoff", () => {
    expect(computeRetryDelayMs(0, { random: 0.5 })).toBe(2000);
    expect(computeRetryDelayMs(10, { random: 0.5 })).toBeLessThanOrEqual(120000);
  });
  it("redacts content and credentials from telemetry", () => {
    const value = redactInputTelemetry({ content: "private", authorization: "Bearer secret", metrics: { nodes: 4 } }) as Record<string, unknown>;
    expect(value.content).toBe("[REDACTED]");
    expect(value.authorization).toBe("[REDACTED]");
    expect(value.metrics).toEqual({ nodes: 4 });
  });
  it("blocks correction floods and oversized URL envelopes", () => {
    expect(() => validateCorrections(Array.from({ length: 5001 }, (_, index) => ({ nodeId: `node-${index}` })))).toThrow("INPUT_CORRECTION_LIMIT_EXCEEDED");
    expect(() => validateInputSessionEnvelope({ sourceName: "URL", format: "url", mode: "editable_content", source: { kind: "url", url: `https://example.com/${"x".repeat(2100)}` }, destination: { type: "new_book" } })).toThrow("INPUT_URL_INVALID");
  });
});
