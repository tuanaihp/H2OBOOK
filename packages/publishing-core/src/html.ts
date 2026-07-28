import type { BookDocument, RichTextSpan, SemanticContentNode, TextMark } from "@h2obook/content-core";
import type { H2OBook, H2OElement } from "../../../types/editor";
import type { ExportProfile } from "./types";

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]!);

function safeHref(value: unknown) {
  const href = String(value ?? "").trim();
  if (!href) return "";
  try {
    const url = new URL(href, "https://h2obook.local");
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? href : "";
  } catch { return ""; }
}

function renderMark(content: string, mark: TextMark) {
  if (mark.type === "bold") return `<strong>${content}</strong>`;
  if (mark.type === "italic") return `<em>${content}</em>`;
  if (mark.type === "underline") return `<u>${content}</u>`;
  if (mark.type === "strike") return `<s>${content}</s>`;
  if (mark.type === "code") return `<code>${content}</code>`;
  if (mark.type === "link") {
    const href = safeHref(mark.attrs?.href);
    return href ? `<a href="${escape(href)}" rel="noopener noreferrer">${content}</a>` : content;
  }
  return content;
}

function renderSpans(spans: RichTextSpan[] | undefined) {
  return (spans ?? []).map((span) => (span.marks ?? []).reduce((html, mark) => renderMark(html, mark), escape(span.text))).join("");
}

function nodeText(node: SemanticContentNode): string {
  const own = renderSpans(node.text);
  return own || node.children.map(nodeText).join("");
}

function semanticNode(node: SemanticContentNode): string {
  const children = node.children.map(semanticNode).join("");
  const id = `n-${escape(node.id)}`;
  if (node.type === "chapter") return `<section class="chapter" id="${id}" data-content-node-id="${escape(node.id)}">${children}</section>`;
  if (node.type === "section") return `<section class="content-section" id="${id}" data-content-node-id="${escape(node.id)}">${children}</section>`;
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs.level ?? 2)));
    return `<h${level} id="${id}">${renderSpans(node.text)}</h${level}>`;
  }
  if (node.type === "paragraph") return `<p id="${id}">${renderSpans(node.text)}</p>`;
  if (node.type === "quote" || node.type === "callout") return `<blockquote id="${id}">${nodeText(node)}</blockquote>`;
  if (node.type === "list") {
    const tag = node.attrs.ordered ? "ol" : "ul";
    return `<${tag} id="${id}">${children}</${tag}>`;
  }
  if (node.type === "list_item") return `<li id="${id}">${children || renderSpans(node.text)}</li>`;
  if (node.type === "table") return `<div class="table-scroll"><table id="${id}"><tbody>${children}</tbody></table></div>`;
  if (node.type === "table_row") return `<tr id="${id}">${children}</tr>`;
  if (node.type === "table_cell") {
    const tag = node.attrs.header ? "th" : "td";
    return `<${tag} id="${id}">${children || renderSpans(node.text)}</${tag}>`;
  }
  if (node.type === "image") {
    const alt = escape(String(node.attrs.altText ?? ""));
    const caption = String(node.attrs.caption ?? "");
    return `<figure id="${id}" data-asset-id="${escape(String(node.attrs.assetId ?? ""))}"><div class="asset-placeholder" role="img" aria-label="${alt}">Hình ảnh</div>${caption ? `<figcaption>${escape(caption)}</figcaption>` : ""}</figure>`;
  }
  if (node.type === "footnote") return `<aside id="${id}" class="footnote" role="doc-footnote"><sup>${escape(String(node.attrs.label ?? ""))}</sup> ${escape(String(node.attrs.note ?? node.text?.map((span) => span.text).join("") ?? ""))}</aside>`;
  if (node.type === "citation") {
    const href = safeHref(node.attrs.href);
    const label = escape(String(node.attrs.label ?? node.text?.map((span) => span.text).join("") ?? "Nguồn"));
    return href ? `<cite id="${id}"><a href="${escape(href)}" rel="noopener noreferrer">${label}</a></cite>` : `<cite id="${id}">${label}</cite>`;
  }
  if (node.type === "divider") return `<hr id="${id}">`;
  if (node.type === "quiz" || node.type === "interactive") return `<section id="${id}" class="interactive-fallback" data-interactive-type="${escape(node.type)}">${children || nodeText(node)}</section>`;
  return children || renderSpans(node.text);
}

