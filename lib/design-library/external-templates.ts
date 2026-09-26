import type { H2OElement, H2OPage } from "@/types/editor";
import type { DesignSnapshotPage, DesignTemplateDefinition } from "@/types/design-library";
import { uid } from "@/lib/utils";

/**
 * External design-template integration.
 *
 * Two formats are supported:
 *  - "h2odesign-pack" — our portable pack format: element snapshots with
 *    {{field}} placeholders, produced by "Lưu trang thành mẫu" in Studio or
 *    hand-authored under public/template-packs/.
 *  - Polotno JSON — the free demo templates published in
 *    polotno-project/polotno-docs (MIT) share the same absolute-positioned
 *    element model, so they convert 1:1.
 *
 * Rules we enforce on import: no Base64/data-URI assets are embedded into books
 * (external http(s) images keep their URL and surface a warning; inline SVGs are
 * reduced to shapes when trivially a rect, otherwise skipped with a warning).
 */

const DESIGN_PACK_FORMAT = "h2odesign-pack";

const DEFAULT_PALETTE = {
  background: "#1d1030",
  surface: "#ffffff",
  primary: "#8f174d",
  secondary: "#49d7e8",
  accent: "#d8b36a",
  text: "#ffffff",
  muted: "#8a7f88"
} as const;

const fullPermissions = (): H2OElement["permissions"] => ({
  canEditContent: true,
  canMove: true,
  canResize: true,
  canDelete: true,
  canChangeColor: true,
  canReplaceAsset: true,
  canChangeFont: true,
  canRotate: true
});

const baseElement = (): Omit<H2OElement, "type" | "name"> => ({
  id: uid("el"),
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  rotation: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  permissions: fullPermissions()
});

export type PackTemplateInput = {
  id?: string;
  name: string;
  description?: string;
  category?: DesignTemplateDefinition["category"];
  subcategory?: string;
  tags?: string[];
  baseFormat?: DesignTemplateDefinition["baseFormat"];
  fields?: DesignTemplateDefinition["fields"];
  pages: Array<{ name?: string; width: number; height: number; background?: string; elements: H2OElement[] }>;
};

export type TemplateImportResult = {
  templates: DesignTemplateDefinition[];
  warnings: string[];
};

export function isH2ODesignPack(value: unknown): value is { format: string; templates: PackTemplateInput[] } {
  const pack = value as { format?: string; templates?: unknown[] };
  return Boolean(value && typeof value === "object" && pack.format === DESIGN_PACK_FORMAT && Array.isArray(pack.templates));
}

export function isPolotnoDesign(value: unknown): boolean {
  const doc = value as { pages?: Array<{ children?: unknown[] }> };
  return Boolean(value && typeof value === "object" && Array.isArray(doc.pages) && doc.pages.every((page) => Array.isArray(page?.children)));
}

/** Wrap editor pages as a portable pack — used by "Lưu trang thành mẫu" in Studio. */
export function pagesToDesignPack(pages: H2OPage[], meta: { name: string; description?: string; category?: DesignTemplateDefinition["category"]; fields?: DesignTemplateDefinition["fields"] }): Record<string, unknown> {
  return {
    format: DESIGN_PACK_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: [{
      id: uid("design_pack"),
      name: meta.name,
      description: meta.description ?? "Mẫu lưu từ H2OBOOK Studio",
      category: meta.category ?? "personal-profile",
      tags: ["studio-export"],
      fields: meta.fields ?? [],
      pages: pages.map((page) => ({ name: page.name, width: page.width, height: page.height, background: page.background, elements: page.elements }))
    }]
  };
}

/** Validate and normalize a h2odesign-pack JSON document. */
export function parseDesignPack(json: unknown): TemplateImportResult {
  const warnings: string[] = [];
  if (!isH2ODesignPack(json)) return { templates: [], warnings: ["File không phải định dạng h2odesign-pack."] };
  const templates: DesignTemplateDefinition[] = [];
  for (const raw of json.templates) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.pages) || raw.pages.length === 0) {
      warnings.push(`Mẫu "${raw?.name ?? "không tên"}" thiếu trang — đã bỏ qua.`);
      continue;
    }
    const pages: DesignSnapshotPage[] = [];
    for (const page of raw.pages) {
      if (!page || typeof page.width !== "number" || typeof page.height !== "number" || !Array.isArray(page.elements)) {
        warnings.push(`Một trang của "${raw.name}" thiếu kích thước/elements — đã bỏ qua trang đó.`);
        continue;
      }
      const elements = page.elements.filter((element): element is H2OElement => Boolean(element && typeof element === "object" && typeof element.type === "string"));
      pages.push({ name: page.name, width: page.width, height: page.height, background: page.background, elements: elements.map((element) => ({ ...baseElement(), ...element, id: uid(element.type), permissions: { ...fullPermissions(), ...(element.permissions ?? {}) } })) });
    }
    if (!pages.length) { warnings.push(`Mẫu "${raw.name}" không còn trang hợp lệ — đã bỏ qua.`); continue; }
    templates.push(packToTemplate({ ...raw, pages }, "imported", warnings));
  }
  return { templates, warnings };
}

