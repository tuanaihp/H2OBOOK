import type { BookDocument, RichTextSpan, SemanticContentNode, TextMark } from "@h2obook/content-core";
import type { ImportDocument, ImportedAsset, ImportStatistics, ImportWarning } from "./types";

function uid(prefix = "node") {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^javascript:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) return "";
  return trimmed;
}

function marksEqual(a: TextMark[] | undefined, b: TextMark[] | undefined) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function appendSpan(target: RichTextSpan[], value: string, marks?: TextMark[]) {
  if (!value) return;
  const previous = target[target.length - 1];
  if (previous && marksEqual(previous.marks, marks)) previous.text += value;
  else target.push({ text: value, marks: marks?.length ? marks : undefined });
}

function inlineSpans(node: Node, inherited: TextMark[] = [], target: RichTextSpan[] = []): RichTextSpan[] {
  if (node.nodeType === 3) {
    appendSpan(target, node.textContent ?? "", inherited);
    return target;
  }
  if (node.nodeType !== 1) return target;
  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const marks = [...inherited];
  if (tag === "strong" || tag === "b") marks.push({ type: "bold" });
  if (tag === "em" || tag === "i") marks.push({ type: "italic" });
  if (tag === "u") marks.push({ type: "underline" });
  if (tag === "s" || tag === "strike" || tag === "del") marks.push({ type: "strike" });
  if (tag === "code") marks.push({ type: "code" });
  if (tag === "a") {
    const href = safeUrl(element.getAttribute("href") ?? "");
    if (href && !href.startsWith("#footnote")) marks.push({ type: "link", attrs: { href } });
  }
  if (tag === "br") appendSpan(target, "\n", marks);
  else element.childNodes.forEach((child) => inlineSpans(child, marks, target));
  return target;
}

function textValue(spans: RichTextSpan[] | undefined) { return spans?.map((span) => span.text).join("") ?? ""; }
function makeNode(type: SemanticContentNode["type"], position: number, attrs: Record<string, unknown> = {}, text?: RichTextSpan[], children: SemanticContentNode[] = []): SemanticContentNode {
  const id = uid(type);
  children.forEach((child, index) => { child.parentId = id; child.position = index; });
  return { id, type, parentId: null, position, attrs, text, children, version: 1 };
}

function sanitizeDocument(document: Document) {
  document.querySelectorAll("script,style,noscript,iframe,object,embed,form,meta,link").forEach((node) => node.remove());
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || attribute.name === "srcdoc") element.removeAttribute(attribute.name);
      if ((attribute.name === "href" || attribute.name === "src") && !safeUrl(attribute.value) && attribute.value) element.removeAttribute(attribute.name);
    }
  });
}

function parseList(element: HTMLElement, position: number): SemanticContentNode {
  const ordered = element.tagName.toLowerCase() === "ol";
  const children = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === "li").map((item, index) => {
    const nested = Array.from(item.children).filter((child) => ["ul", "ol"].includes(child.tagName.toLowerCase()));
    const clone = item.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(":scope > ul, :scope > ol").forEach((node) => node.remove());
    const itemChildren = nested.map((list, nestedIndex) => parseList(list as HTMLElement, nestedIndex));
    return makeNode("list_item", index, {}, inlineSpans(clone), itemChildren);
  });
  return makeNode("list", position, { ordered }, undefined, children);
}

function parseTable(element: HTMLTableElement, position: number): SemanticContentNode {
  const rows = Array.from(element.rows).map((row, rowIndex) => {
    const cells = Array.from(row.cells).map((cell, cellIndex) => {
      const paragraphs: SemanticContentNode[] = [];
      const blockChildren = Array.from(cell.children).filter((child) => ["p", "div", "ul", "ol"].includes(child.tagName.toLowerCase()));
      if (blockChildren.length) {
        blockChildren.forEach((child, index) => {
          if (["ul", "ol"].includes(child.tagName.toLowerCase())) paragraphs.push(parseList(child as HTMLElement, index));
          else paragraphs.push(makeNode("paragraph", index, {}, inlineSpans(child)));
        });
      } else paragraphs.push(makeNode("paragraph", 0, {}, inlineSpans(cell)));
      return makeNode("table_cell", cellIndex, { header: cell.tagName.toLowerCase() === "th", colspan: cell.colSpan, rowspan: cell.rowSpan }, undefined, paragraphs);
    });
    return makeNode("table_row", rowIndex, {}, undefined, cells);
  });
  return makeNode("table", position, { columns: Math.max(0, ...rows.map((row) => row.children.length)) }, undefined, rows);
}

function collectFootnotes(document: Document) {
  const map = new Map<string, string>();
  document.querySelectorAll("li[id^='footnote'], li[id*='footnote-']").forEach((item) => {
    const id = item.id.replace(/^footnote-?/, "");
    const clone = item.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("a[href^='#footnote-ref']").forEach((anchor) => anchor.remove());
    map.set(id, clone.textContent?.trim() ?? "");
    item.remove();
  });
  return map;
}

