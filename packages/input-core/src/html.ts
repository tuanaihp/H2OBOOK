import type { RichTextSpan, SemanticContentNode } from "@h2obook/content-core";
import type { ImportStatistics } from "./types";

export type HtmlSanitizationReport = {
  removedElements: number;
  removedAttributes: number;
  blockedUrls: number;
  convertedEmbeds: number;
  remoteImages: number;
  relativeUrls: number;
  unresolvedRelativeUrls: number;
};

export type HtmlImportMetadata = {
  sourceUrl?: string;
  finalUrl?: string;
  baseUrl?: string;
  contentType?: string;
  charset?: string;
  parser: "jsdom-dom-2.0";
  sanitization: HtmlSanitizationReport;
  remoteAssetUrls: string[];
};

export function semanticText(node: SemanticContentNode) {
  return node.text?.map((span) => span.text).join("") ?? "";
}

export function calculateImportStatistics(nodes: SemanticContentNode[]): ImportStatistics {
  const result: ImportStatistics = { nodes: 0, headings: 0, paragraphs: 0, lists: 0, tables: 0, images: 0, footnotes: 0, words: 0 };
  const visit = (items: SemanticContentNode[]) => items.forEach((item) => {
    result.nodes += 1;
    if (["chapter", "section", "heading"].includes(item.type)) result.headings += 1;
    if (item.type === "paragraph") result.paragraphs += 1;
    if (item.type === "list") result.lists += 1;
    if (item.type === "table") result.tables += 1;
    if (item.type === "image") result.images += 1;
    if (item.type === "footnote") result.footnotes += 1;
    result.words += semanticText(item).trim().split(/\s+/).filter(Boolean).length;
    visit(item.children);
  });
  visit(nodes);
  return result;
}

export function cloneSemanticNodes(nodes: SemanticContentNode[]) {
  return structuredClone(nodes);
}

export function mapSemanticNodes(nodes: SemanticContentNode[], mapper: (node: SemanticContentNode) => SemanticContentNode): SemanticContentNode[] {
  return nodes.map((node, position) => {
    const mapped = mapper({ ...node, position, children: mapSemanticNodes(node.children, mapper) });
    mapped.children.forEach((child, index) => { child.parentId = mapped.id; child.position = index; });
    return mapped;
  });
}

export function compactRichText(spans: RichTextSpan[]) {
  const result: RichTextSpan[] = [];
  for (const span of spans) {
    if (!span.text) continue;
    const previous = result[result.length - 1];
    if (previous && JSON.stringify(previous.marks ?? []) === JSON.stringify(span.marks ?? [])) previous.text += span.text;
    else result.push(span);
  }
  return result;
}
