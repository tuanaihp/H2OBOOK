import type { H2OBook, H2OElement } from "../../../types/editor";
import type { BookDocument, SemanticContentNode } from "./types";

function uid(_prefix: string) { return crypto.randomUUID(); }

function textNode(element: H2OElement, parentId: string | null, position: number): SemanticContentNode {
  const level = element.fontSize && element.fontSize >= 36 ? 1 : element.fontSize && element.fontSize >= 26 ? 2 : undefined;
  return {
    id: element.contentNodeId ?? uid("node"),
    type: level ? "heading" : "paragraph",
    parentId,
    position,
    text: [{ text: element.text ?? "" }],
    attrs: {
      level,
      sourceElementId: element.id,
      align: element.align ?? "left",
      bindingKey: element.bindingKey ?? null
    },
    children: [],
    version: 1
  };
}

function mediaNode(element: H2OElement, parentId: string | null, position: number): SemanticContentNode {
  return {
    id: element.contentNodeId ?? uid("node"),
    type: element.type === "qr" ? "interactive" : element.type === "image" ? "image" : "divider",
    parentId,
    position,
    attrs: {
      sourceElementId: element.id,
      assetId: element.assetId ?? null,
      legacyUrl: element.imageUrl ?? null,
      altText: element.altText ?? element.name,
      caption: element.caption ?? null,
      qrValue: element.qrValue ?? null
    },
    children: [],
    version: 1
  };
}

export function legacyBookToDocument(book: H2OBook): BookDocument {
  const now = new Date().toISOString();
  const root: SemanticContentNode[] = book.pages.map((page, pageIndex) => {
    const chapterId = uid("chapter");
    return {
      id: chapterId,
      type: "chapter",
      parentId: null,
      position: pageIndex,
      attrs: { sourcePageId: page.id, pageName: page.name, pageType: page.pageType ?? "content" },
      children: page.elements
        .filter((element) => !element.hidden && ["text", "image", "qr", "line"].includes(element.type))
        .map((element, elementIndex) => element.type === "text"
          ? textNode(element, chapterId, elementIndex)
          : mediaNode(element, chapterId, elementIndex)),
      version: 1
    };
  });
  return {
    id: book.documentId ?? uid("document"),
    bookId: book.id,
    title: book.title,
    language: book.language ?? "vi",
    root,
    metadata: { subtitle: book.subtitle, author: book.author, source: "legacy-page-adapter" },
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

export function plainTextFromDocument(document: BookDocument) {
  const lines: string[] = [];
  const visit = (nodes: SemanticContentNode[]) => {
    nodes.sort((a, b) => a.position - b.position).forEach((node) => {
      const text = node.text?.map((span) => span.text).join("").trim();
      if (text) lines.push(text);
      visit(node.children);
    });
  };
  visit(document.root);
  return lines.join("\n\n");
}
