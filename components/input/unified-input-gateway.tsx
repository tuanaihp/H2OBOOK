"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileArchive, FileImage, FileStack, FileText, Globe2, Loader2, Play, RefreshCw, RotateCcw, Save, Upload, XCircle } from "lucide-react";
import type { H2OBook, H2OElement, H2OPage } from "@/types/editor";
import type { ImportDocument, InputDestinationConfig, InputMode, InputSessionStatus, OrchestratedInputSession } from "@h2obook/input-core";
import { detectInputFormat, extractSessionOutline, inputModeMatrix, plainTextToImportDocument, sessionDisplayStage, summarizeWarnings } from "@h2obook/input-core";
import { useAppStore } from "@/store/app-store";
import { useEditorStore } from "@/store/editor-store";
import { importDocxToBookDocument } from "@/lib/input/word-import";
import { inspectPdf, reconstructPdfInBrowser, reconstructPdfWithWorker, renderPdfFixedLayout, type PdfInspection } from "@/lib/input/pdf-import";
import { inspectImage, type ImageInspection } from "@/lib/input/image-import";
import { buildPagesFromImages, naturalSortImageFiles } from "@/lib/input/image-batch-import";
import { extractImagesFromZip } from "@/lib/input/zip-import";
import { localizeHtmlAssets, previewHtmlFile, previewHtmlUrl } from "@/lib/input/html-import";
import { ImageSmartImport } from "@/components/editor/image-smart-import";
import {
  cancelOrchestratedInput,
  commitOrchestratedInput,
  createOrResumeInputSession,
  recoverOrchestratedInput,
  retryOrchestratedInput,
  saveOrchestratorPreview,
} from "@/lib/input/orchestrator-client";
import { uid } from "@/lib/utils";

const ACCEPT = ".docx,.pdf,.png,.jpg,.jpeg,.jpe,.html,.htm,.xhtml,.md,.markdown,.txt";
const IMAGE_BOOK_IMPORT_ENABLED = process.env.NEXT_PUBLIC_IMAGE_BOOK_IMPORT_V1 !== "false";
type DestinationChoice = "new_book" | "append_chapter" | "replace_document";

type SourceState = { kind: "file"; file: File } | { kind: "url"; url: string } | { kind: "images"; files: File[]; zipWarnings?: { entryName: string; reason: string }[] } | null;

function makeDesignBook(base: H2OBook, pages: H2OPage[], choice: DestinationChoice, title: string): H2OBook {
  const now = new Date().toISOString();
  if (choice === "new_book") return { ...structuredClone(base), id: `import-${crypto.randomUUID()}`, title, subtitle: "", description: "", status: "draft", pages, updatedAt: now };
  if (choice === "replace_document") return { ...structuredClone(base), title: title || base.title, pages, updatedAt: now };
  return { ...structuredClone(base), pages: [...base.pages, ...pages.map((page, index) => ({ ...page, name: page.name || `Trang nhập ${base.pages.length + index + 1}` }))], updatedAt: now };
}

function fileSource(file: File) {
  return { kind: "file" as const, fileName: file.name, mimeType: file.type || undefined, sizeBytes: file.size };
}

