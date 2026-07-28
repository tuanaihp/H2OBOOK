import { JSDOM } from "jsdom";
import type { BookDocument, RichTextSpan, SemanticContentNode, TextMark } from "@h2obook/content-core";
import { calculateImportStatistics, compactRichText, type HtmlImportMetadata, type HtmlSanitizationReport, type ImportDocument, type ImportWarning } from "@h2obook/input-core";

const REMOVED_TAGS = "script,noscript,style,template,object,applet,form,input,button,textarea,select,option,meta,link,base,canvas";
const NAVIGATION_TAGS = "nav,aside,footer";
const SAFE_EMBED_HOSTS = new Set(["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"]);
const BLOCK_TAGS = new Set(["address", "article", "aside", "blockquote", "div", "dl", "fieldset", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "nav", "ol", "p", "pre", "section", "table", "ul"]);

function uid(prefix = "html") {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeNode(type: SemanticContentNode["type"], position: number, attrs: Record<string, unknown> = {}, text?: RichTextSpan[], children: SemanticContentNode[] = []): SemanticContentNode {
  const id = uid(type);
  children.forEach((child, index) => { child.parentId = id; child.position = index; });
  return { id, type, parentId: null, position, attrs, text, children, version: 1 };
}

function safeStyle(value: string) {
  const allowed: string[] = [];
  for (const declaration of value.split(";")) {
    const [rawProperty, ...rawValue] = declaration.split(":");
    const property = rawProperty?.trim().toLowerCase();
    const styleValue = rawValue.join(":").trim().toLowerCase();
    if (!property || !styleValue) continue;
    if (property === "font-weight" && /^(bold|bolder|[6-9]00)$/.test(styleValue)) allowed.push("font-weight:bold");
    if (property === "font-style" && /^(italic|oblique)$/.test(styleValue)) allowed.push("font-style:italic");
    if (property === "text-decoration" && /underline|line-through/.test(styleValue)) allowed.push(`text-decoration:${styleValue.includes("underline") ? "underline" : "line-through"}`);
  }
  return allowed.join(";");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[\t\r\n ]+/g, " ");
}

function marksEqual(a?: TextMark[], b?: TextMark[]) {
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
    appendSpan(target, normalizeWhitespace(node.textContent ?? ""), inherited);
    return target;
  }
  if (node.nodeType !== 1) return target;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const marks = [...inherited];
  const style = element.getAttribute("style")?.toLowerCase() ?? "";
  if (tag === "strong" || tag === "b" || /font-weight\s*:\s*(bold|[6-9]00)/.test(style)) marks.push({ type: "bold" });
  if (tag === "em" || tag === "i" || /font-style\s*:\s*(italic|oblique)/.test(style)) marks.push({ type: "italic" });
  if (tag === "u" || /text-decoration[^;]*underline/.test(style)) marks.push({ type: "underline" });
  if (["s", "strike", "del"].includes(tag) || /text-decoration[^;]*line-through/.test(style)) marks.push({ type: "strike" });
  if (["code", "kbd", "samp"].includes(tag)) marks.push({ type: "code" });
  if (tag === "a") {
    const href = element.getAttribute("href") ?? "";
    if (href) marks.push({ type: "link", attrs: { href } });
  }
  if (tag === "br") appendSpan(target, "\n", marks);
  else element.childNodes.forEach((child) => inlineSpans(child, marks, target));
  return compactRichText(target);
}

function textOf(spans?: RichTextSpan[]) {
  return spans?.map((span) => span.text).join("").trim() ?? "";
}

