import { Extension, Node, mergeAttributes } from "@tiptap/core";

const semanticAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute("data-h2o-node-id"),
  renderHTML: (attributes: Record<string, unknown>) => attributes.h2oNodeId
    ? { "data-h2o-node-id": String(attributes.h2oNodeId) }
    : {},
};

const versionAttribute = {
  default: 1,
  parseHTML: (element: HTMLElement) => Number(element.getAttribute("data-h2o-version") ?? 1),
  renderHTML: (attributes: Record<string, unknown>) => ({ "data-h2o-version": String(attributes.h2oVersion ?? 1) }),
};

/**
 * Keeps H2OBOOK semantic node identity stable while users edit with ProseMirror.
 * Unknown DOM commands can no longer destroy the node schema or IDs.
 */
export const H2OSemanticAttributes = Extension.create({
  name: "h2oSemanticAttributes",
  addGlobalAttributes() {
    return [{
      types: [
        "paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem",
        "table", "tableRow", "tableHeader", "tableCell", "horizontalRule", "codeBlock",
      ],
      attributes: {
        h2oNodeId: semanticAttribute,
        h2oVersion: versionAttribute,
      },
    }];
  },
});

export const H2OChapter = Node.create({
  name: "h2oChapter",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      h2oNodeId: semanticAttribute,
      h2oVersion: versionAttribute,
      label: {
        default: "Chương",
        parseHTML: (element) => element.getAttribute("data-label") ?? "Chương",
        renderHTML: (attributes) => ({ "data-label": String(attributes.label ?? "Chương") }),
      },
    };
  },
  parseHTML() { return [{ tag: "section[data-h2o-chapter]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-h2o-chapter": "true", class: "h2o-compose-chapter" }), 0];
  },
});

export const H2OSection = Node.create({
  name: "h2oSection",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      h2oNodeId: semanticAttribute,
      h2oVersion: versionAttribute,
      label: {
        default: "Mục",
        parseHTML: (element) => element.getAttribute("data-label") ?? "Mục",
        renderHTML: (attributes) => ({ "data-label": String(attributes.label ?? "Mục") }),
      },
    };
  },
  parseHTML() { return [{ tag: "section[data-h2o-section]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-h2o-section": "true", class: "h2o-compose-section" }), 0];
  },
});

export const H2OImageBlock = Node.create({
  name: "h2oImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      h2oNodeId: semanticAttribute,
      h2oVersion: versionAttribute,
      assetId: { default: null, parseHTML: (element) => element.getAttribute("data-asset-id") },
      src: { default: null, parseHTML: (element) => element.getAttribute("data-src") },
      alt: { default: "", parseHTML: (element) => element.getAttribute("data-alt") ?? "" },
      caption: { default: "", parseHTML: (element) => element.getAttribute("data-caption") ?? "" },
    };
  },
  parseHTML() { return [{ tag: "figure[data-h2o-image]" }]; },
  renderHTML({ HTMLAttributes }) {
    const alt = String(HTMLAttributes.alt ?? "Hình ảnh");
    const caption = String(HTMLAttributes.caption ?? "");
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-h2o-image": "true",
        "data-asset-id": HTMLAttributes.assetId ?? "",
        "data-src": HTMLAttributes.src ?? "",
        "data-alt": alt,
        "data-caption": caption,
        class: "h2o-compose-image",
        contenteditable: "false",
      }),
      ["div", { class: "h2o-compose-image-preview", role: "img", "aria-label": alt }, alt || "Hình ảnh"],
      ["figcaption", {}, caption || "Chưa có chú thích"],
    ];
  },
});

export const H2OFootnote = Node.create({
  name: "h2oFootnote",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      h2oNodeId: semanticAttribute,
      h2oVersion: versionAttribute,
      label: { default: "1" },
      note: { default: "" },
    };
  },
  parseHTML() { return [{ tag: "span[data-h2o-footnote]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, {
      "data-h2o-footnote": "true",
      class: "h2o-compose-footnote",
      title: String(HTMLAttributes.note ?? ""),
      contenteditable: "false",
    }), `[${String(HTMLAttributes.label ?? "1")}]`];
  },
});

export const H2OCitation = Node.create({
  name: "h2oCitation",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      h2oNodeId: semanticAttribute,
      h2oVersion: versionAttribute,
      label: { default: "Nguồn" },
      href: { default: "" },
    };
  },
  parseHTML() { return [{ tag: "span[data-h2o-citation]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, {
      "data-h2o-citation": "true",
      class: "h2o-compose-citation",
      title: String(HTMLAttributes.href ?? ""),
      contenteditable: "false",
    }), `(${String(HTMLAttributes.label ?? "Nguồn")})`];
  },
});