async function patchStage(session: OrchestratedInputSession, organizationId: string, status: InputSessionStatus, progress: number, stageMessage: string) {
  if (session.metadata.offline) return { ...session, status, progress, stageMessage, updatedAt: new Date().toISOString() };
  const response = await fetch(`/api/input/sessions/${session.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, status, progress, stageMessage, eventName: `session.${status}` }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error ?? "INPUT_STAGE_UPDATE_FAILED"));
  return body.session as OrchestratedInputSession;
}

export function UnifiedInputGateway({ initialBookId }: { initialBookId?: string }) {
  const organizationId = useAppStore((state) => state.workspace.id);
  const libraryBooks = useAppStore((state) => state.books);
  const editor = useEditorStore();
  const [source, setSource] = useState<SourceState>(null);
  const [urlValue, setUrlValue] = useState("");
  const [mode, setMode] = useState<InputMode>("editable_content");
  const [destinationChoice, setDestinationChoice] = useState<DestinationChoice>(initialBookId ? "append_chapter" : "new_book");
  const [targetBookId, setTargetBookId] = useState(initialBookId || editor.book.id);
  const [chapterTitle, setChapterTitle] = useState("Nội dung nhập");
  const [session, setSession] = useState<OrchestratedInputSession | null>(null);
  const [preview, setPreview] = useState<ImportDocument | null>(null);
  const [designPayload, setDesignPayload] = useState<H2OBook | null>(null);
  const [pdfInspection, setPdfInspection] = useState<PdfInspection | null>(null);
  const [imageInspection, setImageInspection] = useState<ImageInspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Chọn file hoặc nhập URL để bắt đầu.");
  const [error, setError] = useState("");

  const format = useMemo(() => source?.kind === "url" ? "url" : source?.kind === "file" ? detectInputFormat({ fileName: source.file.name, mimeType: source.file.type }) : null, [source]);
  const isImageBatch = source?.kind === "images";
  const modes = format ? inputModeMatrix[format] : [];
  const warningSummary = preview ? summarizeWarnings(preview.warnings) : null;
  const outline = preview ? extractSessionOutline(preview.document) : [];

  const selectFile = async (file?: File) => {
    if (!file) return;
    setError(""); setPreview(null); setDesignPayload(null); setSession(null); setPdfInspection(null); setImageInspection(null);
    const detected = detectInputFormat({ fileName: file.name, mimeType: file.type });
    if (!detected) { setError("INPUT_FORMAT_UNSUPPORTED"); return; }
    const defaultMode = inputModeMatrix[detected][0]; setMode(defaultMode); setSource({ kind: "file", file });
    setMessage(`Đã nhận dạng ${detected.toUpperCase()}: ${file.name}`);
    if (detected === "pdf") {
      setBusy(true); try { const inspection = await inspectPdf(file); setPdfInspection(inspection); setMode(inspection.recommendedMode); setMessage(`PDF ${inspection.pageCount} trang; đề xuất ${inspection.recommendedMode}.`); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "PDF_INSPECTION_FAILED"); } finally { setBusy(false); }
    }
    if (detected === "png" || detected === "jpeg") {
      setBusy(true); try { const inspection = await inspectImage(file); setImageInspection(inspection); setMessage(`Ảnh ${inspection.metadata.pixelWidth}×${inspection.metadata.pixelHeight}px đã sẵn sàng.`); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "IMAGE_INSPECTION_FAILED"); } finally { setBusy(false); }
    }
  };

  // H2OBOOK Image Book & Teaching Upgrade V1 — "Tạo sách từ nhiều ảnh" / "Tải ZIP trang sách".
  // A single .zip is extracted (path-traversal/zip-bomb guarded, natural sort) into its image
  // entries; otherwise every selected file is treated as one page image directly.
  const selectImageBatch = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError(""); setPreview(null); setDesignPayload(null); setSession(null); setPdfInspection(null); setImageInspection(null);
    setBusy(true);
    try {
      const picked = Array.from(fileList);
      let files: File[];
      let zipWarnings: { entryName: string; reason: string }[] | undefined;
      if (picked.length === 1 && /\.zip$/i.test(picked[0].name)) {
        const extraction = await extractImagesFromZip(picked[0]);
        files = extraction.files;
        zipWarnings = extraction.warnings;
      } else {
        files = picked.filter((file) => /\.(png|jpe?g)$/i.test(file.name) || file.type === "image/png" || file.type === "image/jpeg");
      }
      if (!files.length) { setError("IMAGE_BATCH_EMPTY: không tìm thấy ảnh PNG/JPEG hợp lệ."); return; }
      const sorted = naturalSortImageFiles(files);
      setSource({ kind: "images", files: sorted, zipWarnings });
      setMode("full_page");
      setMessage(`Đã sẵn sàng ${sorted.length} trang từ ${picked.length === 1 && /\.zip$/i.test(picked[0].name) ? "file ZIP" : "ảnh đã chọn"}.`);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "IMAGE_BATCH_READ_FAILED"); }
    finally { setBusy(false); }
  };

  const processImageBatch = async () => {
    if (!source || source.kind !== "images") return;
    setBusy(true); setError("");
    try {
      const sourceDescriptor = { kind: "file" as const, fileName: `${source.files.length}-trang.png`, mimeType: "image/png", sizeBytes: source.files.reduce((sum, file) => sum + file.size, 0) };
      const result = await createOrResumeInputSession({ organizationId, sourceName: `Nhiều ảnh (${source.files.length} trang)`, mimeType: "image/png", format: "png", mode: "full_page", source: sourceDescriptor, destination: destination(true) });
      let current = result.session; setSession(current);
      current = await patchStage(current, organizationId, "validating", 12, "Đang kiểm tra ảnh."); setSession(current);
      current = await patchStage(current, organizationId, "processing", 35, "Đang tải và dựng trang."); setSession(current);
      const { pages, failures } = await buildPagesFromImages({ files: source.files, organizationId, onProgress: (done, total, fileName) => setMessage(`Đang xử lý ${done}/${total}: ${fileName}`) });
      if (!pages.length) throw new Error("IMAGE_BATCH_ALL_FAILED: không tạo được trang nào.");
      const title = destinationChoice === "new_book" ? `Sách từ ${pages.length} ảnh` : editor.book.title;
      const design = makeDesignBook(editor.book, pages, destinationChoice, title);
      const placeholder = plainTextToImportDocument({ sourceFileName: sourceDescriptor.fileName, text: `Đã tạo ${pages.length} trang từ ảnh.${failures.length ? ` ${failures.length} ảnh lỗi: ${failures.map((f) => f.fileName).join(", ")}.` : ""}`, format: "txt", bookId: design.id, organizationId });
      placeholder.metadata.designImport = true; placeholder.metadata.pageCount = pages.length;
      if (failures.length) placeholder.warnings = [...placeholder.warnings, ...failures.map((f) => ({ code: "IMAGE_BATCH_FILE_FAILED", message: `${f.fileName}: ${f.reason}`, severity: "warning" as const }))];
      if (source.zipWarnings?.length) placeholder.warnings = [...placeholder.warnings, ...source.zipWarnings.map((w) => ({ code: "ZIP_ENTRY_SKIPPED", message: `${w.entryName}: ${w.reason}`, severity: "info" as const }))];
      await stagePreview(current, placeholder, design);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "IMAGE_BATCH_PROCESS_FAILED"); setMessage("Xử lý chưa hoàn thành."); }
    finally { setBusy(false); }
  };

  const selectUrl = () => {
    try { const normalized = new URL(urlValue.trim()).toString(); setSource({ kind: "url", url: normalized }); setMode("editable_content"); setSession(null); setPreview(null); setDesignPayload(null); setError(""); setMessage(`URL đã sẵn sàng: ${normalized}`); }
    catch { setError("URL_INVALID"); }
  };

  const destination = (design = false): InputDestinationConfig => {
    if (destinationChoice === "new_book") return { type: "new_book", openMode: design ? "design" : "compose" };
    if (design) return { type: "design_pages", targetBookId, targetClientKey: targetBookId, openMode: "design" };
    if (destinationChoice === "append_chapter") return { type: "append_chapter", targetBookId, targetClientKey: targetBookId, chapterTitle, openMode: "compose" };
    return { type: "replace_document", targetBookId, targetClientKey: targetBookId, openMode: "compose" };
  };

  const ensureSession = async (overrideMode = mode, design = false) => {
    if (!source || !format || source.kind === "images") throw new Error("INPUT_SOURCE_REQUIRED");
    const sourceDescriptor = source.kind === "url" ? { kind: "url" as const, url: source.url, fileName: new URL(source.url).pathname.split("/").pop() || "web-page.html", mimeType: "text/html" } : fileSource(source.file);
    const result = await createOrResumeInputSession({ organizationId, sourceName: source.kind === "url" ? source.url : source.file.name, mimeType: sourceDescriptor.mimeType, format, mode: overrideMode, source: sourceDescriptor, destination: destination(design) });
    setSession(result.session); return result.session;
  };

  const linkWorkerJob = async (current: OrchestratedInputSession, jobId: string) => {
    if (current.metadata.offline) return;
    const response = await fetch(`/api/input/sessions/${current.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, progress: 40, externalJobId: jobId, stageMessage: `Worker job ${jobId} đang xử lý.`, eventName: "session.worker_linked" }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.session) setSession(body.session as OrchestratedInputSession);
  };

  const stagePreview = async (current: OrchestratedInputSession, result: ImportDocument, design?: H2OBook) => {
    const saved = await saveOrchestratorPreview({ organizationId, session: current, preview: result, designPayload: design as unknown as Record<string, unknown> | undefined });
    setSession(saved); setPreview(result); setDesignPayload(design ?? null); setMessage("Preview đã sẵn sàng. Kiểm tra trước khi commit."); return saved;
  };

  const process = async () => {
    if (!source || !format || source.kind === "images") return;
    setBusy(true); setError("");
    try {
      let current = await ensureSession(mode, mode === "fixed_layout" || mode === "asset" || mode === "full_page");
      current = await patchStage(current, organizationId, "validating", 12, "Đang kiểm tra nguồn nhập."); setSession(current);
      current = await patchStage(current, organizationId, "processing", 35, "Đang xử lý nội dung."); setSession(current);
      const bookId = destinationChoice === "new_book" ? `import-${crypto.randomUUID()}` : targetBookId || editor.book.id;
      let result: ImportDocument;
      let design: H2OBook | undefined;

      if (source.kind === "url") {
        result = await previewHtmlUrl(source.url, { bookId, organizationId });
        result = await localizeHtmlAssets(result, { organizationId, progress: (done, total) => setMessage(`Đang lưu ảnh từ URL ${done}/${total}...`) });
      } else if (format === "docx") result = await importDocxToBookDocument(source.file, { bookId, organizationId });
      else if (format === "html") {
        result = await previewHtmlFile(source.file, { bookId, organizationId });
        result = await localizeHtmlAssets(result, { organizationId, progress: (done, total) => setMessage(`Đang lưu ảnh HTML ${done}/${total}...`) });
      } else if (format === "markdown" || format === "txt") result = plainTextToImportDocument({ sourceFileName: source.file.name, text: await source.file.text(), format, bookId, organizationId });
      else if (format === "pdf") {
        if (mode === "fixed_layout") {
          const pages = await renderPdfFixedLayout(source.file, { organizationId, progress: (currentPage, total) => setMessage(`Đang dựng trang PDF ${currentPage}/${total}...`) });
          design = makeDesignBook(editor.book, pages, destinationChoice, source.file.name.replace(/\.pdf$/i, ""));
          result = plainTextToImportDocument({ sourceFileName: source.file.name, text: `PDF fixed-layout gồm ${pages.length} trang. Nội dung được lưu trong design payload.`, format: "txt", bookId: design.id, organizationId });
          result.metadata.designImport = true; result.metadata.pageCount = pages.length;
        } else if (mode === "ocr") result = await reconstructPdfWithWorker(source.file, { bookId, organizationId, mode: "ocr", onProgress: (status, progress) => setMessage(`OCR PDF: ${status} ${Math.round(progress)}%`), onJobCreated: (jobId) => linkWorkerJob(current, jobId) });
        else {
          try { result = await reconstructPdfWithWorker(source.file, { bookId, organizationId, mode: "editable_content", onProgress: (status, progress) => setMessage(`PDF: ${status} ${Math.round(progress)}%`), onJobCreated: (jobId) => linkWorkerJob(current, jobId) }); }
          catch { result = await reconstructPdfInBrowser(source.file, { bookId, organizationId }); }
        }
      } else throw new Error("IMAGE_USE_SMART_IMPORT_PANEL");
      await stagePreview(current, result, design);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "INPUT_PROCESS_FAILED"); setMessage("Xử lý chưa hoàn thành."); }
    finally { setBusy(false); }
  };

  const saveImageSemanticPreview = async (result: ImportDocument) => {
    setBusy(true); setError("");
    try { let current = session ?? await ensureSession(mode); if (current.status === "detected") current = await patchStage(current, organizationId, "validating", 12, "Đang kiểm tra ảnh."); if (current.status === "validating") current = await patchStage(current, organizationId, "processing", 35, "Đang chuẩn hóa kết quả ảnh."); await stagePreview(current, result); setImageInspection(null); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "IMAGE_PREVIEW_FAILED"); }
    finally { setBusy(false); }
  };

  const saveImageDesign = async (kind: "asset" | "full_page", value: { assetId?: string; previewUrl?: string; fileName?: string; metadata?: H2OElement["imageMetadata"]; page?: H2OPage }) => {
    if (!source || source.kind !== "file") return;
    setBusy(true); setError("");
    try {
      let current = session ?? await ensureSession(kind === "asset" ? "asset" : "full_page", true);
      if (current.status === "detected") current = await patchStage(current, organizationId, "validating", 12, "Đang kiểm tra ảnh.");
      if (current.status === "validating") current = await patchStage(current, organizationId, "processing", 35, "Đang tạo design payload.");
      let nextBook: H2OBook;
      if (kind === "full_page" && value.page) nextBook = makeDesignBook(editor.book, [value.page], destinationChoice, source.file.name.replace(/\.[^.]+$/, ""));
      else {
        const base = structuredClone(editor.book);
        const page = base.pages.find((item) => item.id === editor.activePageId) ?? base.pages[0];
        if (!page || !value.previewUrl) throw new Error("EDITOR_PAGE_REQUIRED");
        const image = { id: uid("image"), type: "image" as const, name: value.fileName || "Hình ảnh", x: 120, y: 160, width: Math.min(560, page.width * .7), height: Math.min(420, page.height * .5), rotation: 0, opacity: 1, locked: false, hidden: false, assetId: value.assetId, imageUrl: value.previewUrl, imageMetadata: value.metadata, altText: (value.fileName || "Hình ảnh").replace(/\.[^.]+$/, ""), imageFit: "contain" as const, permissions: { canEditContent: false, canMove: true, canResize: true, canDelete: true, canChangeColor: false, canReplaceAsset: true, canChangeFont: false, canRotate: true } };
        page.elements.push(image); nextBook = { ...base, updatedAt: new Date().toISOString() };
      }
      const placeholder = plainTextToImportDocument({ sourceFileName: source.file.name, text: kind === "asset" ? "Image asset import" : "Full-page image import", format: "txt", bookId: nextBook.id, organizationId });
      placeholder.metadata.designImport = true; placeholder.metadata.imageMode = kind;
      await stagePreview(current, placeholder, nextBook); setImageInspection(null);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "IMAGE_DESIGN_PREVIEW_FAILED"); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!session || !preview) return;
    setBusy(true); setError("");
    try {
      const result = await commitOrchestratedInput({ organizationId, session, destination: destination(Boolean(designPayload)) });
      if (designPayload) editor.replaceBook(designPayload);
      else localStorage.setItem(`h2obook-semantic-${result?.clientKey ?? result?.bookId ?? preview.document.bookId}`, JSON.stringify(preview.document));
      setSession((current) => current ? { ...current, status: "completed", progress: 100, commitResult: result, retryable: false } : current);
      setMessage("Đã commit an toàn. Có thể mở editor từ đường dẫn kết quả.");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "INPUT_COMMIT_FAILED"); setMessage("Commit cần recovery; preview vẫn được giữ."); }
    finally { setBusy(false); }
  };

  const cancel = async () => { if (!session) { setSource(null); return; } setBusy(true); try { setSession(await cancelOrchestratedInput(organizationId, session)); setMessage("Phiên nhập đã hủy; có thể retry sau."); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "INPUT_CANCEL_FAILED"); } finally { setBusy(false); } };
  const retry = async () => { if (!session) return; setBusy(true); try { const next = await retryOrchestratedInput(organizationId, session); setSession(next); setMessage("Phiên đã mở lại. Hãy chạy xử lý hoặc commit lại."); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "INPUT_RETRY_FAILED"); } finally { setBusy(false); } };
  const recover = async () => { if (!session) return; setBusy(true); try { const result = await recoverOrchestratedInput(organizationId, session.id); setSession(result.session); setPreview(result.session.preview ?? null); setMessage("Đã khôi phục session từ cloud/local cache."); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "INPUT_RECOVERY_FAILED"); } finally { setBusy(false); } };

  return <div className="unified-input-gateway">
    <header className="input-gateway-hero"><div><span className="eyebrow">H2OBOOK 4.13.7</span><h1>Unified Input Orchestrator</h1><p>Một luồng duy nhất cho DOCX, PDF, ảnh, HTML, Markdown, TXT và URL. AI không bắt buộc.</p></div>{session && <div className="input-session-badge" data-status={session.status}><strong>{sessionDisplayStage(session.status)}</strong><span>{session.progress}%</span></div>}</header>

    <section className="input-source-grid">
      <label className="input-source-card"><Upload/><strong>Chọn file</strong><span>DOCX, PDF, PNG, JPEG/JPE, HTML/HTM, Markdown, TXT</span><input type="file" accept={ACCEPT} onChange={(event) => void selectFile(event.target.files?.[0])}/></label>
      <div className="input-source-card"><Globe2/><strong>Nhập URL</strong><span>Website hoặc Google Docs công khai</span><div className="input-url-row"><input value={urlValue} onChange={(event) => setUrlValue(event.target.value)} placeholder="https://..."/><button onClick={selectUrl}>Dùng URL</button></div></div>
      {IMAGE_BOOK_IMPORT_ENABLED && <label className="input-source-card"><FileStack/><strong>Nhiều ảnh / ZIP trang sách</strong><span>Chọn nhiều PNG/JPEG hoặc 1 file ZIP — mỗi ảnh thành 1 trang</span><input type="file" multiple accept=".png,.jpg,.jpeg,.jpe,.zip" onChange={(event) => void selectImageBatch(event.target.files)}/></label>}
    </section>

    {source && format && <section className="input-configuration">
      <div><label>Định dạng</label><strong>{format.toUpperCase()}</strong></div>
      <label>Chế độ<select value={mode} onChange={(event) => setMode(event.target.value as InputMode)}>{modes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label>Đích nhập<select value={destinationChoice} onChange={(event) => setDestinationChoice(event.target.value as DestinationChoice)}><option value="new_book">Tạo sách mới</option><option value="append_chapter">Nối vào sách hiện tại</option><option value="replace_document">Thay nội dung sách</option></select></label>
      {destinationChoice !== "new_book" && <label>Sách đích<select value={targetBookId} onChange={(event) => setTargetBookId(event.target.value)}><option value={editor.book.id}>{editor.book.title} — đang mở</option>{libraryBooks.filter((book) => book.id !== editor.book.id).map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>}
      {destinationChoice === "append_chapter" && <label>Tên chương<input value={chapterTitle} onChange={(event) => setChapterTitle(event.target.value)}/></label>}
    </section>}

    {isImageBatch && source && source.kind === "images" && <section className="input-configuration">
      <div><label>Nguồn</label><strong>{source.files.length} trang ảnh</strong></div>
      <label>Đích nhập<select value={destinationChoice} onChange={(event) => setDestinationChoice(event.target.value as DestinationChoice)}><option value="new_book">Tạo sách mới</option><option value="append_chapter">Nối vào sách hiện tại</option><option value="replace_document">Thay nội dung sách</option></select></label>
      {destinationChoice !== "new_book" && <label>Sách đích<select value={targetBookId} onChange={(event) => setTargetBookId(event.target.value)}><option value={editor.book.id}>{editor.book.title} — đang mở</option>{libraryBooks.filter((book) => book.id !== editor.book.id).map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>}
      {source.zipWarnings && source.zipWarnings.length > 0 && <div className="word-import-warnings">{source.zipWarnings.slice(0, 10).map((warning, index) => <p key={`${warning.entryName}-${index}`} data-severity="info"><strong>{warning.entryName}</strong>{warning.reason}</p>)}</div>}
    </section>}

    {pdfInspection && <section className="input-inspection"><FileArchive/><div><strong>{pdfInspection.pageCount} trang PDF</strong><span>{pdfInspection.nativeTextPages} trang native text · {pdfInspection.scannedPages} trang scan</span></div></section>}

    {imageInspection && source?.kind === "file" && <ImageSmartImport inspection={imageInspection} onCancel={() => setImageInspection(null)} onStatus={setMessage} onModeChange={(next) => setMode(next)} onCommitSemantic={async (result) => saveImageSemanticPreview(result)} onCommitAsset={async (asset) => saveImageDesign("asset", asset)} onCommitFullPage={async (page) => saveImageDesign("full_page", { page })} onJobCreated={async (jobId) => { const current = session ?? await ensureSession(mode); await linkWorkerJob(current, jobId); }}/>}

    {!imageInspection && source && <div className="input-action-row"><button className="btn btn-primary" disabled={busy} onClick={() => void (isImageBatch ? processImageBatch() : process())}>{busy ? <Loader2 className="spin"/> : <Play/>} Xử lý & tạo preview</button><button className="btn btn-secondary" disabled={busy} onClick={() => void cancel()}><XCircle/> Hủy</button>{session && ["failed","cancelled","recovery_required"].includes(session.status) && <button className="btn btn-secondary" onClick={() => void retry()}><RefreshCw/> Retry</button>}{session && <button className="btn btn-secondary" onClick={() => void recover()}><RotateCcw/> Recovery</button>}</div>}

    <div className="input-stage-message">{error ? <AlertTriangle/> : session?.status === "completed" ? <CheckCircle2/> : <FileText/>}<span>{error || message}</span></div>
    {session && <div className="input-progress"><div style={{ width: `${session.progress}%` }}/></div>}

    {preview && <section className="unified-preview">
      <div className="unified-preview-head"><div><span className="eyebrow">NORMALIZED PREVIEW</span><h2>{preview.title}</h2><p>{preview.sourceFileName}</p></div><div className="warning-counts"><span>{warningSummary?.info ?? 0} info</span><span>{warningSummary?.warning ?? 0} cảnh báo</span><span data-error>{warningSummary?.error ?? 0} lỗi</span></div></div>
      <div className="word-import-stats"><span><strong>{preview.statistics.headings}</strong> tiêu đề</span><span><strong>{preview.statistics.paragraphs}</strong> đoạn</span><span><strong>{preview.statistics.lists}</strong> danh sách</span><span><strong>{preview.statistics.tables}</strong> bảng</span><span><strong>{preview.statistics.images}</strong> ảnh</span><span><strong>{preview.statistics.words}</strong> từ</span></div>
      {outline.length > 0 && <details open className="input-outline"><summary>Outline ({outline.length})</summary>{outline.slice(0, 80).map((item) => <div key={item.id} style={{ paddingLeft: `${item.depth * 14}px` }}><b>{item.type}</b><span>{item.label}</span></div>)}</details>}
      {preview.warnings.length > 0 && <div className="word-import-warnings">{preview.warnings.slice(0, 20).map((warning, index) => <p key={`${warning.code}-${index}`} data-severity={warning.severity}><strong>{warning.code}</strong>{warning.message}</p>)}</div>}
      <div className="input-action-row"><button className="btn btn-primary" disabled={busy || (warningSummary?.error ?? 0) > 0} onClick={() => void commit()}><Save/> {busy ? "Đang commit…" : "Commit vào H2OBOOK"}</button><button className="btn btn-secondary" onClick={() => { setPreview(null); setDesignPayload(null); }}>Quay lại cấu hình</button>{session?.commitResult?.openPath && <a className="btn btn-secondary" href={session.commitResult.openPath}>Mở editor</a>}</div>
    </section>}
  </div>;
}
