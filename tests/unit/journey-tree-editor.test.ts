import { describe, expect, it } from "vitest";
import { computeSiblingSwap, findOutsidePrerequisiteReferences } from "@/lib/learn-outcome/tree-helpers";

describe("computeSiblingSwap", () => {
  const siblings = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
    { id: "c", position: 2 }
  ];

  it("swaps with the previous sibling when moving up", () => {
    const swap = computeSiblingSwap(siblings, "b", -1);
    expect(swap?.current.id).toBe("b");
    expect(swap?.swapWith.id).toBe("a");
  });

  it("swaps with the next sibling when moving down", () => {
    const swap = computeSiblingSwap(siblings, "b", 1);
    expect(swap?.current.id).toBe("b");
    expect(swap?.swapWith.id).toBe("c");
  });

  it("refuses to move the first sibling further up", () => {
    expect(computeSiblingSwap(siblings, "a", -1)).toBeNull();
  });

  it("refuses to move the last sibling further down", () => {
    expect(computeSiblingSwap(siblings, "c", 1)).toBeNull();
  });

  it("does not depend on input order — sorts by position itself", () => {
    const shuffled = [siblings[2], siblings[0], siblings[1]];
    const swap = computeSiblingSwap(shuffled, "b", -1);
    expect(swap?.swapWith.id).toBe("a");
  });

  it("returns null for a node id not present in the list", () => {
    expect(computeSiblingSwap(siblings, "not-there", 1)).toBeNull();
  });
});

describe("findOutsidePrerequisiteReferences (§8 safe-delete)", () => {
  it("flags a Mission outside the subtree that depends on one inside it", () => {
    const candidates = [{ id: "outside-mission", title: "Ngoài phạm vi" }];
    const result = findOutsidePrerequisiteReferences(candidates, ["inside-1", "inside-2"]);
    expect(result).toEqual(candidates);
  });

  it("does not flag a reference from within the same subtree being deleted together", () => {
    const candidates = [{ id: "inside-2", title: "Cũng trong phạm vi" }];
    const result = findOutsidePrerequisiteReferences(candidates, ["inside-1", "inside-2"]);
    expect(result).toEqual([]);
  });

  it("handles a mix of inside and outside references", () => {
    const candidates = [
      { id: "inside-1", title: "Trong phạm vi" },
      { id: "outside-a", title: "Ngoài A" },
      { id: "outside-b", title: "Ngoài B" }
    ];
    const result = findOutsidePrerequisiteReferences(candidates, ["inside-1", "inside-2"]);
    expect(result.map((r) => r.id)).toEqual(["outside-a", "outside-b"]);
  });
});