function resolveUrl(raw: string, baseUrl: string | undefined, report: HtmlSanitizationReport, kind: "link" | "asset") {
  const value = raw.trim();
  if (!value) return "";
  if (kind === "link" && value.startsWith("#")) return value;
  if (/^(javascript|vbscript|file|blob):/i.test(value) || /^data:/i.test(value)) { report.blockedUrls += 1; return ""; }
  if (!baseUrl && !/^[a-z][a-z\d+.-]*:/i.test(value)) {
    report.unresolvedRelativeUrls += 1;
    return "";
  }
  try {
    const parsed = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      if (kind === "link" && ["mailto:", "tel:"].includes(parsed.protocol)) return parsed.toString();
      report.blockedUrls += 1; return "";
    }
    if (baseUrl && !/^[a-z][a-z\d+.-]*:/i.test(value)) report.relativeUrls += 1;
    return parsed.toString();
  } catch {
    if (kind === "link" && /^(mailto:|tel:)/i.test(value)) return value;
    report.blockedUrls += 1;
    return "";
  }
}

function sanitizeDocument(document: Document, baseUrl: string | undefined, report: HtmlSanitizationReport, warnings: ImportWarning[]) {
  document.querySelectorAll("iframe,embed").forEach((element) => {
    const source = resolveUrl(element.getAttribute("src") ?? "", baseUrl, report, "asset");
    let converted = false;
    if (source) {
      try {
        const host = new URL(source).hostname.toLowerCase();
        if (SAFE_EMBED_HOSTS.has(host)) {
          const placeholder = document.createElement("div");
          placeholder.setAttribute("data-h2o-embed-source", source);
          placeholder.setAttribute("data-h2o-embed-provider", host.includes("youtube") ? "youtube" : "vimeo");
          element.replaceWith(placeholder);
          report.convertedEmbeds += 1;
          converted = true;
        } else warnings.push({ code: "HTML_EMBED_BLOCKED", message: `Đã chặn embed từ miền không được phép: ${host}`, severity: "warning" });
      } catch { /* URL already reported */ }
    }
    if (!converted) { element.remove(); report.removedElements += 1; }
  });
  document.querySelectorAll(REMOVED_TAGS).forEach((element) => { element.remove(); report.removedElements += 1; });
  document.querySelectorAll(NAVIGATION_TAGS).forEach((element) => { element.remove(); report.removedElements += 1; });
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (/^on/.test(name) || ["srcdoc", "action", "formaction", "ping", "integrity", "nonce"].includes(name)) {
        element.removeAttribute(attribute.name); report.removedAttributes += 1; continue;
      }
      if (name === "style") {
        const safe = safeStyle(attribute.value);
        if (safe) element.setAttribute("style", safe);
        else element.removeAttribute("style");
        if (safe !== attribute.value) report.removedAttributes += 1;
        continue;
      }
      if (name === "href") {
        const resolved = resolveUrl(attribute.value, baseUrl, report, "link");
        if (resolved) element.setAttribute("href", resolved); else element.removeAttribute("href");
        continue;
      }
      if (["src", "poster"].includes(name)) {
        const resolved = resolveUrl(attribute.value, baseUrl, report, "asset");
        if (resolved) element.setAttribute(name, resolved); else element.removeAttribute(name);
        continue;
      }
      if (name === "srcset") { element.removeAttribute(name); report.removedAttributes += 1; continue; }
      const allowed = ["alt", "title", "width", "height", "colspan", "rowspan", "scope", "start", "reversed", "type", "controls", "preload", "datetime", "lang", "dir", "class", "id", "style", "href", "src", "poster"].includes(name) || name.startsWith("data-") || name.startsWith("aria-");
      if (!allowed) { element.removeAttribute(attribute.name); report.removedAttributes += 1; }
    }
  });
}

function parseList(element: Element, position: number): SemanticContentNode {
  const ordered = element.tagName.toLowerCase() === "ol";
  const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === "li").map((item, itemIndex) => {
    const nestedLists = Array.from(item.children).filter((child) => ["ul", "ol"].includes(child.tagName.toLowerCase()));
    const otherBlocks = Array.from(item.children).filter((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()) && !["ul", "ol"].includes(child.tagName.toLowerCase()));
    const clone = item.cloneNode(true) as Element;
    Array.from(clone.children).filter((child) => BLOCK_TAGS.has(child.tagName.toLowerCase())).forEach((child) => child.remove());
    const children: SemanticContentNode[] = nestedLists.map((child, index) => parseList(child, index));
    otherBlocks.forEach((block) => parseBlock(block, children));
    return makeNode("list_item", itemIndex, {}, inlineSpans(clone), children);
  });
  return makeNode("list", position, { ordered, start: Number(element.getAttribute("start") ?? 1) }, undefined, items);
}

