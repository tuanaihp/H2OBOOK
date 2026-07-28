import { describe, expect, it } from "vitest";
import {
  appendImportAsChapter,
  applyInputCorrections,
  canTransitionInputSession,
  createOrchestratedSession,
  inputFingerprint,
  plainTextToImportDocument,
  transitionInputSession,
} from "@h2obook/input-core";

describe("Unified Input Orchestrator", () => {
  it("creates deterministic fingerprints and blocks invalid transitions", () => {
    const source = { kind: "file" as const, fileName: "lesson.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 100 };
    const destination = { type: "new_book" as const };
    expect(inputFingerprint({ format: "docx", mode: "editable_content", source, destination })).toBe(inputFingerprint({ format: "docx", mode: "editable_content", source, destination }));
    const session = createOrchestratedSession({ sourceName: "lesson.docx", format: "docx", mode: "editable_content", source, destination });
    expect(canTransitionInputSession("created", "detected")).toBe(true);
    expect(() => transitionInputSession(session, "completed")).toThrow(/INPUT_INVALID_TRANSITION/);
  });

  it("applies corrections without mutating the source document", () => {
    const imported = plainTextToImportDocument({ sourceFileName: "notes.txt", text: "Dòng thứ nhất", format: "txt", bookId: crypto.randomUUID() });
    const paragraph = imported.document.root[0].children[0];
    const corrected = applyInputCorrections(imported.document, [{ nodeId: paragraph.id, text: "Đã sửa" }]);
    expect(corrected.root[0].children[0].text?.[0].text).toBe("Đã sửa");
    expect(imported.document.root[0].children[0].text?.[0].text).toBe("Dòng thứ nhất");
  });

  it("appends an import as an isolated chapter", () => {
    const existing = plainTextToImportDocument({ sourceFileName: "base.txt", text: "Nội dung cũ", format: "txt", bookId: crypto.randomUUID() }).document;
    const imported = plainTextToImportDocument({ sourceFileName: "new.md", text: "# Mới\nNội dung mới", format: "markdown", bookId: existing.bookId }).document;
    const merged = appendImportAsChapter(existing, imported, "Chương nhập");
    expect(merged.root).toHaveLength(2);
    expect(merged.root[1].text?.[0].text).toBe("Chương nhập");
    expect(merged.version).toBe(existing.version + 1);
  });
});
