import { describe, expect, it } from "vitest";
import { applyJsonPatch, diffJson } from "@/lib/editor/json-patch";

describe("json patch history", () => {
  it("replays and reverses element changes", () => {
    const before = { pages: [{ id: "p1", elements: [{ id: "e1", x: 10, text: "A" }] }] };
    const after = { pages: [{ id: "p1", elements: [{ id: "e1", x: 80, text: "B" }] }] };
    const forward = diffJson(before, after);
    const backward = diffJson(after, before);
    expect(applyJsonPatch(before, forward)).toEqual(after);
    expect(applyJsonPatch(after, backward)).toEqual(before);
    expect(forward.length).toBeLessThan(4);
  });
});
