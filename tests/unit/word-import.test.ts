import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { wordHtmlToImportDocument } from "@h2obook/input-core";

const parser = (html: string) => new JSDOM(html).window.document;

describe("Word Import 2.0 semantic reconstruction", () => {
  it("preserves headings, inline marks, links, lists, tables, images and captions", () => {
    const result = wordHtmlToImportDocument({
      sourceFileName: "sample.docx", title: "Sample", bookId: "book-1", parser,
      assets: [{ assetId: "asset-1", previewUrl: "blob:test", fileName: "image.png", mimeType: "image/png" }],
      html: `<h1>Chương 1</h1><p>Nội dung <strong>đậm</strong> <em>nghiêng</em> <u>gạch</u> <a href="https://example.com">liên kết</a>.</p>
        <ul><li>Mục 1<ul><li>Mục con</li></ul></li></ul>
        <table><tr><th>Cột A</th><th>Cột B</th></tr><tr><td>1</td><td>2</td></tr></table>
        <img data-h2o-asset-id="asset-1" src="blob:test" alt="Ảnh"><p class="h2o-caption">Chú thích ảnh</p>`,
    });
    expect(result.document.root.some((node) => node.type === "heading")).toBe(true);
    expect(JSON.stringify(result.document.root)).toContain('"type":"bold"');
    expect(JSON.stringify(result.document.root)).toContain('"type":"link"');
    expect(result.statistics.lists).toBe(2);
    expect(result.statistics.tables).toBe(1);
    expect(result.statistics.images).toBe(1);
    expect(result.document.root.find((node) => node.type === "image")?.attrs.caption).toBe("Chú thích ảnh");
  });

  it("removes dangerous HTML and preserves page breaks", () => {
    const result = wordHtmlToImportDocument({
      sourceFileName: "unsafe.docx", title: "Unsafe", bookId: "book-2", parser,
      html: `<script>alert(1)</script><p onclick="alert(2)"><a href="javascript:alert(3)">Không an toàn</a></p><div class="h2o-page-break"></div>`,
    });
    expect(result.previewHtml).not.toContain("script");
    expect(result.previewHtml).not.toContain("onclick");
    expect(result.previewHtml).not.toContain("javascript:");
    expect(result.document.root.some((node) => node.type === "divider" && node.attrs.pageBreak)).toBe(true);
  });
});
