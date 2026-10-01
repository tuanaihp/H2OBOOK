import { describe, expect, it } from "vitest";
import type { ImportDocument } from "@h2obook/input-core";
import { extractStudentNoteText, getStudentNoteConfidence } from "@/lib/student-competency/note-ocr";

function result(): ImportDocument {
  const paragraph = (id: string, text: string) => ({ id, type: "paragraph" as const, parentId: "chapter", position: 0, text: [{ text }], attrs: {}, children: [], version: 1 });
  return {
    format: "jpeg", sourceFileName: "notes.jpg", title: "Notes", assets: [], warnings: [], statistics: { nodes: 3, headings: 0, paragraphs: 3, lists: 0, tables: 0, images: 0, footnotes: 0, words: 7 }, metadata: { averageConfidence: "82.6" },
    nodes: [],
    document: { id: "doc", bookId: "book", title: "Notes", language: "vi", metadata: {}, version: 1, createdAt: "", updatedAt: "", root: [{ id: "chapter", type: "chapter", parentId: null, position: 0, attrs: {}, version: 1, text: [], children: [paragraph("p1", "  Tone nền   hơi sáng "), paragraph("p2", "Tone nền hơi sáng"), paragraph("p3", "Cần sửa viền môi")] }] },
  };
}

describe("student note OCR helpers", () => {
  it("builds an editable note and removes consecutive duplicate lines", () => {
    expect(extractStudentNoteText(result())).toBe("Tone nền hơi sáng\nCần sửa viền môi");
  });

  it("normalizes OCR confidence", () => {
    expect(getStudentNoteConfidence(result())).toBe(83);
  });
});
