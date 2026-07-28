import { describe, expect, it } from "vitest";
import { runBookPreflight } from "@/lib/editor/preflight";
import type { H2OBook, H2OElement } from "@/types/editor";

const permissions = { canEditContent: true, canMove: true, canResize: true, canDelete: true, canChangeColor: true };
const text = (id: string, order: number, overflow = false): H2OElement => ({
  id, type: "text", name: id, x: 20, y: 20 + order * 170, width: 400, height: 140,
  rotation: 0, opacity: 1, locked: false, hidden: false, text: "Nội dung", fill: "#222222",
  fontSize: 20, lineHeight: 1.3, flowChainId: "flow-1", flowOrder: order,
  flowSourceText: order === 0 ? "Nội dung nguồn dài" : undefined, flowOverflow: overflow, permissions,
});

const book = (elements: H2OElement[]): H2OBook => ({
  id: "book", title: "Sách kiểm thử", subtitle: "", author: "H2O", cover: "", status: "draft",
  updatedAt: new Date().toISOString(),
  pages: [{ id: "page", name: "Trang 1", width: 794, height: 1123, background: "#ffffff", elements }],
});

describe("Text Flow preflight", () => {
  it("reports remaining overflow on the final frame", () => {
    const result = runBookPreflight(book([text("a", 0), text("b", 1, true)]));
    expect(result.issues.some((issue) => issue.rule === "text_flow_overflow")).toBe(true);
  });

  it("reports duplicate frame order", () => {
    const duplicate = text("b", 0);
    duplicate.flowSourceText = undefined;
    const result = runBookPreflight(book([text("a", 0), duplicate]));
    expect(result.issues.some((issue) => issue.rule === "text_flow_order")).toBe(true);
  });
});