function parseTable(table: Element, position: number): SemanticContentNode {
  const rowElements = Array.from(table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr"));
  const rows = rowElements.map((row, rowIndex) => {
    const cells = Array.from(row.children).filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase())).map((cell, cellIndex) => {
      const children: SemanticContentNode[] = [];
      const directBlocks = Array.from(cell.children).filter((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()));
      if (directBlocks.length) directBlocks.forEach((block) => parseBlock(block, children));
      else {
        const spans = inlineSpans(cell);
        if (textOf(spans)) children.push(makeNode("paragraph", 0, {}, spans));
      }
      return makeNode("table_cell", cellIndex, {
        header: cell.tagName.toLowerCase() === "th",
        colspan: Math.max(1, Number(cell.getAttribute("colspan") ?? 1)),
        rowspan: Math.max(1, Number(cell.getAttribute("rowspan") ?? 1)),
      }, undefined, children);
    });
    return makeNode("table_row", rowIndex, {}, undefined, cells);
  });
  return makeNode("table", position, { columns: Math.max(0, ...rows.map((row) => row.children.length)) }, undefined, rows);
}

function imageNode(element: Element, position: number, caption = "") {
  const sourceUrl = element.getAttribute("src") ?? "";
  return makeNode("image", position, {
    sourceUrl,
    altText: element.getAttribute("alt") ?? "",
    title: element.getAttribute("title") ?? "",
    caption,
    width: Number(element.getAttribute("width") ?? 0) || null,
    height: Number(element.getAttribute("height") ?? 0) || null,
    localizationStatus: sourceUrl ? "pending" : "missing",
  });
}