function packToTemplate(raw: PackTemplateInput, source: DesignTemplateDefinition["source"], warnings: string[]): DesignTemplateDefinition {
  const pages: DesignSnapshotPage[] = raw.pages.map((page, index) => ({
    name: page.name ?? `Trang ${index + 1}`,
    width: page.width,
    height: page.height,
    background: page.background ?? "#ffffff",
    elements: page.elements
  }));
  const fonts = new Set<string>();
  for (const page of pages) for (const element of page.elements) if (element.fontFamily) fonts.add(element.fontFamily);
  if (fonts.size) warnings.push(`"${raw.name}" dùng font: ${[...fonts].join(", ")} — font chưa cài sẽ được thay thế khi render.`);
  return {
    id: raw.id ?? uid("design_pack"),
    name: raw.name,
    description: raw.description ?? "",
    category: raw.category ?? "personal-profile",
    subcategory: raw.subcategory ?? "Mẫu nhập ngoài",
    style: "clean-editorial",
    tags: raw.tags ?? ["imported"],
    baseFormat: raw.baseFormat ?? "square-post",
    supportedFormats: raw.baseFormat ? [raw.baseFormat, "square-post", "portrait-post", "story"] : ["square-post", "portrait-post", "story", "facebook-cover", "a5-invitation", "a4-certificate-landscape"],
    palette: { ...DEFAULT_PALETTE },
    layout: "promotion-burst",
    fields: raw.fields ?? [],
    snapshot: pages,
    source,
    fontsUsed: [...fonts]
  };
}

type PolotnoChild = Record<string, unknown> & { type?: string };

/**
 * Convert a Polotno store JSON (store.toJSON()) into a snapshot-based
 * DesignTemplateDefinition. Deterministic, no network calls.
 */
export function convertPolotnoToTemplate(json: unknown, name?: string): TemplateImportResult {
  const warnings: string[] = [];
  if (!isPolotnoDesign(json)) return { templates: [], warnings: ["File không phải định dạng Polotno JSON."] };
  const doc = json as { width?: number; height?: number; pages: Array<{ background?: string; children: PolotnoChild[] }> };
  const pages: DesignSnapshotPage[] = [];
  for (const [index, page] of doc.pages.entries()) {
    const width = typeof doc.width === "number" ? doc.width : 1080;
    const height = typeof doc.height === "number" ? doc.height : 1080;
    const elements = page.children.flatMap((child) => polotnoChildToElements(child, warnings));
    pages.push({ name: `Trang ${index + 1}`, width, height, background: page.background ?? "#ffffff", elements });
  }
  const template = packToTemplate({
    name: name ?? "Mẫu Polotno",
    description: "Nhập từ kho Polotno JSON",
    category: "makeup-promotion",
    tags: ["polotno", "imported"],
    fields: inferFieldsFromPages(pages),
    pages
  }, "imported", warnings);
  return { templates: [template], warnings };
}

