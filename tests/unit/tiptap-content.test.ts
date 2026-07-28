import { describe, expect, it } from "vitest";
import { semanticNodesToTiptapDoc, tiptapDocToSemanticNodes } from "@/lib/editor/tiptap-content";
import type { SemanticContentNode } from "@h2obook/content-core";

const nodes: SemanticContentNode[] = [{
  id: "chapter-1", type: "chapter", parentId: null, position: 0, version: 1,
  attrs: { label: "Chương 1" },
  children: [
    { id: "heading-1", type: "heading", parentId: "chapter-1", position: 0, version: 2, attrs: { level: 1 }, children: [], text: [{ text: "Nền trong trẻo", marks: [{ type: "bold" }] }] },
    { id: "paragraph-1", type: "paragraph", parentId: "chapter-1", position: 1, version: 1, attrs: {}, children: [], text: [{ text: "Nội dung có ", marks: [] }, { text: "liên kết", marks: [{ type: "link", attrs: { href: "https://h2obook.vn" } }] }] },
    { id: "table-1", type: "table", parentId: "chapter-1", position: 2, version: 1, attrs: {}, text: undefined, children: [
      { id: "row-1", type: "table_row", parentId: "table-1", position: 0, version: 1, attrs: {}, children: [
        { id: "cell-1", type: "table_cell", parentId: "row-1", position: 0, version: 1, attrs: { header: true }, children: [
          { id: "cell-p-1", type: "paragraph", parentId: "cell-1", position: 0, version: 1, attrs: {}, children: [], text: [{ text: "Bước" }] },
        ] },
      ] },
    ] },
  ],
}];

describe("Compose semantic bridge", () => {
  it("preserves semantic IDs, marks and tables through a Tiptap JSON round trip", () => {
    const json = semanticNodesToTiptapDoc(nodes);
    const restored = tiptapDocToSemanticNodes(json);
    expect(restored[0].id).toBe("chapter-1");
    expect(restored[0].children[0].id).toBe("heading-1");
    expect(restored[0].children[0].text?.[0].marks?.[0].type).toBe("bold");
    expect(JSON.stringify(restored)).toContain("table_cell");
    expect(JSON.stringify(restored)).toContain("https://h2obook.vn");
  });
});
