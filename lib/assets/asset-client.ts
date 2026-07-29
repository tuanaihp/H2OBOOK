import { readLocalAsset, saveLocalAsset } from "./local-asset-store";

export type UploadedAsset = { assetId: string; previewUrl: string; mode: "local" | "cloud"; storageKey?: string; mimeType?: string; fileName?: string; scanStatus?: string };

function localId() { return `local:${crypto.randomUUID()}`; }

const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_DIMENSION = 2000;
const IMAGE_OUTPUT_QUALITY = 0.82;

/** Resizes/re-encodes oversized raster images to WebP before upload to reduce storage; falls back to the original file on any failure or when it isn't smaller. */
async function compressImageFile(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined" || !COMPRESSIBLE_IMAGE_TYPES.has(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.type === "image/webp") { bitmap.close(); return file; }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", IMAGE_OUTPUT_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[a-zA-Z0-9]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function uploadAsset(inputFile: File, input?: { organizationId?: string; category?: string; assetType?: string; metadata?: Record<string, unknown>; checksum?: string; width?: number; height?: number; compress?: boolean }): Promise<UploadedAsset> {
  // Compression is opt-in: Input Engine imports (PDF/Image/HTML/DOCX) rely on exact original
  // pixel dimensions, EXIF and pre-validated magic bytes, so they must never pass compress:true.
  const file = input?.compress ? await compressImageFile(inputFile) : inputFile;
  if (process.env.NEXT_PUBLIC_APP_MODE !== "production") {
    const assetId = localId();
    await saveLocalAsset(assetId, file);
    return { assetId, previewUrl: URL.createObjectURL(file), mode: "local", mimeType: file.type, fileName: file.name };
  }
  const presign = await fetch("/api/storage/presign-upload", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, organizationId: input?.organizationId, category: input?.category ?? "assets" })
  });
  if (!presign.ok) throw new Error("Không thể tạo đường dẫn upload an toàn.");
  const signed = await presign.json() as { mode: "demo" | "cloud"; key: string; uploadUrl: string | null };
  if (!signed.uploadUrl) {
    const assetId = localId(); await saveLocalAsset(assetId, file);
    return { assetId, previewUrl: URL.createObjectURL(file), mode: "local", mimeType: file.type, fileName: file.name };
  }
  const uploaded = await fetch(signed.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!uploaded.ok) throw new Error("Upload file thất bại.");
  const complete = await fetch("/api/storage/complete", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId: input?.organizationId, key: signed.key, fileName: file.name, mimeType: file.type, sizeBytes: file.size, assetType: input?.assetType ?? "image", metadata: input?.metadata ?? {}, checksum: input?.checksum, width: input?.width, height: input?.height })
  });
  if (!complete.ok) throw new Error("Không thể xác nhận file đã tải lên.");
  const result = await complete.json() as { asset: { id: string; storage_key?: string; mime_type?: string; original_name?: string; quarantine_status?: string }; scan?: { status?: string } };
  return { assetId: result.asset.id, previewUrl: URL.createObjectURL(file), mode: "cloud", storageKey: result.asset.storage_key ?? signed.key, mimeType: result.asset.mime_type ?? file.type, fileName: result.asset.original_name ?? file.name, scanStatus: result.scan?.status ?? result.asset.quarantine_status };
}

export async function resolveAssetUrl(assetId: string) {
  if (assetId.startsWith("local:")) {
    const blob = await readLocalAsset(assetId);
    return blob ? URL.createObjectURL(blob) : null;
  }
  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/url`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json() as { url?: string | null };
  return payload.url ?? null;
}
