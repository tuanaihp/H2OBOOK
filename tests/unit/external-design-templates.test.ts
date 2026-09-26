import { describe, expect, it } from "vitest";
import { convertPolotnoToTemplate, isH2ODesignPack, isPolotnoDesign, pagesToDesignPack, parseDesignPack } from "@/lib/design-library/external-templates";
import { buildDesignBook } from "@/lib/design-library/build-design-book";
import { defaultBrand } from "@/lib/mock-data";
import type { H2OPage } from "@/types/editor";

const polotnoSample = {
  width: 1200,
  height: 628,
  pages: [{
    background: "rgba(0,0,0,1)",
    children: [
      { type: "text", x: 10, y: 20, width: 500, height: 60, rotation: 0, opacity: 1, text: "{{headline}}", fontSize: 48, fontFamily: "Archivo Black", fontWeight: "bold", fill: "#ffffff", align: "center", lineHeight: 1.2 },
      { type: "figure", x: 0, y: 0, width: 1200, height: 80, fill: "#8f174d" },
      { type: "image", x: 100, y: 200, width: 400, height: 300, src: "https://example.com/photo.jpg" },
      { type: "image", x: 500, y: 200, width: 100, height: 100, src: "data:image/png;base64,AAAA" }
    ]
  }]
};

describe("external design templates", () => {
  it("detects pack and polotno formats", () => {
    expect(isPolotnoDesign(polotnoSample)).toBe(true);
    expect(isH2ODesignPack(polotnoSample)).toBe(false);
    expect(isH2ODesignPack({ format: "h2odesign-pack", templates: [] })).toBe(true);
  });

  it("converts polotno children to editor elements and drops base64 images with a warning", () => {
    const { templates, warnings } = convertPolotnoToTemplate(polotnoSample, "Sale");
    expect(templates).toHaveLength(1);
    const page = templates[0].snapshot![0];
    expect(page.width).toBe(1200);
    expect(page.elements.map((e) => e.type)).toEqual(["text", "shape", "image"]);
    expect(templates[0].fields.some((f) => f.key === "headline")).toBe(true);
    expect(warnings.some((w) => w.includes("base64"))).toBe(true);
  });

  it("round-trips a saved page through the pack format and substitutes {{fields}}", () => {
    const page: H2OPage = {
      id: "p1", name: "Trang 1", width: 1080, height: 1080, background: "#101018",
      elements: [{
        id: "t1", type: "text", name: "T", x: 0, y: 0, width: 500, height: 60, rotation: 0, opacity: 1, locked: false, hidden: false,
        text: "Chào {{studentName}}", fontSize: 40, fill: "#fff",
        permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: true, canChangeColor: true }
      }]
    };
    const pack = pagesToDesignPack([page], { name: "Test pack" });
    const { templates, warnings } = parseDesignPack(pack);
    expect(warnings).toHaveLength(0);
    expect(templates).toHaveLength(1);
    const result = buildDesignBook({ template: templates[0], brand: defaultBrand, values: { studentName: "Minh Anh" }, targetFormat: "square-post", useBrandKit: false });
    expect(result.book.pages[0].elements[0].text).toBe("Chào Minh Anh");
    expect(result.book.pages[0].elements[0].id).not.toBe("t1");
  });

  it("rejects invalid files with a clear warning", () => {
    const { templates, warnings } = parseDesignPack({ format: "other" });
    expect(templates).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
