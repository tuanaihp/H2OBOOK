import { describe, expect, it } from "vitest";
import { DESIGN_LIBRARY_CATALOG } from "@/lib/design-library/catalog";
import { buildDesignBook } from "@/lib/design-library/build-design-book";
import { defaultBrand } from "@/lib/mock-data";
import { createDefaultFieldValues } from "@/lib/design-library/smart-fields";
import { parseDesignCsv } from "@/lib/design-library/bulk";

 describe("Makeup Design Library", () => {
  it("contains all five requested categories", () => {
    const categories = new Set(DESIGN_LIBRARY_CATALOG.map((item) => item.category));
    expect(categories).toEqual(new Set(["fanpage-cover", "personal-profile", "student-invitation", "makeup-certificate", "makeup-promotion"]));
  });

  it("builds an editor-compatible H2OBook", () => {
    const template = DESIGN_LIBRARY_CATALOG.find((item) => item.id === "certificate-makeup-professional")!;
    const values = createDefaultFieldValues(template.fields, defaultBrand);
    const result = buildDesignBook({ template, brand: defaultBrand, values, targetFormat: template.baseFormat, useBrandKit: true });
    expect(result.book.pages).toHaveLength(1);
    expect(result.book.pages[0].elements.some((item) => item.type === "qr")).toBe(true);
    expect(result.book.status).toBe("draft");
  });

  it("parses bulk certificate CSV", () => {
    const rows = parseDesignCsv("studentName,certificateNo\nNguyễn Minh Anh,H2O-001\nTrần Thu Hà,H2O-002");
    expect(rows).toHaveLength(2);
    expect(rows[0].studentName).toBe("Nguyễn Minh Anh");
  });
});
