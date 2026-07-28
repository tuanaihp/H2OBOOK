import type { H2OElement, H2OPage } from "@/types/editor";
import { uid } from "@/lib/utils";
import { uploadAsset, type UploadedAsset } from "@/lib/assets/asset-client";
import {
  imageMetadataWarnings,
  parseImageMetadata,
  sha256Hex,
  workerImageOcrToImportDocument,
  type ImageMetadata,
  type ImageRegion,
} from "@h2obook/input-core";
import type { ImportDocument } from "@h2obook/input-core";

export type ImageInspection = {
  file: File;
  previewUrl: string;
  metadata: ImageMetadata;
  warnings: ReturnType<typeof imageMetadataWarnings>;
};

export type ImageImportContext = {
  organizationId?: string;
  bookId: string;
  title?: string;
  language?: string;
  onProgress?: (status: string, progress: number) => void;
  onJobCreated?: (jobId: string) => void | Promise<void>;
};

type QueueJob = { id?: string; status?: string; progress?: number; output?: Record<string, unknown>; error?: string };

async function decodeDimensions(file: File) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const value = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return value;
  }
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };
    image.src = objectUrl;
  });
}

export async function inspectImage(file: File): Promise<ImageInspection> {
  const buffer = await file.arrayBuffer();
  let metadata = parseImageMetadata(buffer, { fileName: file.name, mimeType: file.type || (/\.png$/i.test(file.name) ? "image/png" : "image/jpeg"), sizeBytes: file.size });
  const decoded = await decodeDimensions(file);
  if (!metadata.pixelWidth || !metadata.pixelHeight || [5,6,7,8].includes(metadata.orientation)) {
    metadata = { ...metadata, pixelWidth: decoded.width, pixelHeight: decoded.height, source: "browser-decode" };
  }
  metadata.checksumSha256 = await sha256Hex(buffer);
  return { file, previewUrl: URL.createObjectURL(file), metadata, warnings: imageMetadataWarnings(metadata) };
}

export async function uploadInspectedImage(inspection: ImageInspection, input: { organizationId?: string; category?: string; assetType?: string }) {
  const normalizedFile = inspection.file.type === inspection.metadata.mimeType
    ? inspection.file
    : new File([inspection.file], inspection.file.name, { type: inspection.metadata.mimeType, lastModified: inspection.file.lastModified });
  const asset = await uploadAsset(normalizedFile, {
    organizationId: input.organizationId,
    category: input.category ?? "image-imports",
    assetType: input.assetType ?? "image",
    metadata: {
      pixelWidth: inspection.metadata.pixelWidth,
      pixelHeight: inspection.metadata.pixelHeight,
      orientation: inspection.metadata.orientation,
      dpiX: inspection.metadata.dpiX,
      dpiY: inspection.metadata.dpiY,
      colorProfile: inspection.metadata.colorProfile,
      hasAlpha: inspection.metadata.hasAlpha,
      importEngine: "image-smart-import-1.0",
    },
    checksum: inspection.metadata.checksumSha256,
    width: inspection.metadata.pixelWidth,
    height: inspection.metadata.pixelHeight,
  });
  if (process.env.NEXT_PUBLIC_APP_MODE === "production" && asset.storageKey && asset.scanStatus === "clean") {
    void generateThumbnailVariant(asset, input.organizationId).catch((error) => console.warn("[H2OBOOK image thumbnail]", error));
  }
  return asset;
}

async function generateThumbnailVariant(asset: UploadedAsset, organizationId?: string) {
  if (!asset.storageKey) return;
  const response = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, type: "thumbnail", input: { storageKey: asset.storageKey, assetId: asset.assetId, width: 480 } }) });
  const payload = await response.json().catch(() => null) as { job?: QueueJob; error?: string } | null;
  if (!response.ok || !payload?.job?.id) throw new Error(payload?.error || "THUMBNAIL_JOB_QUEUE_FAILED");
  const output = await pollJob(payload.job.id);
  const thumbnail = output.thumbnail as { key?: string; contentType?: string; sizeBytes?: number } | undefined;
  if (!thumbnail?.key || !thumbnail.contentType) return;
  await fetch("/api/input/image/materialize-variant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, sourceAssetId: asset.assetId, variantType: "thumbnail", storageKey: thumbnail.key, mimeType: thumbnail.contentType, width: 480, metadata: { processor: "pillow-webp" } }) });
}

