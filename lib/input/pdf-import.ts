import type { H2OPage } from "@/types/editor";
import type { ImportDocument, PdfPageModel, PdfSpan } from "@h2obook/input-core";
import { pdfPagesToImportDocument } from "@h2obook/input-core";
import { uploadAsset } from "@/lib/assets/asset-client";
import { uid } from "@/lib/utils";

export type PdfImportMode = "fixed_layout" | "editable_content" | "ocr";
export type PdfInspectionPage = {
  page: number;
  width: number;
  height: number;
  textItems: number;
  characters: number;
  likelyScanned: boolean;
  thumbnail?: string;
};
export type PdfInspection = {
  sourceFileName: string;
  title: string;
  pageCount: number;
  nativeTextPages: number;
  scannedPages: number;
  totalCharacters: number;
  encrypted: boolean;
  recommendedMode: PdfImportMode;
  pages: PdfInspectionPage[];
  warnings: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
};

type PdfJsTextItem = { str: string; transform: number[]; width: number; height: number; fontName?: string; hasEOL?: boolean };
type PdfJsTextContent = { items: Array<PdfJsTextItem | { type?: string }>; styles?: Record<string, { fontFamily?: string }> };
type PdfJsPage = {
  getViewport: (input: { scale: number }) => { width: number; height: number };
  getTextContent: (input?: Record<string, unknown>) => Promise<PdfJsTextContent>;
  render: (input: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

type PdfJsDocument = {
  numPages: number;
  getPage: (page: number) => Promise<PdfJsPage>;
  getMetadata?: () => Promise<{ info?: Record<string, unknown>; metadata?: unknown }>;
  destroy?: () => Promise<void>;
};

async function loadPdf(file: File): Promise<PdfJsDocument> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  try {
    // Every PDF reaching this function is an untrusted user upload. pdfjs-dist is pinned to
    // 6.2.108, the release that fixes the arbitrary-JavaScript-execution advisory affecting
    // >=5.6.83 <6.2.108 (the version range this project was on).
    //
    // There is deliberately no `isEvalSupported: false` here: that option existed in v5 to switch
    // off pdf.js's eval-based font/content-stream compilation, and v6 removed both the option and
    // the eval path it guarded. Passing it now is a type error, and adding it back would only
    // suggest a defence that the library no longer needs.
    return await pdfjs.getDocument({ data: await file.arrayBuffer(), useSystemFonts: true }).promise as unknown as PdfJsDocument;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password/i.test(message)) throw new Error("PDF_PASSWORD_PROTECTED: File PDF đang được bảo vệ bằng mật khẩu.");
    throw new Error(`PDF_OPEN_FAILED: ${message}`);
  }
}

function textItems(content: PdfJsTextContent): PdfJsTextItem[] {
  return content.items.filter((item): item is PdfJsTextItem => "str" in item && typeof item.str === "string");
}

function spanFromItem(item: PdfJsTextItem, page: number, styles?: PdfJsTextContent["styles"]): PdfSpan {
  const transform = item.transform ?? [1, 0, 0, 12, 0, 0];
  const fontSize = Math.max(1, Math.hypot(Number(transform[2] ?? 0), Number(transform[3] ?? 12)));
  const fontFamily = item.fontName ? styles?.[item.fontName]?.fontFamily : undefined;
  const fontDescriptor = `${item.fontName ?? ""} ${fontFamily ?? ""}`;
  return {
    text: item.str,
    page,
    x: Number(transform[4] ?? 0),
    y: Number(transform[5] ?? 0),
    width: Math.max(0, Number(item.width ?? 0)),
    height: Math.max(1, Number(item.height || fontSize)),
    fontSize,
    fontName: item.fontName,
    fontFamily,
    bold: /bold|black|heavy|semibold|demi/i.test(fontDescriptor),
    italic: /italic|oblique/i.test(fontDescriptor),
  };
}

