import { describe, expect, it } from "vitest";
import { groupPdfSpansIntoLines, pdfPagesToImportDocument, type PdfPageModel } from "@h2obook/input-core";

const page: PdfPageModel = {
  page: 1, width: 595, height: 842,
  spans: [
    { text: "CHƯƠNG 1", page: 1, x: 50, y: 790, width: 130, height: 28, fontSize: 28, fontName: "Arial-Bold", bold: true },
    { text: "Nội dung mở đầu", page: 1, x: 50, y: 740, width: 150, height: 12, fontSize: 12 },
    { text: "• Mục thứ nhất", page: 1, x: 50, y: 710, width: 110, height: 12, fontSize: 12 },
    { text: "• Mục thứ hai", page: 1, x: 50, y: 690, width: 110, height: 12, fontSize: 12 },
    { text: "Tên", page: 1, x: 50, y: 640, width: 30, height: 12, fontSize: 12, bold: true },
    { text: "Điểm", page: 1, x: 220, y: 640, width: 35, height: 12, fontSize: 12, bold: true },
    { text: "Lan", page: 1, x: 50, y: 620, width: 25, height: 12, fontSize: 12 },
    { text: "9", page: 1, x: 220, y: 620, width: 8, height: 12, fontSize: 12 },
  ],
};

describe("PDF semantic reconstruction", () => {
  it("groups spans into reading-order lines", () => {
    const lines = groupPdfSpansIntoLines(page);
    expect(lines.length).toBe(6);
    expect(lines[0].spans[0].text).toContain("CHƯƠNG");
  });

  it("creates heading, list and table nodes", () => {
    const result = pdfPagesToImportDocument({ pages: [page], title: "PDF Test", sourceFileName: "test.pdf", bookId: "book-1" });
    const chapter = result.document.root[0];
    expect(chapter.type).toBe("chapter");
    expect(result.statistics.headings).toBeGreaterThan(0);
    expect(result.statistics.lists).toBe(1);
    expect(result.statistics.tables).toBe(1);
    expect(result.warnings.some((warning) => warning.severity === "error")).toBe(false);
  });

  it("requires OCR when a PDF page has no text layer", () => {
    const result = pdfPagesToImportDocument({ pages: [{ page: 1, width: 595, height: 842, spans: [] }], title: "Scan", sourceFileName: "scan.pdf", bookId: "book-2" });
    expect(result.warnings.some((warning) => warning.code === "PDF_NO_TEXT_LAYER" && warning.severity === "error")).toBe(true);
  });
});
