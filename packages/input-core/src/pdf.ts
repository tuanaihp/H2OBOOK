import type { BookDocument, RichTextSpan, SemanticContentNode, TextMark } from "@h2obook/content-core";
import type { ImportDocument, ImportStatistics, ImportWarning } from "./types";

export type PdfSpan = {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
};

export type PdfPageModel = {
  page: number;
  width: number;
  height: number;
  spans: PdfSpan[];
  imageCount?: number;
};

export type PdfReconstructionInput = {
  pages: PdfPageModel[];
  title: string;
  sourceFileName: string;
  bookId: string;
  organizationId?: string;
  engine?: string;
  warnings?: ImportWarning[];
};

type PdfLine = {
  page: number;
  y: number;
  x: number;
  width: number;
  height: number;
  fontSize: number;
  spans: PdfSpan[];
};

function uid(prefix = "pdf") {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function node(type: SemanticContentNode["type"], position: number, attrs: Record<string, unknown> = {}, text?: RichTextSpan[], children: SemanticContentNode[] = []): SemanticContentNode {
  const id = uid(type);
  children.forEach((child, index) => { child.parentId = id; child.position = index; });
  return { id, type, parentId: null, position, attrs, text, children, version: 1 };
}

function median(values: number[]) {
  if (!values.length) return 12;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeSpaces(value: string) {
  return value.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim();
}

function marksOf(span: PdfSpan): TextMark[] | undefined {
  const marks: TextMark[] = [];
  if (span.bold || /bold|black|heavy|semibold|demi/i.test(`${span.fontName ?? ""} ${span.fontFamily ?? ""}`)) marks.push({ type: "bold" });
  if (span.italic || /italic|oblique/i.test(`${span.fontName ?? ""} ${span.fontFamily ?? ""}`)) marks.push({ type: "italic" });
  return marks.length ? marks : undefined;
}

function marksEqual(a?: TextMark[], b?: TextMark[]) { return JSON.stringify(a ?? []) === JSON.stringify(b ?? []); }

function lineRichText(line: PdfLine): RichTextSpan[] {
  const ordered = [...line.spans].sort((a, b) => a.x - b.x);
  const output: RichTextSpan[] = [];
  let previous: PdfSpan | null = null;
  for (const span of ordered) {
    const raw = span.text.replace(/\s+/g, " ");
    if (!raw.trim()) continue;
    const gap = previous ? span.x - (previous.x + previous.width) : 0;
    const needsSpace = Boolean(previous) && gap > Math.max(1.5, Math.min(previous!.fontSize, span.fontSize) * 0.18) && !/^[,.;:!?%)\]}]/.test(raw);
    const text = `${needsSpace ? " " : ""}${raw}`;
    const marks = marksOf(span);
    const last = output[output.length - 1];
    if (last && marksEqual(last.marks, marks)) last.text += text;
    else output.push({ text, marks });
    previous = span;
  }
  return output;
}

export function groupPdfSpansIntoLines(page: PdfPageModel): PdfLine[] {
  const spans = page.spans.filter((item) => normalizeSpaces(item.text)).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfLine[] = [];
  for (const span of spans) {
    const tolerance = Math.max(2, span.fontSize * 0.42);
    let current = lines.find((line) => Math.abs(line.y - span.y) <= Math.max(tolerance, line.fontSize * 0.35));
    if (!current) {
      current = { page: page.page, y: span.y, x: span.x, width: span.width, height: span.height, fontSize: span.fontSize, spans: [] };
      lines.push(current);
    }
    current.spans.push(span);
    current.x = Math.min(current.x, span.x);
    current.width = Math.max(current.width, span.x + span.width - current.x);
    current.height = Math.max(current.height, span.height);
    current.fontSize = Math.max(current.fontSize, span.fontSize);
    current.y = (current.y * (current.spans.length - 1) + span.y) / current.spans.length;
  }
  return lines.sort((a, b) => b.y - a.y || a.x - b.x);
}

