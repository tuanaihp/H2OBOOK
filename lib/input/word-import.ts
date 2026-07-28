import type { ImportDocument, ImportedAsset, ImportWarning } from "@h2obook/input-core";
import { wordHtmlToImportDocument } from "@h2obook/input-core";
import { uploadAsset } from "@/lib/assets/asset-client";

const WORD_STYLE_MAP = [
  "p[style-name='Title'] => h1.h2o-title:fresh",
  "p[style-name='Subtitle'] => p.h2o-subtitle:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Caption'] => p.h2o-caption:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='Page Break'] => div.h2o-page-break:fresh",
];

function extension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

export async function importDocxToBookDocument(file: File, input: { bookId: string; organizationId?: string; title?: string }): Promise<ImportDocument> {
  const mammoth = await import("mammoth");
  const assets: ImportedAsset[] = [];
  const warnings: ImportWarning[] = [];
  let imageIndex = 0;
  const imageConverter = mammoth.images.imgElement(async (image: { contentType: string; read: (encoding: string) => Promise<ArrayBuffer | string> }) => {
    imageIndex += 1;
    let bytes: ArrayBuffer;
    try {
      const value = await image.read("arrayBuffer");
      bytes = value instanceof ArrayBuffer ? value : bytesFromBase64(String(value));
    } catch {
      const value = await image.read("base64");
      bytes = bytesFromBase64(String(value));
    }
    const mimeType = image.contentType || "image/jpeg";
    const fileName = `${file.name.replace(/\.docx$/i, "")}-image-${imageIndex}.${extension(mimeType)}`;
    const embedded = new File([bytes], fileName, { type: mimeType });
    try {
      const asset = await uploadAsset(embedded, { organizationId: input.organizationId, category: "word-images", assetType: "word-image" });
      assets.push({ ...asset, fileName, mimeType });
      return { src: asset.previewUrl, "data-h2o-asset-id": asset.assetId, alt: fileName };
    } catch (error) {
      warnings.push({ code: "DOCX_IMAGE_UPLOAD_FAILED", message: `Không thể lưu hình ${fileName}: ${error instanceof Error ? error.message : "Lỗi không xác định"}`, severity: "warning" });
      return { src: "", alt: fileName };
    }
  });

  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    { styleMap: WORD_STYLE_MAP, includeDefaultStyleMap: true, convertImage: imageConverter, ignoreEmptyParagraphs: false },
  );
  for (const message of result.messages ?? []) {
    warnings.push({ code: `MAMMOTH_${String(message.type ?? "warning").toUpperCase()}`, message: String(message.message ?? "Cảnh báo khi đọc Word"), severity: message.type === "error" ? "error" : "warning" });
  }
  const title = input.title?.trim() || file.name.replace(/\.docx$/i, "");
  return wordHtmlToImportDocument({ html: result.value, sourceFileName: file.name, title, bookId: input.bookId, organizationId: input.organizationId, assets, warnings });
}

export async function queueDocxFallback(file: File, input: { bookId: string; organizationId?: string; title?: string }) {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "production") throw new Error("Python DOCX fallback chỉ khả dụng trong Production Mode.");
  const source = await uploadAsset(file, { organizationId: input.organizationId, category: "word-sources", assetType: "docx-source" });
  if (source.assetId.startsWith("local:")) throw new Error("DOCX fallback cần R2 và PostgreSQL được cấu hình.");
  const response = await fetch("/api/input/word/fallback", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId: input.organizationId, assetId: source.assetId, bookId: input.bookId, title: input.title || file.name.replace(/\.docx$/i, "") }),
  });
  const payload = await response.json().catch(() => null) as { job?: { id?: string; databaseJobId?: string }; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || "Không thể xếp hàng python-docx fallback.");
  return payload?.job;
}
