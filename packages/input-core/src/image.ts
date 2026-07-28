import type { BookDocument, SemanticContentNode } from "@h2obook/content-core";
import type { ImportDocument, ImportStatistics, ImportWarning } from "./types";

export type ImageImportMode = "asset" | "full_page" | "ocr" | "manual_regions";
export type ImageRegionKind = "text" | "image" | "ignore";
export type ImageRegion = {
  id: string;
  kind: ImageRegionKind;
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
  label?: string;
};

export type ImageMetadata = {
  fileName: string;
  mimeType: "image/png" | "image/jpeg";
  sizeBytes: number;
  pixelWidth: number;
  pixelHeight: number;
  orientation: number;
  dpiX?: number;
  dpiY?: number;
  colorProfile?: string;
  hasAlpha: boolean;
  checksumSha256?: string;
  source: "png-header" | "jpeg-header" | "browser-decode";
};

const readU16 = (view: DataView, offset: number, little = false) => view.getUint16(offset, little);
const readU32 = (view: DataView, offset: number, little = false) => view.getUint32(offset, little);

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function parseExif(bytes: Uint8Array, start: number, length: number) {
  if (length < 14 || ascii(bytes, start, 6) !== "Exif\0\0") return {} as Partial<ImageMetadata>;
  const tiff = start + 6;
  const little = ascii(bytes, tiff, 2) === "II";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ifdOffset = readU32(view, tiff + 4, little);
  const ifd = tiff + ifdOffset;
  if (ifd + 2 > bytes.byteLength) return {} as Partial<ImageMetadata>;
  const count = readU16(view, ifd, little);
  let orientation = 1;
  let dpiX: number | undefined;
  let dpiY: number | undefined;
  let unit = 2;
  const rational = (entry: number) => {
    const pointer = tiff + readU32(view, entry + 8, little);
    if (pointer + 8 > bytes.byteLength) return undefined;
    const numerator = readU32(view, pointer, little);
    const denominator = readU32(view, pointer + 4, little);
    return denominator ? numerator / denominator : undefined;
  };
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > bytes.byteLength) break;
    const tag = readU16(view, entry, little);
    if (tag === 0x0112) orientation = readU16(view, entry + 8, little) || 1;
    if (tag === 0x011a) dpiX = rational(entry);
    if (tag === 0x011b) dpiY = rational(entry);
    if (tag === 0x0128) unit = readU16(view, entry + 8, little) || 2;
  }
  if (unit === 3) {
    if (dpiX) dpiX *= 2.54;
    if (dpiY) dpiY *= 2.54;
  }
  return { orientation, dpiX, dpiY } as Partial<ImageMetadata>;
}

export function parseImageMetadata(buffer: ArrayBuffer, input: { fileName: string; mimeType: string; sizeBytes: number }): ImageMetadata {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length >= 24 && ascii(bytes, 1, 3) === "PNG") {
    const pixelWidth = readU32(view, 16, false);
    const pixelHeight = readU32(view, 20, false);
    const colorType = bytes[25] ?? 2;
    let dpiX: number | undefined;
    let dpiY: number | undefined;
    let colorProfile: string | undefined;
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = readU32(view, offset, false);
      const type = ascii(bytes, offset + 4, 4);
      const dataOffset = offset + 8;
      if (type === "pHYs" && length >= 9) {
        const xppm = readU32(view, dataOffset, false);
        const yppm = readU32(view, dataOffset + 4, false);
        const unit = bytes[dataOffset + 8];
        if (unit === 1) {
          dpiX = xppm * 0.0254;
          dpiY = yppm * 0.0254;
        }
      }
      if (type === "iCCP") colorProfile = "ICC embedded";
      if (type === "sRGB") colorProfile = "sRGB";
      offset = dataOffset + length + 4;
      if (type === "IEND") break;
    }
    return {
      fileName: input.fileName, mimeType: "image/png", sizeBytes: input.sizeBytes,
      pixelWidth, pixelHeight, orientation: 1, dpiX, dpiY, colorProfile,
      hasAlpha: colorType === 4 || colorType === 6, source: "png-header",
    };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    let pixelWidth = 0;
    let pixelHeight = 0;
    let orientation = 1;
    let dpiX: number | undefined;
    let dpiY: number | undefined;
    let colorProfile: string | undefined;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const segmentLength = readU16(view, offset + 2, false);
      if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) break;
      const dataOffset = offset + 4;
      const dataLength = segmentLength - 2;
      if (marker === 0xe0 && dataLength >= 12 && ascii(bytes, dataOffset, 5) === "JFIF\0") {
        const unit = bytes[dataOffset + 7];
        const xDensity = readU16(view, dataOffset + 8, false);
        const yDensity = readU16(view, dataOffset + 10, false);
        if (unit === 1) { dpiX = xDensity; dpiY = yDensity; }
        if (unit === 2) { dpiX = xDensity * 2.54; dpiY = yDensity * 2.54; }
      }
      if (marker === 0xe1) {
        const exif = parseExif(bytes, dataOffset, dataLength);
        orientation = exif.orientation ?? orientation;
        dpiX = exif.dpiX ?? dpiX;
        dpiY = exif.dpiY ?? dpiY;
      }
      if (marker === 0xe2 && ascii(bytes, dataOffset, Math.min(11, dataLength)).startsWith("ICC_PROFILE")) colorProfile = "ICC embedded";
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && dataLength >= 7) {
        pixelHeight = readU16(view, dataOffset + 1, false);
        pixelWidth = readU16(view, dataOffset + 3, false);
      }
      offset += 2 + segmentLength;
    }
    return {
      fileName: input.fileName, mimeType: "image/jpeg", sizeBytes: input.sizeBytes,
      pixelWidth, pixelHeight, orientation, dpiX, dpiY, colorProfile,
      hasAlpha: false, source: "jpeg-header",
    };
  }
  throw new Error("IMAGE_DECODE_FAILED: File không phải PNG hoặc JPEG hợp lệ.");
}