function lineText(line: PdfLine) { return normalizeSpaces(lineRichText(line).map((item) => item.text).join("")); }
function bulletMatch(value: string) { return value.match(/^\s*(?:[•◦▪‣–—-]|\d+[.)]|[a-zA-Z][.)])\s+(.+)$/); }

function splitTableCells(line: PdfLine) {
  const spans = [...line.spans].sort((a, b) => a.x - b.x).filter((span) => normalizeSpaces(span.text));
  const cells: PdfSpan[][] = [];
  for (const span of spans) {
    const current = cells[cells.length - 1];
    const previous = current?.[current.length - 1];
    const gap = previous ? span.x - (previous.x + previous.width) : 0;
    if (!current || gap > Math.max(18, line.fontSize * 2.2)) cells.push([span]);
    else current.push(span);
  }
  return cells;
}

function tableSignature(line: PdfLine) { return splitTableCells(line).map((cell) => Math.round(cell[0].x / 12) * 12); }
function similarColumns(a: number[], b: number[]) { return a.length === b.length && a.length >= 2 && a.every((value, index) => Math.abs(value - b[index]) <= 18); }

function makeTable(lines: PdfLine[], position: number): SemanticContentNode {
  const rows = lines.map((line, rowIndex) => {
    const cells = splitTableCells(line).map((cell, cellIndex) => {
      const fake: PdfLine = { ...line, spans: cell, x: cell[0]?.x ?? line.x };
      return node("table_cell", cellIndex, { header: rowIndex === 0, bbox: [fake.x, fake.y - fake.height, fake.width, fake.height] }, undefined, [node("paragraph", 0, {}, lineRichText(fake))]);
    });
    return node("table_row", rowIndex, {}, undefined, cells);
  });
  return node("table", position, { columns: Math.max(0, ...rows.map((row) => row.children.length)), source: "pdf-column-heuristic" }, undefined, rows);
}

function pageNodes(page: PdfPageModel): SemanticContentNode[] {
  const lines = groupPdfSpansIntoLines(page);
  const bodySize = median(lines.map((line) => line.fontSize).filter((size) => size > 0));
  const children: SemanticContentNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const text = lineText(line);
    if (!text) { index += 1; continue; }

    const cells = splitTableCells(line);
    if (cells.length >= 2) {
      const signature = tableSignature(line);
      const tableLines = [line];
      let cursor = index + 1;
      while (cursor < lines.length && similarColumns(signature, tableSignature(lines[cursor])) && Math.abs(lines[cursor - 1].y - lines[cursor].y) < bodySize * 3.5) {
        tableLines.push(lines[cursor]); cursor += 1;
      }
      if (tableLines.length >= 2) {
        children.push(makeTable(tableLines, children.length));
        index = cursor;
        continue;
      }
    }

    const bullet = bulletMatch(text);
    if (bullet) {
      const items: SemanticContentNode[] = [];
      let cursor = index;
      while (cursor < lines.length) {
        const candidate = lineText(lines[cursor]);
        const match = bulletMatch(candidate);
        if (!match) break;
        items.push(node("list_item", items.length, { sourceBbox: [lines[cursor].x, lines[cursor].y - lines[cursor].height, lines[cursor].width, lines[cursor].height] }, [{ text: match[1] }]));
        cursor += 1;
      }
      children.push(node("list", children.length, { ordered: /^\s*(?:\d+|[a-zA-Z])[.)]/.test(text) }, undefined, items));
      index = cursor;
      continue;
    }

    const relative = line.fontSize / Math.max(1, bodySize);
    const headingLevel = relative >= 1.65 ? 1 : relative >= 1.35 ? 2 : relative >= 1.18 && text.length < 120 ? 3 : undefined;
    const attrs = {
      page: page.page,
      bbox: [line.x, page.height - line.y - line.height, line.width, line.height],
      fontSize: line.fontSize,
      fontName: line.spans[0]?.fontName ?? null,
      readingOrder: children.length,
      ...(headingLevel ? { level: headingLevel } : {}),
    };
    children.push(node(headingLevel ? "heading" : "paragraph", children.length, attrs, lineRichText(line)));
    index += 1;
  }
  return children;
}