export function renderSemanticHtml(document: BookDocument, profile: ExportProfile) {
  const body = document.root.map(semanticNode).join("");
  return `<!doctype html><html lang="${escape(profile.accessibility.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(document.title)}</title><meta name="generator" content="H2OBOOK Professional Publishing"><style>${semanticCss(profile)}</style></head><body><main>${body}</main></body></html>`;
}

function fixedElement(element: H2OElement) {
  const padding = element.type === "text" ? Math.max(0, element.flowPadding ?? 2) : 0;
  const style = `position:absolute;left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;transform:rotate(${element.rotation}deg);opacity:${element.opacity};overflow:hidden;box-sizing:border-box;padding:${padding}px;`;
  if (element.type === "text") return `<div style="${style}color:${element.fill};font:${element.fontStyle === "italic" ? "italic " : ""}${element.fontWeight ?? 400} ${element.fontSize ?? 22}px/${element.lineHeight ?? 1.35} ${escape(element.fontFamily ?? "Arial")};text-align:${element.align ?? "left"};white-space:pre-wrap" data-flow-chain-id="${escape(element.flowChainId ?? "")}" data-flow-order="${element.flowOrder ?? ""}">${escape(element.text ?? "")}</div>`;
  if (element.type === "image") return `<div style="${style}background:#eef1f4" data-asset-id="${escape(element.assetId ?? "")}" role="img" aria-label="${escape(element.altText ?? element.name)}"></div>`;
  if (element.type === "qr") return `<div style="${style}" data-qr="${escape(element.qrValue ?? "")}" aria-label="QR ${escape(element.name)}">QR</div>`;
  return `<div style="${style}background:${element.fill ?? "transparent"};border:${element.strokeWidth ?? 0}px solid ${element.stroke ?? "transparent"};border-radius:${element.cornerRadius ?? 0}px"></div>`;
}

export function renderFixedLayoutHtml(book: H2OBook, profile: ExportProfile) {
  const pages = book.pages.map((page, index) => `<section class="fixed-page" aria-label="Trang ${index + 1}" style="width:${page.width}px;height:${page.height}px;background:${page.background}">${page.elements.filter((element) => !element.hidden).map(fixedElement).join("")}</section>`).join("");
  return `<!doctype html><html lang="${escape(profile.accessibility.language)}"><head><meta charset="utf-8"><title>${escape(book.title)}</title><style>${fixedCss(profile)}</style></head><body>${pages}</body></html>`;
}

function semanticCss(profile: ExportProfile) {
  return `@page{size:${profile.page.width}${profile.page.unit} ${profile.page.height}${profile.page.unit};margin:${profile.page.margin}${profile.page.unit}}*{box-sizing:border-box}body{margin:0;color:#20242b;background:#fff;font-family:${profile.typography.bodyFont};font-size:${profile.typography.baseSize}pt;line-height:${profile.typography.lineHeight}}main{max-width:760px;margin:auto;padding:2rem}h1,h2,h3{font-family:${profile.typography.headingFont};page-break-after:avoid}p,li{orphans:3;widows:3}img{max-width:100%}blockquote{border-left:4px solid #7d2d55;padding:1rem 1.4rem;background:#f7f0f3}.chapter{break-before:page}.asset-placeholder{min-height:180px;background:#eef1f4;display:grid;place-items:center}.table-scroll{overflow-x:auto;margin:1.25rem 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cdd3dc;padding:.65rem;vertical-align:top}th{background:#f4f6f9;text-align:left}.footnote{font-size:.86em;border-top:1px solid #d9dde5;padding:.55rem 0}cite{display:inline-block;font-size:.92em}.interactive-fallback{border:1px dashed #8a94a6;padding:1rem}a{color:#2356a8}`;
}
function fixedCss(profile: ExportProfile) {
  return `@page{size:${profile.page.width}${profile.page.unit} ${profile.page.height}${profile.page.unit};margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}.fixed-page{position:relative;overflow:hidden;break-after:page;margin:0 auto}`;
}