export async function sha256Hex(buffer: ArrayBuffer) {
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function imageMetadataWarnings(metadata: ImageMetadata): ImportWarning[] {
  const warnings: ImportWarning[] = [];
  if (!metadata.pixelWidth || !metadata.pixelHeight) warnings.push({ code: "IMAGE_DIMENSIONS_UNKNOWN", message: "Không đọc được kích thước pixel của ảnh.", severity: "error" });
  if (metadata.pixelWidth * metadata.pixelHeight > 100_000_000) warnings.push({ code: "IMAGE_VERY_LARGE", message: "Ảnh vượt 100 megapixel; thao tác có thể chậm.", severity: "warning" });
  if (metadata.orientation !== 1) warnings.push({ code: "IMAGE_EXIF_ORIENTATION", message: `Ảnh có EXIF orientation ${metadata.orientation}; preview sẽ áp dụng hướng hiển thị chuẩn.`, severity: "info" });
  if (!metadata.dpiX || !metadata.dpiY) warnings.push({ code: "IMAGE_DPI_MISSING", message: "Ảnh không có DPI metadata; H2OBOOK sẽ tính effective DPI theo kích thước đặt trên trang.", severity: "info" });
  if (metadata.colorProfile && !/srgb/i.test(metadata.colorProfile)) warnings.push({ code: "IMAGE_COLOR_PROFILE", message: `Ảnh dùng profile ${metadata.colorProfile}; hãy kiểm tra màu trước khi in.`, severity: "warning" });
  return warnings;
}

function count(nodes: SemanticContentNode[]): ImportStatistics {
  const value: ImportStatistics = { nodes: 0, headings: 0, paragraphs: 0, lists: 0, tables: 0, images: 0, footnotes: 0, words: 0 };
  const visit = (items: SemanticContentNode[]) => items.forEach((item) => {
    value.nodes += 1;
    if (item.type === "heading") value.headings += 1;
    if (item.type === "paragraph") value.paragraphs += 1;
    if (item.type === "list") value.lists += 1;
    if (item.type === "table") value.tables += 1;
    if (item.type === "image") value.images += 1;
    if (item.type === "footnote") value.footnotes += 1;
    value.words += (item.text?.map((span) => span.text).join("") ?? "").split(/\s+/).filter(Boolean).length;
    visit(item.children);
  });
  visit(nodes);
  return value;
}

export function workerImageOcrToImportDocument(input: {
  sourceFileName: string;
  document: BookDocument;
  warnings?: ImportWarning[];
  metadata?: Record<string, unknown>;
}): ImportDocument {
  return {
    format: input.sourceFileName.toLowerCase().endsWith(".png") ? "png" : "jpeg",
    sourceFileName: input.sourceFileName,
    title: input.document.title,
    document: input.document,
    nodes: input.document.root,
    assets: [],
    warnings: input.warnings ?? [],
    statistics: count(input.document.root),
    metadata: { ...input.document.metadata, ...(input.metadata ?? {}) },
  };
}
