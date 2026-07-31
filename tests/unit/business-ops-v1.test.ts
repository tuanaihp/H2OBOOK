import { describe, expect, it } from "vitest";
import { businessSurfaceRegistry, isBusinessSurface } from "@/lib/business-ops-v1/registry";
import { businessPipeline } from "@/lib/business-ops-v1/pipeline";

 describe("Business Commerce & Growth Operations V1", () => {
  it("registers eight unique business surfaces", () => {
    expect(businessSurfaceRegistry).toHaveLength(8);
    expect(new Set(businessSurfaceRegistry.map((surface) => surface.id)).size).toBe(8);
  });
  it("keeps pipeline dependencies resolvable", () => {
    const ids = new Set(businessSurfaceRegistry.map((surface) => surface.id));
    for (const surface of businessSurfaceRegistry) for (const dependency of surface.dependencies) expect(ids.has(dependency)).toBe(true);
  });
  it("exposes a complete commerce pipeline", () => {
    expect(businessPipeline[0]?.surface).toBe("store");
    expect(businessPipeline.at(-1)?.surface).toBe("analytics");
    expect(isBusinessSurface("white-label")).toBe(true);
  });
});