function statistics(nodes: SemanticContentNode[]): ImportStatistics {
  const value: ImportStatistics = { nodes: 0, headings: 0, paragraphs: 0, lists: 0, tables: 0, images: 0, footnotes: 0, words: 0 };
  const visit = (items: SemanticContentNode[]) => items.forEach((item) => {
    value.nodes += 1;
    if (item.type === "heading") value.headings += 1;
    if (item.type === "paragraph") value.paragraphs += 1;
    if (item.type === "list") value.lists += 1;
    if (item.type === "table") value.tables += 1;
    if (item.type === "image") value.images += 1;
    if (item.type === "footnote") value.footnotes += 1;
    value.words += (item.text?.map((span) => span.text).join("") ?? "").trim().split(/\s+/).filter(Boolean).length;
    visit(item.children);
  });
  visit(nodes);
  return value;
}

function previewHtml(nodes: SemanticContentNode[]) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] ?? char));
  const render = (item: SemanticContentNode): string => {
    const text = escape(item.text?.map((span) => span.text).join("") ?? "");
    if (item.type === "heading") return `<h${Number(item.attrs.level ?? 2)}>${text}</h${Number(item.attrs.level ?? 2)}>`;
    if (item.type === "paragraph") return `<p>${text}</p>`;
    if (item.type === "list") return `<${item.attrs.ordered ? "ol" : "ul"}>${item.children.map((child) => `<li>${escape(child.text?.map((span) => span.text).join("") ?? "")}</li>`).join("")}</${item.attrs.ordered ? "ol" : "ul"}>`;
    if (item.type === "table") return `<table>${item.children.map((row) => `<tr>${row.children.map((cell) => `<td>${cell.children.map(render).join("")}</td>`).join("")}</tr>`).join("")}</table>`;
    if (item.type === "chapter") return `<section data-page="${item.attrs.page ?? ""}">${item.children.map(render).join("")}</section>`;
    return "";
  };
  return nodes.map(render).join("");
}

export function pdfPagesToImportDocument(input: PdfReconstructionInput): ImportDocument {
  const warnings = [...(input.warnings ?? [])];
  const root = input.pages.map((page, index) => {
    const children = pageNodes(page);
    const chapter = node("chapter", index, { page: page.page, pageWidth: page.width, pageHeight: page.height, source: "pdf-text-layer" }, undefined, children);
    children.forEach((child, position) => { child.parentId = chapter.id; child.position = position; });
    if (!children.length) warnings.push({ code: "PDF_PAGE_NO_TEXT", message: `Trang ${page.page} không có text layer có thể chỉnh sửa.`, severity: "warning", context: { page: page.page } });
    return chapter;
  });
  const now = new Date().toISOString();
  const document: BookDocument = {
    id: uid("document"), bookId: input.bookId, organizationId: input.organizationId, title: input.title, language: "vi", root,
    metadata: { sourceType: "pdf", sourceFileName: input.sourceFileName, importedAt: now, importEngine: input.engine ?? "pdfjs-text-layer-1.0", pageCount: input.pages.length },
    version: 1, createdAt: now, updatedAt: now,
  };
  const result: ImportDocument = {
    format: "pdf", sourceFileName: input.sourceFileName, title: input.title, document, nodes: root, assets: [], warnings,
    statistics: statistics(root), metadata: document.metadata, previewHtml: previewHtml(root),
  };
  if (!result.statistics.words) result.warnings.push({ code: "PDF_NO_TEXT_LAYER", message: "PDF không có text layer. Hãy chuyển sang chế độ OCR.", severity: "error" });
  return result;
}