function imagePermissions(locked = false): H2OElement["permissions"] {
  return {
    canEditContent: false,
    canMove: !locked,
    canResize: !locked,
    canDelete: !locked,
    canChangeColor: false,
    canReplaceAsset: !locked,
    canChangeFont: false,
    canRotate: !locked,
  };
}

export function buildImageElement(asset: UploadedAsset, metadata: ImageMetadata, input?: { pageWidth?: number; pageHeight?: number }) : H2OElement {
  const pageWidth = input?.pageWidth ?? 794;
  const pageHeight = input?.pageHeight ?? 1123;
  const maxWidth = pageWidth * 0.72;
  const maxHeight = pageHeight * 0.64;
  const ratio = metadata.pixelWidth / Math.max(1, metadata.pixelHeight);
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) { height = maxHeight; width = height * ratio; }
  return {
    id: uid("image"), type: "image", name: metadata.fileName,
    x: (pageWidth - width) / 2, y: (pageHeight - height) / 2,
    width, height, rotation: 0, opacity: 1, locked: false, hidden: false,
    assetId: asset.assetId, imageUrl: asset.previewUrl, imageFit: "contain", cornerRadius: 0,
    altText: metadata.fileName.replace(/\.[^.]+$/, ""), caption: "",
    imageMetadata: {
      pixelWidth: metadata.pixelWidth, pixelHeight: metadata.pixelHeight,
      orientation: metadata.orientation, dpiX: metadata.dpiX, dpiY: metadata.dpiY,
      colorProfile: metadata.colorProfile, checksumSha256: metadata.checksumSha256,
      originalFileName: metadata.fileName, originalMimeType: metadata.mimeType,
    },
    permissions: imagePermissions(false),
  };
}

export function buildFullPageImage(asset: UploadedAsset, metadata: ImageMetadata, input?: { pageWidth?: number }): H2OPage {
  const width = input?.pageWidth ?? 794;
  const height = Math.max(300, Math.round(width * metadata.pixelHeight / Math.max(1, metadata.pixelWidth)));
  return {
    id: uid("page"), name: metadata.fileName, pageType: "imported", width, height, background: "#ffffff",
    elements: [{
      id: uid("image"), type: "image", name: `Nền ${metadata.fileName}`,
      x: 0, y: 0, width, height, rotation: 0, opacity: 1, locked: true, hidden: false,
      assetId: asset.assetId, imageUrl: asset.previewUrl, imageFit: "fill", cornerRadius: 0,
      altText: metadata.fileName.replace(/\.[^.]+$/, ""), caption: "",
      imageMetadata: {
        pixelWidth: metadata.pixelWidth, pixelHeight: metadata.pixelHeight,
        orientation: metadata.orientation, dpiX: metadata.dpiX, dpiY: metadata.dpiY,
        colorProfile: metadata.colorProfile, checksumSha256: metadata.checksumSha256,
        originalFileName: metadata.fileName, originalMimeType: metadata.mimeType,
      },
      permissions: imagePermissions(true),
    }],
  };
}