function polotnoChildToElements(child: PolotnoChild, warnings: string[], offset = { x: 0, y: 0 }): H2OElement[] {
  if (!child || typeof child !== "object") return [];
  if (child.type === "group" && Array.isArray(child.children)) {
    const gx = num(child.x) + offset.x;
    const gy = num(child.y) + offset.y;
    if (num(child.scaleX, 1) !== 1 || num(child.scaleY, 1) !== 1) warnings.push("Một group có scale — vị trí phần tử con có thể lệch nhẹ.");
    return (child.children as PolotnoChild[]).flatMap((nested) => polotnoChildToElements(nested, warnings, { x: gx, y: gy }));
  }
  const common = {
    ...baseElement(),
    x: num(child.x) + offset.x,
    y: num(child.y) + offset.y,
    width: num(child.width, 100),
    height: num(child.height, 40),
    rotation: num(child.rotation),
    opacity: typeof child.opacity === "number" ? child.opacity : 1,
    locked: Boolean(child.locked)
  };
  switch (child.type) {
    case "text":
      return [{
        ...common,
        type: "text",
        name: str(child.name) || "Text",
        text: str(child.text),
        sourceText: str(child.text),
        fontSize: num(child.fontSize, 24),
        fontFamily: str(child.fontFamily) || "Arial",
        fontWeight: str(child.fontWeight) === "bold" || num(child.fontWeight) >= 600 ? 700 : 400,
        fontStyle: str(child.fontStyle) === "italic" ? "italic" : "normal",
        textDecoration: child.textDecoration === "underline" ? "underline" : child.textDecoration === "line-through" ? "line-through" : "none",
        lineHeight: num(child.lineHeight, 1.2),
        letterSpacing: num(child.letterSpacing, 0),
        align: (["left", "center", "right", "justify"].includes(str(child.align)) ? str(child.align) : "left") as H2OElement["align"],
        fill: str(child.fill) || "#000000",
        stroke: str(child.stroke) || undefined,
        strokeWidth: num(child.strokeWidth, 0) || undefined
      }];
    case "image": {
      const src = str(child.src);
      if (!src || src.startsWith("data:")) {
        warnings.push("Bỏ qua 1 ảnh nhúng base64 — thay bằng asset để tránh phình dữ liệu sách.");
        return [];
      }
      if (num(child.cropX) || num(child.cropY)) warnings.push("Ảnh có crop trong mẫu gốc — sẽ hiển thị ảnh đầy đủ.");
      return [{ ...common, type: "image", name: str(child.name) || "Ảnh", imageUrl: src, imageFit: "cover", fill: "transparent" }];
    }
    case "figure":
      return [{
        ...common,
        type: "shape",
        name: str(child.name) || "Hình khối",
        fill: str(child.fill) || "#000000",
        stroke: str(child.stroke) || undefined,
        strokeWidth: num(child.strokeWidth, 0) || undefined,
        cornerRadius: num(child.cornerRadius, 0)
      }];
    case "line":
      return [{ ...common, type: "line", name: str(child.name) || "Đường kẻ", stroke: str(child.stroke) || "#000000", strokeWidth: num(child.strokeWidth, 2) || 2 }];
    case "svg": {
      const shape = svgToShape(child);
      if (shape) return [{ ...common, ...shape }];
      const src = str(child.src);
      if (src && !src.startsWith("data:")) return [{ ...common, type: "image", name: str(child.name) || "SVG", imageUrl: src, imageFit: "contain" }];
      warnings.push("Bỏ qua 1 SVG phức tạp nhúng base64 — thay bằng asset hoặc shape thủ công.");
      return [];
    }
    default:
      warnings.push(`Bỏ qua phần tử type "${child.type ?? "unknown"}" chưa hỗ trợ.`);
      return [];
  }
}

/** Polotno packs commonly embed a bare colored <rect> as a data-URI SVG — map it to a shape. */
function svgToShape(child: PolotnoChild): { type: "shape"; name: string; fill: string } | null {
  const src = str(child.src);
  if (!src.startsWith("data:image/svg+xml")) return null;
  try {
    const svg = src.includes("base64") ? atob(src.slice(src.indexOf("base64,") + 7)) : decodeURIComponent(src.slice(src.indexOf(",") + 1));
    const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((match) => match[1]).filter((fill) => fill !== "none");
    const singleRect = /<rect[\s>]/i.test(svg) && !/<(circle|ellipse|path|polygon|text|image)[\s>]/i.test(svg);
    if (!singleRect) return null;
    const replace = child.colorsReplace as Record<string, string> | undefined;
    let fill = fills[0] ?? "#000000";
    if (replace) for (const [from, to] of Object.entries(replace)) if (normalizeColor(fill) === normalizeColor(from)) fill = to;
    return { type: "shape", name: str(child.name) || "Nền SVG", fill };
  } catch {
    return null;
  }
}

function normalizeColor(color: string): string {
  return color.replace(/\s+/g, "").toLowerCase();
}

/** Turn {{field}} placeholders found in snapshot text into Smart Fields. */
function inferFieldsFromPages(pages: DesignSnapshotPage[]): DesignTemplateDefinition["fields"] {
  const keys = new Set<string>();
  for (const page of pages) for (const element of page.elements) {
    for (const match of (element.text ?? "").matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g)) keys.add(match[1]);
  }
  return [...keys].map((key) => ({ key, label: key, type: "text" as const, placeholder: `Nhập ${key}` }));
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