function parseBlock(element: Element, target: SemanticContentNode[]) {
  const tag = element.tagName.toLowerCase();
  const push = (item: SemanticContentNode) => { item.position = target.length; target.push(item); };
  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    const type = level === 1 ? "chapter" : level === 2 ? "section" : "heading";
    const blockChildren = Array.from(element.children).filter((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()));
    if (blockChildren.length) {
      const headingSpans: RichTextSpan[] = [];
      element.childNodes.forEach((child) => {
        if (child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName.toLowerCase())) return;
        inlineSpans(child, [], headingSpans);
      });
      if (textOf(headingSpans)) push(makeNode(type, target.length, { level }, compactRichText(headingSpans)));
      blockChildren.forEach((child) => parseBlock(child, target));
      return;
    }
    const spans = inlineSpans(element);
    if (textOf(spans)) push(makeNode(type, target.length, { level }, spans));
    return;
  }
  if (tag === "p" || tag === "address" || tag === "dt" || tag === "dd") {
    const spans = inlineSpans(element);
    if (textOf(spans)) push(makeNode("paragraph", target.length, {}, spans));
    Array.from(element.querySelectorAll(":scope > img")).forEach((image) => push(imageNode(image, target.length)));
    return;
  }
  if (tag === "ul" || tag === "ol") { push(parseList(element, target.length)); return; }
  if (tag === "table") { push(parseTable(element, target.length)); return; }
  if (tag === "blockquote") { const spans = inlineSpans(element); if (textOf(spans)) push(makeNode("quote", target.length, {}, spans)); return; }
  if (tag === "hr") { push(makeNode("divider", target.length)); return; }
  if (tag === "pre") { const value = element.textContent ?? ""; if (value.trim()) push(makeNode("paragraph", target.length, { preformatted: true }, [{ text: value, marks: [{ type: "code" }] }])); return; }
  if (tag === "figure") {
    const image = element.querySelector("img");
    const caption = element.querySelector("figcaption")?.textContent?.trim() ?? "";
    if (image) push(imageNode(image, target.length, caption));
    else Array.from(element.children).forEach((child) => child.tagName.toLowerCase() !== "figcaption" && parseBlock(child, target));
    return;
  }
  if (tag === "img") { push(imageNode(element, target.length)); return; }
  if (tag === "audio" || tag === "video") {
    const source = element.getAttribute("src") || element.querySelector("source")?.getAttribute("src") || "";
    if (source) push(makeNode("interactive", target.length, { kind: tag, sourceUrl: source, poster: element.getAttribute("poster") ?? null, controls: true }));
    return;
  }
  if (tag === "div" && element.hasAttribute("data-h2o-embed-source")) {
    push(makeNode("interactive", target.length, {
      kind: "embed",
      sourceUrl: element.getAttribute("data-h2o-embed-source"),
      provider: element.getAttribute("data-h2o-embed-provider"),
      controlled: true,
    }));
    return;
  }
  if (tag === "article" || tag === "main" || tag === "section" || tag === "div" || tag === "header" || tag === "body") {
    const label = element.getAttribute("aria-label") || element.getAttribute("data-title");
    if (tag === "section" && label && !element.querySelector(":scope > h1, :scope > h2, :scope > h3")) push(makeNode("section", target.length, { level: 2, generatedFromLabel: true }, [{ text: label }]));
    element.childNodes.forEach((child) => {
      if (child.nodeType === 1) parseBlock(child as Element, target);
      else if (child.nodeType === 3 && child.textContent?.trim()) push(makeNode("paragraph", target.length, {}, [{ text: normalizeWhitespace(child.textContent).trim() }]));
    });
    return;
  }
  const hasBlockChildren = Array.from(element.children).some((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()));
  if (!hasBlockChildren) {
    const spans = inlineSpans(element);
    if (textOf(spans)) push(makeNode("paragraph", target.length, { sourceTag: tag }, spans));
    return;
  }
  element.childNodes.forEach((child) => {
    if (child.nodeType === 1) parseBlock(child as Element, target);
    else if (child.nodeType === 3 && child.textContent?.trim()) push(makeNode("paragraph", target.length, { sourceTag: tag }, [{ text: normalizeWhitespace(child.textContent).trim() }]));
  });
}

function selectContentRoots(document: Document) {
  const articles = Array.from(document.querySelectorAll("article")).filter((article) => !article.parentElement?.closest("article"));
  if (articles.length) return articles;
  const main = document.querySelector("main,[role='main']");
  if (main) return [main];
  return [document.body];
}