async function pageThumbnail(page: PdfJsPage, maxWidth = 260) {
  const original = page.getViewport({ scale: 1 });
  const scale = Math.min(1.25, maxWidth / original.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function inspectPdf(file: File): Promise<PdfInspection> {
  const pdf = await loadPdf(file);
  try {
    const pages: PdfInspectionPage[] = [];
    let totalCharacters = 0;
    let nativeTextPages = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({ includeMarkedContent: true, disableNormalization: false });
      const items = textItems(content);
      const characters = items.reduce((sum, item) => sum + item.str.trim().length, 0);
      totalCharacters += characters;
      if (characters >= 20) nativeTextPages += 1;
      pages.push({
        page: pageNumber,
        width: viewport.width,
        height: viewport.height,
        textItems: items.length,
        characters,
        likelyScanned: characters < 20,
        thumbnail: pageNumber <= 3 ? await pageThumbnail(page) : undefined,
      });
    }
    const scannedPages = pages.filter((page) => page.likelyScanned).length;
    const warnings: PdfInspection["warnings"] = [];
    if (scannedPages) warnings.push({ code: "PDF_SCAN_PAGES_DETECTED", message: `${scannedPages}/${pdf.numPages} trang không có text layer đáng tin cậy.`, severity: scannedPages === pdf.numPages ? "warning" : "info" });
    if (pdf.numPages > 200) warnings.push({ code: "PDF_LARGE_DOCUMENT", message: "PDF có trên 200 trang; nên xử lý bằng worker production.", severity: "warning" });
    const metadata = await pdf.getMetadata?.().catch(() => null);
    const metadataTitle = typeof metadata?.info?.Title === "string" ? metadata.info.Title.trim() : "";
    return {
      sourceFileName: file.name,
      title: metadataTitle || file.name.replace(/\.pdf$/i, ""),
      pageCount: pdf.numPages,
      nativeTextPages,
      scannedPages,
      totalCharacters,
      encrypted: false,
      recommendedMode: nativeTextPages === 0 ? "ocr" : scannedPages > nativeTextPages ? "ocr" : "editable_content",
      pages,
      warnings,
    };
  } finally { await pdf.destroy?.().catch(() => undefined); }
}

export async function reconstructPdfInBrowser(file: File, input: { bookId: string; organizationId?: string; title?: string }): Promise<ImportDocument> {
  const pdf = await loadPdf(file);
  try {
    const pages: PdfPageModel[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({ includeMarkedContent: true, disableNormalization: false });
      pages.push({ page: pageNumber, width: viewport.width, height: viewport.height, spans: textItems(content).map((item) => spanFromItem(item, pageNumber, content.styles)) });
    }
    return pdfPagesToImportDocument({
      pages,
      title: input.title?.trim() || file.name.replace(/\.pdf$/i, ""),
      sourceFileName: file.name,
      bookId: input.bookId,
      organizationId: input.organizationId,
      engine: "pdfjs-text-layer-1.0",
      warnings: [{ code: "PDF_CLIENT_RECONSTRUCTION", message: "Bản xem trước được dựng bằng text layer trong trình duyệt. Ảnh và bảng phức tạp sẽ chính xác hơn khi dùng worker production.", severity: "info" }],
    });
  } finally { await pdf.destroy?.().catch(() => undefined); }
}

export async function renderPdfFixedLayout(file: File, input: { organizationId?: string; progress?: (current: number, total: number) => void }): Promise<H2OPage[]> {
  const pdf = await loadPdf(file);
  const pages: H2OPage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      input.progress?.(pageNumber, pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const original = page.getViewport({ scale: 1 });
      const targetWidth = 794;
      const targetHeight = Math.max(300, Math.round(targetWidth * original.height / original.width));
      const renderScale = Math.min(2.2, Math.max(1, targetWidth / original.width) * 1.6);
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PDF_CANVAS_UNAVAILABLE");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PDF_RENDER_FAILED")), "image/jpeg", 0.92));
      const pageFile = new File([blob], `${file.name.replace(/\.pdf$/i, "")}-page-${pageNumber}.jpg`, { type: "image/jpeg" });
      const asset = await uploadAsset(pageFile, { organizationId: input.organizationId, category: "pdf-pages", assetType: "pdf-page" });
      pages.push({
        id: uid("page"), name: `${file.name} — ${pageNumber}`, pageType: "imported", width: targetWidth, height: targetHeight, background: "#ffffff",
        elements: [{
          id: uid("image"), type: "image", name: "Trang PDF gốc", x: 0, y: 0, width: targetWidth, height: targetHeight, rotation: 0, opacity: 1,
          locked: true, hidden: false, assetId: asset.assetId, imageUrl: asset.previewUrl, altText: `Trang ${pageNumber} của ${file.name}`,
          caption: "", imageFit: "fill", permissions: { canEditContent: false, canMove: false, canResize: false, canDelete: false, canChangeColor: false, canReplaceAsset: false, canChangeFont: false, canRotate: false },
        }],
      });
    }
    return pages;
  } finally { await pdf.destroy?.().catch(() => undefined); }
}

