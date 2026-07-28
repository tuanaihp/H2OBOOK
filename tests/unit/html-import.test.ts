import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHtmlImport } from "@/lib/input/html-import.server";

const fixture = (name: string) => readFileSync(join(process.cwd(), "tests/fixtures/input/html", name), "utf8");
const flatten = (nodes: ReturnType<typeof parseHtmlImport>["nodes"]): ReturnType<typeof parseHtmlImport>["nodes"] => nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe("HTML Import 2.0", () => {
  it("preserves semantic structure and resolves relative URLs", () => {
    const result = parseHtmlImport({ html: fixture("basic.html"), sourceFileName: "basic.html", sourceUrl: "https://academy.example/course/index.html", finalUrl: "https://academy.example/course/index.html", bookId: "book-1" });
    const nodes = flatten(result.nodes);
    expect(result.metadata.parser).toBe("jsdom-dom-2.0");
    expect(nodes.some((node) => node.type === "chapter")).toBe(true);
    expect(nodes.some((node) => node.type === "list" && node.children.some((item) => item.children.some((child) => child.type === "list")))).toBe(true);
    expect(nodes.some((node) => node.type === "table")).toBe(true);
    const image = nodes.find((node) => node.type === "image");
    expect(image?.attrs.sourceUrl).toBe("https://academy.example/images/makeup.jpg");
    expect(image?.attrs.caption).toBe("Bộ dụng cụ cơ bản");
    const paragraph = nodes.find((node) => node.type === "paragraph" && node.text?.some((span) => span.marks?.some((mark) => mark.type === "bold")));
    expect(paragraph).toBeTruthy();
  });

  it("removes active content and dangerous URLs", () => {
    const result = parseHtmlImport({ html: fixture("malicious.html"), sourceFileName: "malicious.html", sourceUrl: "https://academy.example/page.html", bookId: "book-2" });
    expect(result.previewHtml).not.toContain("<script");
    expect(result.previewHtml).not.toContain("onload");
    expect(result.previewHtml).not.toContain("onclick");
    expect(result.previewHtml).not.toContain("javascript:");
    expect(result.previewHtml).not.toContain("<form");
    expect(result.nodes.some((node) => node.type === "interactive" && node.attrs.provider === "youtube")).toBe(true);
    expect(result.warnings.some((warning) => warning.code === "HTML_SANITIZED")).toBe(true);
  });

  it("repairs malformed HTML without executing it", () => {
    const result = parseHtmlImport({ html: fixture("malformed.html"), sourceFileName: "malformed.html", bookId: "book-3" });
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.statistics.tables).toBe(1);
    expect(result.warnings.some((warning) => warning.severity === "error")).toBe(false);
  });
});
