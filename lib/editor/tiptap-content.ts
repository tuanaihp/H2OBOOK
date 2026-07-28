import type { JSONContent } from "@tiptap/core";
import type { RichTextSpan, SemanticContentNode, TextMark } from "@h2obook/content-core";

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function markToTiptap(mark: TextMark): JSONContent | null {
  if (["bold", "italic", "underline", "strike", "code"].includes(mark.type)) return { type: mark.type };
  if (mark.type === "link") return { type: "link", attrs: { href: String(mark.attrs?.href ?? ""), target: "_blank", rel: "noopener noreferrer" } };
  return null;
}

function spansToContent(spans: RichTextSpan[] | undefined): JSONContent[] {
  const source = spans?.length ? spans : [{ text: "" }];
  return source.map((span) => ({
    type: "text",
    text: span.text,
    marks: span.marks?.map(markToTiptap).filter((item): item is JSONContent => Boolean(item)) as JSONContent["marks"],
  }));
}

function attrs(node: SemanticContentNode, extra: Record<string, unknown> = {}) {
  return { h2oNodeId: node.id, h2oVersion: node.version, ...extra };
}

function semanticNodeToTiptap(node: SemanticContentNode): JSONContent | null {
  const children = node.children.map(semanticNodeToTiptap).filter((item): item is JSONContent => Boolean(item));
  if (node.type === "chapter") return {
    type: "h2oChapter",
    attrs: attrs(node, { label: String(node.attrs.pageName ?? node.attrs.label ?? "Chương") }),
    content: children.length ? children : [{ type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 } }],
  };
  if (node.type === "section") return {
    type: "h2oSection",
    attrs: attrs(node, { label: String(node.attrs.label ?? "Mục") }),
    content: children.length ? children : [{ type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 } }],
  };
  if (node.type === "heading") return { type: "heading", attrs: attrs(node, { level: Math.min(6, Math.max(1, Number(node.attrs.level ?? 2))), textAlign: node.attrs.align ?? null }), content: spansToContent(node.text) };
  if (node.type === "paragraph") return { type: node.attrs.codeBlock ? "codeBlock" : "paragraph", attrs: attrs(node, { textAlign: node.attrs.align ?? null }), content: spansToContent(node.text) };
  if (node.type === "quote") return { type: "blockquote", attrs: attrs(node), content: [{ type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: spansToContent(node.text) }] };
  if (node.type === "list") return { type: node.attrs.ordered ? "orderedList" : "bulletList", attrs: attrs(node), content: children };
  if (node.type === "list_item") {
    const itemContent = children.length ? children : [{ type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: spansToContent(node.text) }];
    return { type: "listItem", attrs: attrs(node), content: itemContent };
  }
  if (node.type === "table") {
    if (children.length) return { type: "table", attrs: attrs(node), content: children };
    const rows = Array.isArray(node.attrs.rows) ? node.attrs.rows as unknown[][] : [[""]];
    return {
      type: "table", attrs: attrs(node), content: rows.map((row) => ({
        type: "tableRow", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: row.map((cell) => ({
          type: "tableCell", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: [{ type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: [{ type: "text", text: String(cell ?? "") }] }],
        })),
      })),
    };
  }
  if (node.type === "table_row") return { type: "tableRow", attrs: attrs(node), content: children };
  if (node.type === "table_cell") return { type: node.attrs.header ? "tableHeader" : "tableCell", attrs: attrs(node), content: children.length ? children : [{ type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: spansToContent(node.text) }] };
  if (node.type === "image") return { type: "h2oImage", attrs: attrs(node, { assetId: node.attrs.assetId ?? null, src: node.attrs.legacyUrl ?? node.attrs.src ?? null, alt: String(node.attrs.altText ?? ""), caption: String(node.attrs.caption ?? "") }) };
  if (node.type === "footnote") return { type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: [{ type: "h2oFootnote", attrs: attrs(node, { label: String(node.attrs.label ?? "1"), note: String(node.attrs.note ?? node.text?.map((span) => span.text).join("") ?? "") }) }] };
  if (node.type === "citation") return { type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: [{ type: "h2oCitation", attrs: attrs(node, { label: String(node.attrs.label ?? "Nguồn"), href: String(node.attrs.href ?? "") }) }] };
  if (node.type === "divider") return { type: "horizontalRule", attrs: attrs(node) };
  if (node.type === "callout") return { type: "blockquote", attrs: attrs(node), content: children.length ? children : [{ type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 }, content: spansToContent(node.text) }] };
  if (node.type === "interactive" || node.type === "quiz") return { type: "paragraph", attrs: attrs(node), content: [{ type: "text", text: `[${node.type === "quiz" ? "Bài kiểm tra" : "Nội dung tương tác"}]` }] };
  return null;
}

export function semanticNodesToTiptapDoc(nodes: SemanticContentNode[]): JSONContent {
  const content = nodes.map(semanticNodeToTiptap).filter((item): item is JSONContent => Boolean(item));
  return { type: "doc", content: content.length ? content : [{ type: "paragraph", attrs: { h2oNodeId: uid(), h2oVersion: 1 } }] };
}