function blockNodes(document: Document, assets: ImportedAsset[]): SemanticContentNode[] {
  const root: SemanticContentNode[] = [];
  const footnotes = collectFootnotes(document);
  const container = document.body;
  const push = (node: SemanticContentNode) => { node.position = root.length; root.push(node); };
  const children = Array.from(container.children);
  for (const element of children) {
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      push(makeNode("heading", root.length, { level, sourceStyle: element.getAttribute("data-style-name") ?? null }, inlineSpans(element)));
      continue;
    }
    if (tag === "ul" || tag === "ol") { push(parseList(element as HTMLElement, root.length)); continue; }
    if (tag === "table") { push(parseTable(element as HTMLTableElement, root.length)); continue; }
    if (tag === "blockquote") { push(makeNode("quote", root.length, {}, inlineSpans(element))); continue; }
    if (tag === "hr" || element.classList.contains("h2o-page-break")) { push(makeNode("divider", root.length, { pageBreak: true })); continue; }
    if (tag === "img" || tag === "figure") {
      const image = tag === "img" ? element as HTMLImageElement : element.querySelector("img");
      if (!image) continue;
      const assetId = image.getAttribute("data-h2o-asset-id") ?? "";
      const asset = assets.find((item) => item.assetId === assetId);
      const caption = tag === "figure" ? element.querySelector("figcaption")?.textContent?.trim() ?? "" : "";
      push(makeNode("image", root.length, { assetId: assetId || null, legacyUrl: image.getAttribute("src") ?? asset?.previewUrl ?? null, altText: image.getAttribute("alt") ?? "", caption }));
      continue;
    }
    if (tag === "p" || tag === "div") {
      if (element.classList.contains("h2o-caption")) {
        const previous = root[root.length - 1];
        if (previous?.type === "image") previous.attrs.caption = element.textContent?.trim() ?? "";
        else push(makeNode("paragraph", root.length, { role: "caption" }, inlineSpans(element)));
        continue;
      }
      const images = Array.from(element.querySelectorAll("img"));
      const paragraphClone = element.cloneNode(true) as HTMLElement;
      paragraphClone.querySelectorAll("img").forEach((image) => image.remove());
      const spans = inlineSpans(paragraphClone);
      if (textValue(spans).trim()) push(makeNode("paragraph", root.length, { sourceStyle: element.getAttribute("data-style-name") ?? null }, spans));
      for (const image of images) {
        const assetId = image.getAttribute("data-h2o-asset-id") ?? "";
        const asset = assets.find((item) => item.assetId === assetId);
        push(makeNode("image", root.length, { assetId: assetId || null, legacyUrl: image.getAttribute("src") ?? asset?.previewUrl ?? null, altText: image.getAttribute("alt") ?? "", caption: "" }));
      }
      const refs = Array.from(element.querySelectorAll("a[href^='#footnote']"));
      for (const ref of refs) {
        const target = (ref.getAttribute("href") ?? "").replace(/^#footnote-?/, "");
        const note = footnotes.get(target);
        if (note) push(makeNode("footnote", root.length, { label: target, note }, [{ text: note }]));
      }
    }
  }
  return root;
}

function calculate(nodes: SemanticContentNode[]): ImportStatistics {
  const statistics: ImportStatistics = { nodes: 0, headings: 0, paragraphs: 0, lists: 0, tables: 0, images: 0, footnotes: 0, words: 0 };
  const visit = (items: SemanticContentNode[]) => items.forEach((item) => {
    statistics.nodes += 1;
    if (item.type === "heading") statistics.headings += 1;
    if (item.type === "paragraph") statistics.paragraphs += 1;
    if (item.type === "list") statistics.lists += 1;
    if (item.type === "table") statistics.tables += 1;
    if (item.type === "image") statistics.images += 1;
    if (item.type === "footnote") statistics.footnotes += 1;
    statistics.words += textValue(item.text).trim().split(/\s+/).filter(Boolean).length;
    visit(item.children);
  });
  visit(nodes);
  return statistics;
}

export function wordHtmlToImportDocument(input: {
  html: string;
  sourceFileName: string;
  title: string;
  bookId: string;
  organizationId?: string;
  assets?: ImportedAsset[];
  warnings?: ImportWarning[];
  parser?: (html: string) => Document;
}): ImportDocument {
  const parser = input.parser ?? ((html: string) => new DOMParser().parseFromString(html, "text/html"));
  const document = parser(input.html);
  sanitizeDocument(document);
  const assets = input.assets ?? [];
  const nodes = blockNodes(document, assets);
  const now = new Date().toISOString();
  const warnings = [...(input.warnings ?? [])];
  if (!nodes.length) warnings.push({ code: "DOCX_NO_CONTENT", message: "Không tìm thấy nội dung có thể nhập từ file Word.", severity: "error" });
  if (!nodes.some((item) => item.type === "heading")) warnings.push({ code: "DOCX_NO_HEADINGS", message: "Không phát hiện Heading; hãy kiểm tra lại cấu trúc chương sau khi nhập.", severity: "warning" });
  const model: BookDocument = {
    id: uid("document"), bookId: input.bookId, organizationId: input.organizationId,
    title: input.title, language: "vi", root: nodes,
    metadata: { sourceType: "docx", sourceFileName: input.sourceFileName, importedAt: now, importEngine: "mammoth-html-2.0" },
    version: 1, createdAt: now, updatedAt: now,
  };
  return {
    format: "docx", sourceFileName: input.sourceFileName, title: input.title, document: model, nodes, assets,
    warnings, statistics: calculate(nodes), metadata: model.metadata, previewHtml: document.body.innerHTML,
  };
}
