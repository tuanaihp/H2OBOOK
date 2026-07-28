import type { SemanticContentNode, RichTextSpan } from "@h2obook/content-core";

function uid() { return crypto.randomUUID(); }

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}

export function nodesToEditableHtml(nodes: SemanticContentNode[]) {
  return nodes.map((node) => {
    const text = escapeHtml(node.text?.map((span) => span.text).join("") ?? "");
    if (node.type === "heading") return `<h${Math.min(3, Number(node.attrs.level ?? 2))}>${text}</h${Math.min(3, Number(node.attrs.level ?? 2))}>`;
    if (node.type === "quote") return `<blockquote>${text}</blockquote>`;
    if (node.type === "list") return `<ul>${node.children.map((child) => `<li>${escapeHtml(child.text?.map((span) => span.text).join("") ?? "")}</li>`).join("")}</ul>`;
    if (node.type === "paragraph") return `<p>${text || "<br>"}</p>`;
    return "";
  }).join("");
}

function spansFromElement(element: Element): RichTextSpan[] {
  const result: RichTextSpan[] = [];
  const walk = (node: Node, marks: RichTextSpan["marks"] = []) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) result.push({ text: node.textContent, marks });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const next = [...(marks ?? [])];
    const tag = node.tagName.toLowerCase();
    if (tag === "strong" || tag === "b") next.push({ type: "bold" });
    if (tag === "em" || tag === "i") next.push({ type: "italic" });
    if (tag === "u") next.push({ type: "underline" });
    if (tag === "a") next.push({ type: "link", attrs: { href: node.getAttribute("href") ?? "" } });
    node.childNodes.forEach((child) => walk(child, next));
  };
  element.childNodes.forEach((child) => walk(child));
  return result.length ? result : [{ text: element.textContent ?? "" }];
}

export function editableHtmlToNodes(html: string): SemanticContentNode[] {
  const document = new DOMParser().parseFromString(`<main>${html}</main>`, "text/html");
  const root = document.querySelector("main");
  if (!root) return [];
  return Array.from(root.children).flatMap((element, position): SemanticContentNode[] => {
    const tag = element.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const id = uid();
      return [{ id, type: "list", parentId: null, position, attrs: { ordered: tag === "ol" }, text: [], version: 1,
        children: Array.from(element.children).map((item, itemPosition) => ({ id: uid(), type: "list_item", parentId: id, position: itemPosition, attrs: {}, text: spansFromElement(item), children: [], version: 1 })) }];
    }
    const heading = /^h([1-6])$/.exec(tag);
    return [{ id: uid(), type: heading ? "heading" : tag === "blockquote" ? "quote" : "paragraph", parentId: null, position,
      attrs: heading ? { level: Number(heading[1]) } : {}, text: spansFromElement(element), children: [], version: 1 }];
  });
}