async function pollJob(id: string, onProgress?: ImageImportContext["onProgress"]) {
  const started = Date.now();
  while (Date.now() - started < 15 * 60_000) {
    const response = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { job?: QueueJob; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || "IMAGE_JOB_STATUS_FAILED");
    const job = payload?.job;
    if (!job) throw new Error("IMAGE_JOB_NOT_FOUND");
    onProgress?.(job.status ?? "queued", Number(job.progress ?? 0));
    if (job.status === "completed") return job.output ?? {};
    if (job.status === "failed" || job.status === "cancelled") throw new Error(job.error || "IMAGE_JOB_FAILED");
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
  throw new Error("IMPORT_JOB_TIMEOUT");
}

export async function runImageOcr(inspection: ImageInspection, context: ImageImportContext, regions?: ImageRegion[]): Promise<ImportDocument> {
  const textRegions = regions?.filter((region) => region.kind === "text") ?? [];
  const saveRegions = async (sourceAssetId: string) => {
    if (process.env.NEXT_PUBLIC_APP_MODE !== "production" || !regions?.length) return;
    const response = await fetch("/api/input/image/regions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: context.organizationId, assetId: sourceAssetId, bookClientKey: context.bookId, regions }) });
    if (!response.ok) throw new Error("IMAGE_REGION_SAVE_FAILED");
  };

  if (regions && textRegions.length === 0) {
    const source = await uploadInspectedImage(inspection, { organizationId: context.organizationId, category: "image-region-sources", assetType: "image-source" });
    if (process.env.NEXT_PUBLIC_APP_MODE === "production" && source.scanStatus && source.scanStatus !== "clean") throw new Error(source.scanStatus === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING");
    await saveRegions(source.assetId);
    const now = new Date().toISOString();
    const chapterId = uid("chapter");
    const document = { id: uid("document"), bookId: context.bookId, organizationId: context.organizationId, title: context.title || inspection.metadata.fileName.replace(/\.[^.]+$/, ""), language: "vi", root: [{ id: chapterId, type: "chapter" as const, parentId: null, position: 0, attrs: { page: 1, pageWidth: inspection.metadata.pixelWidth, pageHeight: inspection.metadata.pixelHeight, source: "manual-regions" }, children: [], version: 1 }], metadata: { sourceType: "image", sourceFileName: inspection.metadata.fileName, sourceAssetId: source.assetId, importedAt: now, importEngine: "manual-regions-1.0" }, version: 1, createdAt: now, updatedAt: now };
    return workerImageOcrToImportDocument({ sourceFileName: inspection.metadata.fileName, document, metadata: { imageMetadata: inspection.metadata, sourceAssetId: source.assetId, regions } });
  }

  if (process.env.NEXT_PUBLIC_APP_MODE !== "production") {
    throw new Error("IMAGE_OCR_REQUIRES_WORKER: OCR ảnh dùng Tesseract server trong Production Mode; không gọi AI API.");
  }
  const source = await uploadInspectedImage(inspection, { organizationId: context.organizationId, category: "image-ocr-sources", assetType: "image-source" });
  if (!source.storageKey || source.assetId.startsWith("local:")) throw new Error("IMAGE_SOURCE_STORAGE_REQUIRED");
  if (source.scanStatus && source.scanStatus !== "clean") throw new Error(source.scanStatus === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING");
  await saveRegions(source.assetId);
  const response = await fetch("/api/jobs", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      organizationId: context.organizationId,
      type: "ocr",
      input: {
        storageKey: source.storageKey, assetId: source.assetId, bookId: context.bookId,
        title: context.title || inspection.metadata.fileName.replace(/\.[^.]+$/, ""),
        sourceFileName: inspection.metadata.fileName, language: context.language ?? "vie+eng",
        regions: textRegions,
      },
    }),
  });
  const payload = await response.json().catch(() => null) as { job?: QueueJob; error?: string } | null;
  if (!response.ok || !payload?.job?.id) throw new Error(payload?.error || "IMAGE_OCR_JOB_QUEUE_FAILED");
  await context.onJobCreated?.(payload.job.id);
  const output = await pollJob(payload.job.id, context.onProgress);
  const document = output.bookDocument as ImportDocument["document"] | undefined;
  if (!document?.root) throw new Error("SEMANTIC_CONVERSION_FAILED");
  return workerImageOcrToImportDocument({
    sourceFileName: inspection.metadata.fileName,
    document,
    warnings: Array.isArray(output.warnings) ? output.warnings as ImportDocument["warnings"] : [],
    metadata: { imageMetadata: inspection.metadata, sourceAssetId: source.assetId, regions: regions ?? [] },
  });
}

export async function cropImageRegion(inspection: ImageInspection, region: ImageRegion): Promise<File> {
  const bitmap = await createImageBitmap(inspection.file, { imageOrientation: "from-image" });
  try {
    const x = Math.max(0, Math.round(region.x));
    const y = Math.max(0, Math.round(region.y));
    const width = Math.max(1, Math.min(bitmap.width - x, Math.round(region.width)));
    const height = Math.max(1, Math.min(bitmap.height - y, Math.round(region.height)));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("IMAGE_CANVAS_UNAVAILABLE");
    context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
    const mimeType = inspection.metadata.hasAlpha ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("IMAGE_CROP_FAILED")), mimeType, 0.94));
    const extension = mimeType === "image/png" ? "png" : "jpg";
    return new File([blob], `${inspection.metadata.fileName.replace(/\.[^.]+$/, "")}-region-${region.order + 1}.${extension}`, { type: mimeType });
  } finally { bitmap.close(); }
}