type QueueJob = { id?: string; status?: string; progress?: number; output?: Record<string, unknown>; error?: string };
async function pollJob(id: string, onProgress?: (status: string, progress: number) => void) {
  const started = Date.now();
  while (Date.now() - started < 15 * 60_000) {
    const response = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { job?: QueueJob; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || "PDF_JOB_STATUS_FAILED");
    const job = payload?.job;
    if (!job) throw new Error("PDF_JOB_NOT_FOUND");
    onProgress?.(job.status ?? "queued", Number(job.progress ?? 0));
    if (job.status === "completed") return job.output ?? {};
    if (job.status === "failed" || job.status === "cancelled") throw new Error(job.error || "PDF_JOB_FAILED");
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
  }
  throw new Error("IMPORT_JOB_TIMEOUT");
}

export async function reconstructPdfWithWorker(file: File, input: { bookId: string; organizationId?: string; title?: string; mode: "editable_content" | "ocr"; onProgress?: (status: string, progress: number) => void; onJobCreated?: (jobId: string) => void | Promise<void> }): Promise<ImportDocument> {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "production") {
    if (input.mode === "ocr") throw new Error("PDF_OCR_REQUIRES_WORKER: Demo Mode chưa chạy Tesseract server. Hãy dùng Production Mode hoặc chọn nội dung chỉnh sửa nếu PDF có text layer.");
    return reconstructPdfInBrowser(file, input);
  }
  const source = await uploadAsset(file, { organizationId: input.organizationId, category: "pdf-sources", assetType: "pdf-source" });
  if (!source.storageKey || source.assetId.startsWith("local:")) throw new Error("PDF_SOURCE_STORAGE_REQUIRED");
  if (source.scanStatus && source.scanStatus !== "clean") throw new Error(source.scanStatus === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING");
  const type = input.mode === "ocr" ? "ocr" : "pdf_reconstruct";
  const response = await fetch("/api/jobs", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId: input.organizationId, type, input: { storageKey: source.storageKey, assetId: source.assetId, bookId: input.bookId, title: input.title || file.name.replace(/\.pdf$/i, ""), sourceFileName: file.name, language: "vie+eng" } }),
  });
  const payload = await response.json().catch(() => null) as { job?: QueueJob; error?: string } | null;
  if (!response.ok || !payload?.job?.id) throw new Error(payload?.error || "PDF_JOB_QUEUE_FAILED");
  await input.onJobCreated?.(payload.job.id);
  const output = await pollJob(payload.job.id, input.onProgress);
  let document = output.bookDocument as ImportDocument["document"] | undefined;
  if (!document?.root) throw new Error("SEMANTIC_CONVERSION_FAILED");
  let assets = Array.isArray(output.assets) ? output.assets as Array<ImportDocument["assets"][number] & { storageKey?: string }> : [];
  if (assets.some((asset) => asset.storageKey)) {
    const materialized = await fetch("/api/input/pdf/materialize-assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: input.organizationId, sourceAssetId: source.assetId, assets }) });
    const materializedPayload = await materialized.json().catch(() => null) as { assets?: Array<{ sourceAssetId?: string; assetId: string; previewUrl: string; fileName: string; mimeType: string }> ; error?: string } | null;
    if (!materialized.ok) throw new Error(materializedPayload?.error || "PDF_ASSET_MATERIALIZATION_FAILED");
    const mapping = new Map((materializedPayload?.assets ?? []).map((asset) => [asset.sourceAssetId, asset]));
    const replace = (nodes: ImportDocument["document"]["root"]): ImportDocument["document"]["root"] => nodes.map((node) => {
      const sourceId = typeof node.attrs.assetId === "string" ? node.attrs.assetId : undefined;
      const target = sourceId ? mapping.get(sourceId) : undefined;
      return { ...node, attrs: target ? { ...node.attrs, assetId: target.assetId, legacyUrl: target.previewUrl } : node.attrs, children: replace(node.children) };
    });
    document = { ...document, root: replace(document.root) };
    assets = (materializedPayload?.assets ?? []).map((asset) => ({ assetId: asset.assetId, previewUrl: asset.previewUrl, fileName: asset.fileName, mimeType: asset.mimeType }));
  }
  const warnings = Array.isArray(output.warnings) ? output.warnings as ImportDocument["warnings"] : [];
  return {
    format: "pdf", sourceFileName: file.name, title: document.title, document, nodes: document.root,
    assets, warnings,
    statistics: (output.statistics as ImportDocument["statistics"] | undefined) ?? { nodes: document.root.length, headings: 0, paragraphs: 0, lists: 0, tables: 0, images: 0, footnotes: 0, words: 0 },
    metadata: document.metadata, previewHtml: typeof output.previewHtml === "string" ? output.previewHtml : undefined,
  };
}