export function decodeHtmlBytes(bytes: Uint8Array, declaredContentType?: string) {
  let charset = /charset\s*=\s*([^;\s]+)/i.exec(declaredContentType ?? "")?.[1]?.replace(/["']/g, "").toLowerCase();
  if (!charset) {
    const probe = new TextDecoder("windows-1252").decode(bytes.slice(0, 4096));
    charset = /<meta[^>]+charset\s*=\s*["']?([^\s"'/>]+)/i.exec(probe)?.[1]?.toLowerCase()
      || /<meta[^>]+content=["'][^"']*charset=([^\s"';]+)/i.exec(probe)?.[1]?.toLowerCase();
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) charset = "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) charset = "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) charset = "utf-16be";
  const normalized = charset === "iso-8859-1" ? "windows-1252" : charset || "utf-8";
  try { return { html: new TextDecoder(normalized).decode(bytes), charset: normalized }; }
  catch { return { html: new TextDecoder("utf-8").decode(bytes), charset: "utf-8" }; }
}

export function parseHtmlImport(input: {
  html: string;
  sourceFileName: string;
  title?: string;
  bookId: string;
  organizationId?: string;
  sourceUrl?: string;
  finalUrl?: string;
  contentType?: string;
  charset?: string;
}): ImportDocument {
  const baseUrl = input.finalUrl || input.sourceUrl;
  const dom = new JSDOM(input.html, { url: baseUrl || "https://h2obook.invalid/import" });
  const document = dom.window.document;
  const report: HtmlSanitizationReport = { removedElements: 0, removedAttributes: 0, blockedUrls: 0, convertedEmbeds: 0, remoteImages: 0, relativeUrls: 0, unresolvedRelativeUrls: 0 };
  const warnings: ImportWarning[] = [];
  sanitizeDocument(document, baseUrl, report, warnings);
  const nodes: SemanticContentNode[] = [];
  selectContentRoots(document).forEach((root) => parseBlock(root, nodes));
  nodes.forEach((item, index) => { item.position = index; item.parentId = null; });

  const collectImageUrls = (items: SemanticContentNode[]): string[] => items.flatMap((item) => [
    ...(item.type === "image" && /^https?:/i.test(String(item.attrs.sourceUrl ?? "")) ? [String(item.attrs.sourceUrl)] : []),
    ...collectImageUrls(item.children),
  ]);
  const remoteAssetUrls = Array.from(new Set(collectImageUrls(nodes)));
  report.remoteImages = remoteAssetUrls.length;
  if (remoteAssetUrls.length) warnings.push({ code: "HTML_REMOTE_ASSETS_PENDING", message: `${remoteAssetUrls.length} ảnh từ xa sẽ được tải qua máy chủ kiểm soát và lưu thành asset trước khi nhập.`, severity: "info" });
  if (report.unresolvedRelativeUrls) warnings.push({ code: "HTML_RELATIVE_URL_WITHOUT_BASE", message: `${report.unresolvedRelativeUrls} URL tương đối không thể resolve vì file HTML không có base URL hoặc bundle tài sản.`, severity: "warning" });
  if (report.removedElements || report.removedAttributes || report.blockedUrls) warnings.push({ code: "HTML_SANITIZED", message: `Đã loại bỏ ${report.removedElements} phần tử, ${report.removedAttributes} thuộc tính và ${report.blockedUrls} URL không an toàn.`, severity: "info" });
  if (!nodes.length) warnings.push({ code: "HTML_NO_CONTENT", message: "Không tìm thấy nội dung HTML có thể nhập.", severity: "error" });
  if (!nodes.some((item) => ["chapter", "section", "heading"].includes(item.type))) warnings.push({ code: "HTML_NO_HEADINGS", message: "Chưa phát hiện heading; hãy kiểm tra cấu trúc chương trong Compose Mode.", severity: "warning" });
  const documentTitle = input.title?.trim() || document.querySelector("title")?.textContent?.trim() || textOf(nodes.find((item) => ["chapter", "section", "heading"].includes(item.type))?.text) || input.sourceFileName.replace(/\.(?:x?html?|htm)$/i, "") || "Tài liệu HTML";
  const now = new Date().toISOString();
  const metadata: HtmlImportMetadata & Record<string, unknown> = {
    sourceUrl: input.sourceUrl,
    finalUrl: input.finalUrl,
    baseUrl,
    contentType: input.contentType,
    charset: input.charset,
    parser: "jsdom-dom-2.0",
    sanitization: report,
    remoteAssetUrls,
    importedAt: now,
    sourceType: "html",
  };
  const bookDocument: BookDocument = {
    id: uid("document"), bookId: input.bookId, organizationId: input.organizationId,
    title: documentTitle, language: document.documentElement.lang || "vi", root: nodes,
    metadata, version: 1, createdAt: now, updatedAt: now,
  };
  return {
    format: "html", sourceFileName: input.sourceFileName, title: documentTitle,
    document: bookDocument, nodes, assets: [], warnings,
    statistics: calculateImportStatistics(nodes), metadata,
    previewHtml: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src 'none'; font-src 'none'; connect-src 'none'">
<style>body{font-family:system-ui,sans-serif;padding:18px;line-height:1.6;color:#1f2937}img{display:none}table{border-collapse:collapse}td,th{border:1px solid #d1d5db;padding:6px}a{color:#3156a3}</style>
${selectContentRoots(document).map((root) => root.innerHTML).join("\n")}`,
  };
}
