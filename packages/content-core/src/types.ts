export type ContentNodeType =
  | "chapter" | "section" | "heading" | "paragraph" | "list" | "list_item"
  | "image" | "table" | "table_row" | "table_cell" | "quote" | "quiz" | "footnote" | "citation"
  | "divider" | "callout" | "interactive";

export type TextMark = {
  type: "bold" | "italic" | "underline" | "strike" | "link" | "code";
  attrs?: Record<string, string | number | boolean>;
};

export type RichTextSpan = { text: string; marks?: TextMark[] };

export type SemanticContentNode = {
  id: string;
  type: ContentNodeType;
  parentId: string | null;
  position: number;
  text?: RichTextSpan[];
  attrs: Record<string, unknown>;
  children: SemanticContentNode[];
  version: number;
};

export type BookDocument = {
  id: string;
  bookId: string;
  organizationId?: string;
  title: string;
  language: string;
  root: SemanticContentNode[];
  metadata: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type LayoutProfileType = "web" | "mobile" | "print_a4" | "print_a5" | "square" | "workbook" | "presenter" | "epub_reflow" | "epub_fixed";

export type LayoutFrame = {
  id: string;
  pageId?: string;
  masterPageId?: string;
  frameType: "text" | "image" | "decoration" | "header" | "footer";
  x: number;
  y: number;
  width: number;
  height: number;
  flowChainId?: string;
  contentNodeId?: string;
  styleId?: string;
  locked: boolean;
};

export type LayoutProfile = {
  id: string;
  bookId: string;
  name: string;
  profileType: LayoutProfileType;
  pageWidth: number;
  pageHeight: number;
  unit: "px" | "pt" | "mm";
  margins: { top: number; right: number; bottom: number; left: number };
  bleed: { top: number; right: number; bottom: number; left: number };
  columns: number;
  columnGap: number;
  frames: LayoutFrame[];
  settings: Record<string, unknown>;
};
