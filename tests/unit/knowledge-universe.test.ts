import { describe, expect, it } from "vitest";
import { knowledgeUniverseNodes, knowledgeUniverseStages } from "@/lib/knowledge-universe/data";

describe("H2O Knowledge Universe", () => {
  it("keeps node ids and hrefs unique", () => {
    expect(new Set(knowledgeUniverseNodes.map((node) => node.id)).size).toBe(knowledgeUniverseNodes.length);
    expect(new Set(knowledgeUniverseNodes.map((node) => node.href)).size).toBe(knowledgeUniverseNodes.length);
  });

  it("covers all three orbit layers", () => {
    expect(new Set(knowledgeUniverseNodes.map((node) => node.orbit))).toEqual(new Set([1, 2, 3]));
  });

  it("contains public, student and workspace destinations", () => {
    expect(new Set(knowledgeUniverseNodes.map((node) => node.access))).toEqual(new Set(["public", "student", "workspace"]));
  });

  it("uses valid angles and complete metrics", () => {
    for (const node of knowledgeUniverseNodes) {
      expect(node.angle).toBeGreaterThanOrEqual(0);
      expect(node.angle).toBeLessThan(360);
      expect(node.metrics).toHaveLength(3);
      expect(node.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("defines the complete brain processing cycle", () => {
    expect(knowledgeUniverseStages.map((stage) => stage.id)).toEqual(["ingest", "connect", "personalize", "act"]);
    expect(knowledgeUniverseStages.at(-1)?.progress).toBe(100);
  });
});