function tiptapMarksToSpans(content: JSONContent[] | undefined): RichTextSpan[] {
  const spans: RichTextSpan[] = [];
  const append = (text: string, marks?: TextMark[]) => {
    if (!text) return;
    const previous = spans[spans.length - 1];
    if (previous && JSON.stringify(previous.marks ?? []) === JSON.stringify(marks ?? [])) previous.text += text;
    else spans.push({ text, marks: marks?.length ? marks : undefined });
  };
  const walk = (items: JSONContent[] | undefined) => items?.forEach((item) => {
    if (item.type === "text") {
      const marks = item.marks?.map((mark): TextMark | null => {
        if (["bold", "italic", "underline", "strike", "code"].includes(mark.type ?? "")) return { type: mark.type as TextMark["type"] };
        if (mark.type === "link") return { type: "link", attrs: { href: String(mark.attrs?.href ?? "") } };
        return null;
      }).filter((mark): mark is TextMark => Boolean(mark));
      append(item.text ?? "", marks);
    } else if (item.type === "hardBreak") append("\n");
    else walk(item.content);
  });
  walk(content);
  return spans.length ? spans : [{ text: "" }];
}

function nodeId(node: JSONContent) { return String(node.attrs?.h2oNodeId ?? uid()); }
function version(node: JSONContent) { return Number(node.attrs?.h2oVersion ?? 1); }

function tiptapNodeToSemantic(node: JSONContent, parentId: string | null, position: number): SemanticContentNode | null {
  const id = nodeId(node);
  const childNodes = (node.content ?? []).map((child, index) => tiptapNodeToSemantic(child, id, index)).filter((item): item is SemanticContentNode => Boolean(item));
  const base = { id, parentId, position, attrs: {} as Record<string, unknown>, children: childNodes, version: version(node) };
  if (node.type === "h2oChapter") return { ...base, type: "chapter", attrs: { label: node.attrs?.label ?? "Chương", pageName: node.attrs?.label ?? "Chương" } };
  if (node.type === "h2oSection") return { ...base, type: "section", attrs: { label: node.attrs?.label ?? "Mục" } };
  if (node.type === "heading") return { ...base, type: "heading", attrs: { level: Number(node.attrs?.level ?? 2), align: node.attrs?.textAlign ?? "left" }, text: tiptapMarksToSpans(node.content), children: [] };
  if (node.type === "paragraph") {
    const special = node.content?.find((item) => item.type === "h2oFootnote" || item.type === "h2oCitation");
    if (special?.type === "h2oFootnote") return { ...base, id: nodeId(special), type: "footnote", attrs: { label: special.attrs?.label ?? "1", note: special.attrs?.note ?? "" }, text: [{ text: String(special.attrs?.note ?? "") }], children: [] };
    if (special?.type === "h2oCitation") return { ...base, id: nodeId(special), type: "citation", attrs: { label: special.attrs?.label ?? "Nguồn", href: special.attrs?.href ?? "" }, text: [{ text: String(special.attrs?.label ?? "Nguồn") }], children: [] };
    return { ...base, type: "paragraph", attrs: { align: node.attrs?.textAlign ?? "left" }, text: tiptapMarksToSpans(node.content), children: [] };
  }
  if (node.type === "codeBlock") return { ...base, type: "paragraph", attrs: { codeBlock: true }, text: tiptapMarksToSpans(node.content), children: [] };
  if (node.type === "blockquote") return { ...base, type: "quote", text: tiptapMarksToSpans(node.content), children: [] };
  if (node.type === "bulletList" || node.type === "orderedList") return { ...base, type: "list", attrs: { ordered: node.type === "orderedList" } };
  if (node.type === "listItem") return { ...base, type: "list_item", text: childNodes.length ? undefined : tiptapMarksToSpans(node.content) };
  if (node.type === "table") return { ...base, type: "table" };
  if (node.type === "tableRow") return { ...base, type: "table_row" };
  if (node.type === "tableCell" || node.type === "tableHeader") return { ...base, type: "table_cell", attrs: { header: node.type === "tableHeader" }, text: childNodes.length ? undefined : tiptapMarksToSpans(node.content) };
  if (node.type === "h2oImage") return { ...base, type: "image", attrs: { assetId: node.attrs?.assetId ?? null, legacyUrl: node.attrs?.src ?? null, altText: node.attrs?.alt ?? "", caption: node.attrs?.caption ?? "" }, children: [] };
  if (node.type === "horizontalRule") return { ...base, type: "divider", children: [] };
  return null;
}

export function tiptapDocToSemanticNodes(document: JSONContent): SemanticContentNode[] {
  return (document.content ?? []).map((node, index) => tiptapNodeToSemantic(node, null, index)).filter((item): item is SemanticContentNode => Boolean(item));
}

export function flattenSemanticForOutline(nodes: SemanticContentNode[]) {
  const result: SemanticContentNode[] = [];
  const visit = (items: SemanticContentNode[]) => items.forEach((item) => { result.push(item); visit(item.children); });
  visit(nodes);
  return result;
}
