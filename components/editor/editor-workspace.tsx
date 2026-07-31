"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AlignCenter, AlignHorizontalJustifyCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter,
  ArrowDown, ArrowLeft, ArrowUp, Bold, BookOpen, Brain, Box, Check, ChevronDown, Circle, CirclePlus,
  Copy, Download, Eye, EyeOff, FileJson, FileText, Grid3X3, Image as ImageIcon, Import,
  FileCheck2, Italic, Layers3, LayoutTemplate, Link2, Lock, Maximize2, Minus, MoreHorizontal, Palette,
  PanelLeftClose, PanelRightClose, Plus, QrCode, Redo2, Save, Settings2, Shapes, Sparkles,
  Trash2, Type, Underline, Undo2, Unlock, Upload, WandSparkles, ZoomIn, ZoomOut
} from "lucide-react";
import { EditorCanvas } from "@/components/editor/editor-canvas";
import { NeuralHeaderSignal } from "@/components/global-neural";
import { useEditorStore } from "@/store/editor-store";
import { useAppStore } from "@/store/app-store";
import { uid } from "@/lib/utils";
import type { BrandProfile, H2OElement, H2OPage, PageType } from "@/types/editor";
import { legacyBookToDocument, type SemanticContentNode } from "@h2obook/content-core";
import { collectTextFlowFrames } from "@/lib/editor/text-flow";
import { importDocxToBookDocument, queueDocxFallback } from "@/lib/input/word-import";
import type { ImportDocument } from "@h2obook/input-core";
import { inspectPdf, reconstructPdfWithWorker, renderPdfFixedLayout, type PdfImportMode, type PdfInspection } from "@/lib/input/pdf-import";
import { inspectImage, type ImageInspection } from "@/lib/input/image-import";
import { ImageSmartImport } from "@/components/editor/image-smart-import";
import { localizeHtmlAssets, previewHtmlFile } from "@/lib/input/html-import";
import { EditorCreativeHandoffBridge } from "@/components/creative-publishing-v1";

const panels = [
  { id: "pages", label: "Trang", icon: Layers3 },
  { id: "templates", label: "Bố cục", icon: LayoutTemplate },
  { id: "text", label: "Văn bản", icon: Type },
  { id: "uploads", label: "Tải lên", icon: Upload },
  { id: "elements", label: "Thành phần", icon: Shapes },
  { id: "brand", label: "Brand", icon: Palette },
  { id: "layers", label: "Layers", icon: PanelLeftClose }
] as const;

type PanelId = typeof panels[number]["id"];

export function EditorWorkspace() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const store = useEditorStore();
  const app = useAppStore();
  const [panel, setPanel] = useState<PanelId>("pages");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [importStatus, setImportStatus] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const unifiedInputEnabled = process.env.NEXT_PUBLIC_UNIFIED_INPUT_ENABLED !== "false";
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const loadedBookId = useRef<string | null>(null);

  useEffect(() => {
    const openImageImport = () => {
      setPanel("uploads"); setLeftOpen(true);
      window.setTimeout(() => fileRef.current?.click(), 40);
    };
    window.addEventListener("h2obook:open-image-import", openImageImport);
    return () => window.removeEventListener("h2obook:open-image-import", openImageImport);
  }, []);

  useEffect(() => {
    const bookId = params.bookId;
    if (bookId && loadedBookId.current !== bookId) {
      store.loadBook(bookId);
      loadedBookId.current = bookId;
      if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
        const organizationId = useAppStore.getState().workspace.id;
        void fetch(`/api/books/cloud-load?clientKey=${encodeURIComponent(bookId)}&organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
          .then((response) => response.ok ? response.json() : null)
          .then((payload) => { if (payload?.book && loadedBookId.current === bookId) store.replaceBook(payload.book); })
          .catch((error) => console.error("[H2OBOOK cloud load]", error));
      }
    }
  }, [params.bookId, store]);

  const save = useCallback(() => {
    store.saveToLibrary();
    if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
      const organizationId = useAppStore.getState().workspace.id;
      const document = legacyBookToDocument(useEditorStore.getState().book);
      void fetch(`/api/books/${encodeURIComponent(document.bookId)}/document`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, document })
      }).catch((error) => console.error("[H2OBOOK semantic save]", error));
    }
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 1500);
  }, [store]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "s") { event.preventDefault(); save(); }
      if (typing) return;
      if (command && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? store.redo() : store.undo(); }
      if (command && event.key.toLowerCase() === "y") { event.preventDefault(); store.redo(); }
      if (command && event.key.toLowerCase() === "a") { event.preventDefault(); store.selectAll(); }
      if (command && event.key.toLowerCase() === "d") { event.preventDefault(); store.duplicateElement(); }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); store.deleteElement(); }
      if (event.key === "Escape") store.clearSelection();
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && store.selectedIds.length) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        const patch = event.key === "ArrowLeft" ? { x: -amount } : event.key === "ArrowRight" ? { x: amount } : event.key === "ArrowUp" ? { y: -amount } : { y: amount };
        const page = store.book.pages.find((item) => item.id === store.activePageId);
        page?.elements.filter((item) => store.selectedIds.includes(item.id)).forEach((item) => store.updateElement(item.id, { x: item.x + (patch.x ?? 0), y: item.y + (patch.y ?? 0) }, false));
        store.checkpoint();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, store]);

  const selected = useMemo(() => {
    const page = store.book.pages.find((item) => item.id === store.activePageId);
    return page?.elements.filter((item) => store.selectedIds.includes(item.id)) ?? [];
  }, [store.book.pages, store.activePageId, store.selectedIds]);

  const exportProject = () => {
    const payload = { format: "h2obook", version: 4.2, exportedAt: new Date().toISOString(), brand: store.brand, book: store.book, document: legacyBookToDocument(store.book) };
    downloadBlob(JSON.stringify(payload, null, 2), `${slug(store.book.title)}.h2obook.json`, "application/json");
  };

  const importProject = async (files: FileList | null) => {
    const file = files?.[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as { format?: string; version?: number; book?: typeof store.book; brand?: BrandProfile };
      if (payload.format !== "h2obook" || !payload.book?.pages) throw new Error("File dự án không hợp lệ.");
      store.replaceBook(payload.book);
      if (payload.brand) store.applyBrand(payload.brand);
      setImportStatus("Đã nhập dự án H2OBOOK thành công.");
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Không thể nhập dự án.");
    }
  };

  const publish = () => {
    store.saveToLibrary();
    app.publishBook(store.book.id);
    setImportStatus("Đã xuất bản phiên bản mới và cập nhật quyền đọc.");
  };

  return <main className="editor-shell">
    <EditorCreativeHandoffBridge/>
    <header className="editor-topbar">
      <div className="editor-top-left">
        <button className="editor-icon" title="Quay lại" onClick={() => router.push("/books")}><ArrowLeft size={17}/></button>
        <div className="editor-brand-mini"><strong>H2OBOOK</strong><span>Studio V4.3 Professional</span></div>
        <input className="editor-title-input" value={store.book.title} onChange={(event) => store.setBookTitle(event.target.value)} aria-label="Tên sách"/>
        <span className={`save-state ${store.dirty ? "saving" : "saved"}`}>{savedFeedback ? <><Check size={12}/>Đã lưu</> : store.dirty ? "Có thay đổi chưa lưu" : `Đã lưu ${new Date(store.savedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`}</span>
      </div>
      <div className="editor-top-center">
        <button className="editor-icon" onClick={store.undo} disabled={store.historyIndex < 0} title="Hoàn tác"><Undo2 size={16}/></button>
        <button className="editor-icon" onClick={store.redo} disabled={store.historyIndex >= store.history.length - 1} title="Làm lại"><Redo2 size={16}/></button>
        <span className="toolbar-separator"/>
        <button className={`editor-icon ${store.showGrid ? "active" : ""}`} onClick={() => store.setShowGrid(!store.showGrid)} title="Lưới"><Grid3X3 size={16}/></button>
        <button className={`editor-icon ${store.snapToGrid ? "active" : ""}`} onClick={() => store.setSnapToGrid(!store.snapToGrid)} title="Bắt vào lưới"><WandSparkles size={17}/></button>
        <button className="editor-icon" onClick={store.reflowAllText} title="Dàn lại toàn bộ Text Flow"><FileText size={17}/></button>
        <span className="toolbar-separator"/>
        <button className="editor-icon" onClick={() => store.setZoom(store.zoom - 0.08)}><ZoomOut size={16}/></button>
        <span className="zoom-value">{Math.round(store.zoom * 100)}%</span>
        <button className="editor-icon" onClick={() => store.setZoom(store.zoom + 0.08)}><ZoomIn size={16}/></button>
      </div>
      <div className="editor-top-right">
        <NeuralHeaderSignal compact/>
        <button className="btn btn-secondary btn-sm" onClick={() => window.dispatchEvent(new Event("h2obook:export-page"))}><Download size={14}/>PNG</button>
        <button className="btn btn-secondary btn-sm" onClick={exportProject}><FileJson size={14}/>Dự án</button>
        <button className="btn btn-secondary btn-sm" onClick={() => projectRef.current?.click()}><Import size={14}/>Nhập</button>
        <input ref={projectRef} hidden type="file" accept=".json,.h2obook.json" onChange={(event) => importProject(event.target.files)}/>
        <Link className="btn btn-secondary btn-sm" href={`/editor/${store.book.id}/compose`} onClick={save}><FileText size={14}/>Biên soạn</Link>
        <Link className="btn btn-secondary btn-sm" href={`/preflight?book=${store.book.id}`} onClick={save}><Check size={14}/>Preflight</Link>
        <Link className="btn btn-secondary btn-sm" href={`/ai-studio?book=${store.book.id}`} onClick={save}><Brain size={14}/>Smart tools</Link>
        <Link className="btn btn-secondary btn-sm" href="/reviews" onClick={save}><FileCheck2 size={14}/>Duyệt</Link>
        <Link className="btn btn-secondary btn-sm" href={`/reader/${store.book.id}`} onClick={save}><BookOpen size={14}/>Xem trước</Link>
        <button className="btn btn-secondary btn-sm" onClick={save}><Save size={14}/>{savedFeedback ? "Đã lưu" : "Lưu"}</button>
        <Link className="btn btn-primary btn-sm" href={`/publish?book=${store.book.id}`} onClick={save}><Sparkles size={14}/>Xuất bản Pro</Link>
      </div>
    </header>

    <div className="editor-main">
      <nav className="editor-rail">
        {panels.map(({ id, label, icon: Icon }) => <button key={id} className={`rail-item ${panel === id && leftOpen ? "active" : ""}`} onClick={() => { setPanel(id); setLeftOpen(true); }}><Icon size={19}/><span>{label}</span></button>)}
        <div className="rail-spacer"/>
        <button className="rail-item" onClick={() => setLeftOpen(!leftOpen)}>{leftOpen ? <PanelLeftClose size={19}/> : <Maximize2 size={19}/>}<span>{leftOpen ? "Thu gọn" : "Mở panel"}</span></button>
      </nav>

      {leftOpen && <aside className="editor-left-panel">
        <div className="panel-heading"><div><strong>{panelTitle(panel)}</strong><span>{panelDescription(panel)}</span></div><button className="editor-icon" onClick={() => setLeftOpen(false)}><PanelLeftClose size={15}/></button></div>
        <div className="panel-scroll">
          {panel === "pages" && <PagesPanel/>}
          {panel === "templates" && <TemplatePanel/>}
          {panel === "text" && <TextPanel/>}
          {panel === "uploads" && <UploadPanel fileRef={fileRef} status={importStatus} setStatus={setImportStatus}/>} 
          {panel === "elements" && <ElementsPanel/>}
          {panel === "brand" && <BrandPanel/>}
          {panel === "layers" && <LayersPanel/>}
        </div>
      </aside>}

      <section className="editor-stage-area">
        {selected.length > 0 && <FloatingSelectionToolbar selected={selected}/>} 
        <div className="canvas-scroller"><EditorCanvas/></div>
        <div className="editor-statusbar">
          <span>{store.book.pages.length} trang</span><span>{selected.length ? `${selected.length} thành phần được chọn` : "Không có thành phần được chọn"}</span><span>Khổ {store.book.pageSize ?? "A4"} • {store.snapToGrid ? "Snap bật" : "Snap tắt"}</span>
        </div>
      </section>

      {rightOpen ? <aside className="editor-right-panel">
        <div className="panel-heading"><div><strong>Thuộc tính</strong><span>{selected.length > 1 ? `${selected.length} lớp đang chọn` : selected[0]?.name ?? "Trang hiện tại"}</span></div><button className="editor-icon" onClick={() => setRightOpen(false)}><PanelRightClose size={15}/></button></div>
        <div className="panel-scroll">{selected.length ? <PropertiesPanel elements={selected}/> : <PageProperties/>}</div>
      </aside> : <button className="open-right-panel" onClick={() => setRightOpen(true)}><Settings2 size={17}/></button>}
    </div>
  </main>;
}

function panelTitle(panel: PanelId) {
  return ({ pages: "Quản lý trang", templates: "Bố cục trang", text: "Thêm văn bản", uploads: "Nhập tài liệu", elements: "Thành phần", brand: "Smart Brand", layers: "Danh sách lớp" } as Record<PanelId, string>)[panel];
}
function panelDescription(panel: PanelId) {
  return ({ pages: "Sắp xếp và quản lý cấu trúc sách", templates: "Áp dụng bố cục cho trang hiện tại", text: "Tiêu đề, nội dung và trích dẫn", uploads: "PDF, Word, ảnh và dự án", elements: "Khối, đường, QR và hình ảnh", brand: "Auto-fill theo nhận diện thương hiệu", layers: "Khóa, ẩn và sắp xếp lớp" } as Record<PanelId, string>)[panel];
}

function PagesPanel() {
  const store = useEditorStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const pageTypes: { type: PageType; label: string }[] = [
    { type: "blank", label: "Trang trắng" }, { type: "cover", label: "Bìa sách" }, { type: "chapter", label: "Mở chương" },
    { type: "content", label: "Nội dung" }, { type: "checklist", label: "Checklist" }, { type: "gallery", label: "Hình ảnh" }
  ];
  return <>
    <div className="split-button"><button className="btn btn-primary btn-sm" onClick={() => store.addPage("blank")}><Plus size={14}/>Thêm trang</button><button className="btn btn-primary btn-sm split-caret" onClick={() => setMenuOpen(!menuOpen)}><ChevronDown size={14}/></button></div>
    {menuOpen && <div className="dropdown-menu page-type-menu">{pageTypes.map((item) => <button key={item.type} onClick={() => { store.addPage(item.type); setMenuOpen(false); }}>{item.label}</button>)}</div>}
    <div className="pages-list">{store.book.pages.map((page, index) => <article className={`page-thumb-v2 ${page.id === store.activePageId ? "active" : ""}`} key={page.id} onClick={() => store.setActivePage(page.id)}>
      <div className="page-index">{index + 1}</div>
      <div className="page-mini-canvas" style={{ background: page.background }}><span>{page.pageType ?? "page"}</span></div>
      <div className="page-thumb-info"><input value={page.name} onClick={(event) => event.stopPropagation()} onChange={(event) => store.renamePage(page.id, event.target.value)}/><small>{page.elements.length} lớp</small></div>
      <div className="thumb-actions-v2"><button onClick={(event) => { event.stopPropagation(); store.reorderPage(page.id, "up"); }}><ArrowUp size={11}/></button><button onClick={(event) => { event.stopPropagation(); store.reorderPage(page.id, "down"); }}><ArrowDown size={11}/></button><button onClick={(event) => { event.stopPropagation(); store.duplicatePage(page.id); }}><Copy size={11}/></button><button onClick={(event) => { event.stopPropagation(); store.deletePage(page.id); }}><Trash2 size={11}/></button></div>
    </article>)}</div>
  </>;
}

function TextPanel() {
  const store = useEditorStore();
  const items = [
    { preset: "heading" as const, label: "Tiêu đề lớn", sample: "Tiêu đề bài học", className: "text-preset-heading" },
    { preset: "subheading" as const, label: "Tiêu đề phụ", sample: "Nội dung quan trọng", className: "text-preset-sub" },
    { preset: "body" as const, label: "Đoạn văn", sample: "Nội dung đào tạo và hướng dẫn chi tiết...", className: "text-preset-body" },
    { preset: "quote" as const, label: "Trích dẫn", sample: "“Thông điệp cần ghi nhớ”", className: "text-preset-quote" },
    { preset: "caption" as const, label: "Chú thích", sample: "Chú thích hình ảnh", className: "text-preset-caption" }
  ];
  return <div className="preset-list"><button className="btn btn-primary" onClick={() => store.addText("body")}><Type size={16}/>Thêm hộp văn bản</button>{items.map((item) => <button className={`text-preset ${item.className}`} key={item.preset} onClick={() => store.addText(item.preset)}><small>{item.label}</small><span>{item.sample}</span></button>)}</div>;
}

function ElementsPanel() {
  const store = useEditorStore();
  return <>
    <div className="element-grid">
      <button className="element-button" onClick={() => store.addShape("rectangle")}><Box size={25}/><span>Chữ nhật</span></button>
      <button className="element-button" onClick={() => store.addShape("pill")}><Minus size={25}/><span>Nhãn bo tròn</span></button>
      <button className="element-button" onClick={() => store.addShape("circle")}><Circle size={25}/><span>Hình tròn</span></button>
      <button className="element-button" onClick={() => store.addShape("callout")}><CirclePlus size={25}/><span>Khung ghi nhớ</span></button>
      <button className="element-button" onClick={store.addLine}><Minus size={25}/><span>Đường kẻ</span></button>
      <button className="element-button" onClick={() => store.addQr()}><QrCode size={25}/><span>QR Code</span></button>
      <button className="element-button" onClick={() => window.dispatchEvent(new Event("h2obook:open-image-import"))}><ImageIcon size={25}/><span>Hình ảnh</span></button>
      <button className="element-button" onClick={() => store.addText("caption")}><Link2 size={25}/><span>Smart Field</span></button>
    </div>
  </>;
}

function TemplatePanel() {
  const store = useEditorStore();
  const templates: { type: PageType; name: string; description: string; background: string }[] = [
    { type: "cover", name: "Bìa giáo trình", description: "Tên sách, thương hiệu và tác giả", background: "linear-gradient(135deg,#6f1d46,#b45f83)" },
    { type: "chapter", name: "Mở chương", description: "Chuyển đoạn mạnh, tập trung tiêu đề", background: "linear-gradient(135deg,#f1e5ea,#d9b6c6)" },
    { type: "content", name: "Bài học", description: "Tiêu đề, nhãn chương và nội dung", background: "#fffaf7" },
    { type: "checklist", name: "Checklist", description: "Danh sách thao tác và ghi chú", background: "#f4ece7" },
    { type: "gallery", name: "Hình ảnh", description: "Hai ảnh minh họa và mô tả", background: "#edf2f0" },
    { type: "blank", name: "Trang trắng", description: "Tự do sáng tạo từ đầu", background: "#ffffff" }
  ];
  return <div className="layout-grid">{templates.map((template) => <button className="layout-card" key={template.type} onClick={() => store.applyPageTemplate(template.type)}><div className="layout-preview" style={{ background: template.background }}/><strong>{template.name}</strong><span>{template.description}</span></button>)}</div>;
}

function UploadPanel({ fileRef, status, setStatus }: { fileRef: RefObject<HTMLInputElement | null>; status: string; setStatus: (value: string) => void }) {
  const store = useEditorStore();
  const router = useRouter();
  const unifiedInputEnabled = process.env.NEXT_PUBLIC_UNIFIED_INPUT_ENABLED !== "false";
  const [wordPreview, setWordPreview] = useState<ImportDocument | null>(null);
  const [pdfSource, setPdfSource] = useState<{ file: File; inspection: PdfInspection } | null>(null);
  const [pdfMode, setPdfMode] = useState<PdfImportMode>("fixed_layout");
  const [pdfResult, setPdfResult] = useState<ImportDocument | null>(null);
  const [imageSource, setImageSource] = useState<ImageInspection | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<ImportDocument | null>(null);
  const [committing, setCommitting] = useState(false);
  const [processingHtml, setProcessingHtml] = useState(false);
  const [processingPdf, setProcessingPdf] = useState(false);
  const pdfEditableNodes = pdfResult ? flattenTextNodes(pdfResult.document.root).slice(0, 32) : [];

  const updatePdfNode = (nodeId: string, value: string) => {
    setPdfResult((current) => {
      if (!current) return current;
      const root = replaceNodeText(current.document.root, nodeId, value);
      return { ...current, document: { ...current.document, root, updatedAt: new Date().toISOString() }, nodes: root };
    });
  };

  const commitSemantic = async (preview: ImportDocument, label: string) => {
    setCommitting(true);
    try {
      const document = { ...preview.document, bookId: store.book.id, title: preview.title, updatedAt: new Date().toISOString() };
      localStorage.setItem(`h2obook-semantic-${store.book.id}`, JSON.stringify(document));
      store.setBookTitle(preview.title);
      if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
        const response = await fetch(`/api/books/${encodeURIComponent(store.book.id)}/document`, {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId: useAppStore.getState().workspace.id, document }),
        });
        if (!response.ok) throw new Error(`Không thể lưu ${label} lên cloud; bản local vẫn được giữ.`);
      }
      setStatus(`Đã nhập ${preview.statistics.nodes} khối ${label} vào Compose Engine.`);
      setWordPreview(null); setPdfResult(null); setPdfSource(null); setImageSource(null); setHtmlPreview(null);
      router.push(`/editor/${store.book.id}/compose`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Không thể nhập ${label}.`);
    } finally { setCommitting(false); }
  };

  const commitHtml = async () => {
    if (!htmlPreview) return;
    setProcessingHtml(true);
    try {
      const localized = await localizeHtmlAssets(htmlPreview, {
        organizationId: useAppStore.getState().workspace.id,
        progress: (done, total) => setStatus(`Đang lưu ảnh HTML ${done}/${total}...`),
      });
      await commitSemantic(localized, "HTML");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể nhập HTML.");
    } finally { setProcessingHtml(false); }
  };

  const processPdf = async () => {
    if (!pdfSource || pdfMode === "fixed_layout") return;
    setProcessingPdf(true); setPdfResult(null);
    try {
      const result = await reconstructPdfWithWorker(pdfSource.file, {
        bookId: store.book.id,
        organizationId: useAppStore.getState().workspace.id,
        title: pdfSource.inspection.title,
        mode: pdfMode,
        onProgress: (jobStatus, progress) => setStatus(`${pdfMode === "ocr" ? "OCR" : "Tái tạo PDF"}: ${jobStatus} ${Math.round(progress)}%`),
      });
      setPdfResult(result);
      setStatus(`Preview PDF sẵn sàng: ${result.statistics.headings} tiêu đề, ${result.statistics.paragraphs} đoạn, ${result.statistics.tables} bảng, ${result.statistics.images} ảnh.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể xử lý PDF.");
    } finally { setProcessingPdf(false); }
  };

  const commitFixedPdf = async () => {
    if (!pdfSource) return;
    setCommitting(true);
    try {
      const pages = await renderPdfFixedLayout(pdfSource.file, {
        organizationId: useAppStore.getState().workspace.id,
        progress: (current, total) => setStatus(`Đang dựng trang PDF ${current}/${total}: ${pdfSource.file.name}`),
      });
      pages.forEach(store.addImportedPage);
      setStatus(`Đã nhập ${pages.length} trang PDF theo chế độ giữ nguyên thiết kế.`);
      setPdfSource(null); setPdfResult(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể nhập PDF fixed-layout.");
    } finally { setCommitting(false); }
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    for (let index = 0; index < list.length; index += 1) {
      const file = list[index];
      setStatus(`Đang phân tích ${index + 1}/${list.length}: ${file.name}`);
      try {
        if (file.type.startsWith("image/") || /\.(?:png|jpe?g)$/i.test(file.name)) {
          const inspection = await inspectImage(file);
          setImageSource(inspection);
          setStatus(`Ảnh ${inspection.metadata.pixelWidth}×${inspection.metadata.pixelHeight}px đã sẵn sàng. Chọn chế độ nhập trước khi commit.`);
          return;
        }
        else if (file.name.toLowerCase().endsWith(".pdf")) {
          const inspection = await inspectPdf(file);
          setPdfSource({ file, inspection }); setPdfMode(inspection.recommendedMode); setPdfResult(null);
          setStatus(`PDF có ${inspection.pageCount} trang; ${inspection.nativeTextPages} trang có text layer, ${inspection.scannedPages} trang có thể cần OCR.`);
          return;
        } else if (file.name.toLowerCase().endsWith(".docx")) {
          try {
            const preview = await importDocxToBookDocument(file, { bookId: store.book.id, organizationId: useAppStore.getState().workspace.id });
            setWordPreview(preview);
            setStatus(`Đã dựng preview Word: ${preview.statistics.headings} tiêu đề, ${preview.statistics.paragraphs} đoạn, ${preview.statistics.tables} bảng, ${preview.statistics.images} ảnh.`);
          } catch (clientError) {
            if (process.env.NEXT_PUBLIC_APP_MODE !== "production") throw clientError;
            const job = await queueDocxFallback(file, { bookId: store.book.id, organizationId: useAppStore.getState().workspace.id });
            setStatus(`Mammoth không đọc được file. Đã chuyển sang python-docx fallback${job?.id ? ` — Job ${job.id}` : ""}.`);
          }
          return;
        } else if (/\.(?:x?html?|htm)$/i.test(file.name)) {
          const preview = await previewHtmlFile(file, { bookId: store.book.id, organizationId: useAppStore.getState().workspace.id });
          setHtmlPreview(preview);
          setStatus(`Đã dựng preview HTML: ${preview.statistics.headings} tiêu đề, ${preview.statistics.paragraphs} đoạn, ${preview.statistics.tables} bảng, ${preview.statistics.images} ảnh.`);
          return;
        } else if (file.name.toLowerCase().endsWith(".txt")) store.importTextDocument(file.name.replace(/\.txt$/i, ""), await file.text());
        else throw new Error("Định dạng chưa được hỗ trợ.");
      } catch (error) {
        setStatus(`Lỗi ${file.name}: ${error instanceof Error ? error.message : "Không xác định"}`);
        return;
      }
    }
    setStatus(`Hoàn tất nhập ${list.length} tệp. Hãy kiểm tra các trang vừa tạo.`);
  };
  return <>
    {unifiedInputEnabled && <button className="upload-zone upload-zone-large unified-input-launch" onClick={() => router.push(`/input?bookId=${encodeURIComponent(store.book.id)}`)}><Upload size={31}/><strong>Mở Unified Input Gateway</strong><span>DOCX, PDF, Image, HTML, Markdown, TXT và URL trong một luồng duy nhất</span><small>Có session, preview, retry, recovery và atomic commit. Đây là luồng nhập mặc định từ 4.13.7.</small></button>}
    <details className="legacy-import-details" open={!unifiedInputEnabled}><summary>{unifiedInputEnabled ? "Luồng nhập nhanh cũ — chỉ dùng khi cần tương thích" : "Unified Input đang tắt bằng feature flag — dùng luồng legacy"}</summary><label className="upload-zone upload-zone-large"><Upload size={31}/><strong>Nhập nhanh legacy</strong><span>PDF, DOCX, PNG, JPG/JPEG/JPE, HTML/HTM hoặc TXT</span><small>Luồng này sẽ được gỡ sau khi pilot Unified Input đạt parity.</small><input ref={fileRef} type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.jpe,.png,.html,.htm,.xhtml,.md,.markdown,.txt" onChange={(event) => importFiles(event.target.files)}/></label></details>
    {status && <div className="import-status"><Sparkles size={15}/><span>{status}</span></div>}
    {imageSource && <ImageSmartImport inspection={imageSource} onCancel={() => setImageSource(null)} onStatus={setStatus} onCommitSemantic={commitSemantic}/>}
    {wordPreview && <section className="word-import-preview" aria-label="Xem trước Word Import 2.0">
      <div className="word-import-preview-head"><div><span className="eyebrow">WORD IMPORT 2.0</span><strong>{wordPreview.title}</strong><small>{wordPreview.sourceFileName}</small></div><FileCheck2 size={24}/></div>
      <div className="word-import-stats">
        <span><strong>{wordPreview.statistics.headings}</strong> tiêu đề</span><span><strong>{wordPreview.statistics.paragraphs}</strong> đoạn</span>
        <span><strong>{wordPreview.statistics.lists}</strong> danh sách</span><span><strong>{wordPreview.statistics.tables}</strong> bảng</span>
        <span><strong>{wordPreview.statistics.images}</strong> ảnh</span><span><strong>{wordPreview.statistics.words}</strong> từ</span>
      </div>
      {wordPreview.warnings.length > 0 && <div className="word-import-warnings">{wordPreview.warnings.slice(0, 6).map((warning, index) => <p key={`${warning.code}-${index}`} data-severity={warning.severity}><strong>{warning.code}</strong>{warning.message}</p>)}</div>}
      <div className="word-import-preview-actions"><button className="btn btn-secondary" onClick={() => setWordPreview(null)}>Hủy preview</button><button className="btn btn-primary" disabled={committing || wordPreview.warnings.some((warning) => warning.severity === "error")} onClick={() => commitSemantic(wordPreview, "Word")}>{committing ? "Đang nhập…" : "Nhập vào Compose"}</button></div>
    </section>}
    {htmlPreview && <section className="word-import-preview html-import-preview" aria-label="HTML Import 2.0">
      <div className="word-import-preview-head"><div><span className="eyebrow">HTML IMPORT 2.0</span><strong>{htmlPreview.title}</strong><small>{htmlPreview.sourceFileName}</small></div><FileCheck2 size={24}/></div>
      <div className="word-import-stats">
        <span><strong>{htmlPreview.statistics.headings}</strong> tiêu đề</span><span><strong>{htmlPreview.statistics.paragraphs}</strong> đoạn</span>
        <span><strong>{htmlPreview.statistics.lists}</strong> danh sách</span><span><strong>{htmlPreview.statistics.tables}</strong> bảng</span>
        <span><strong>{htmlPreview.statistics.images}</strong> ảnh</span><span><strong>{htmlPreview.statistics.words}</strong> từ</span>
      </div>
      <div className="html-import-safety">
        <span>Parser: {String(htmlPreview.metadata.parser ?? "jsdom-dom-2.0")}</span>
        <span>Đã chặn URL: {String((htmlPreview.metadata.sanitization as { blockedUrls?: number } | undefined)?.blockedUrls ?? 0)}</span>
        <span>Ảnh cần lưu cục bộ: {String((htmlPreview.metadata.remoteAssetUrls as string[] | undefined)?.length ?? 0)}</span>
      </div>
      {htmlPreview.warnings.length > 0 && <div className="word-import-warnings">{htmlPreview.warnings.slice(0, 10).map((warning, index) => <p key={`${warning.code}-${index}`} data-severity={warning.severity}><strong>{warning.code}</strong>{warning.message}</p>)}</div>}
      <details className="html-preview-document"><summary>Xem HTML đã làm sạch</summary><iframe sandbox="" title="HTML đã làm sạch" srcDoc={htmlPreview.previewHtml ?? ""}/></details>
      <div className="word-import-preview-actions"><button className="btn btn-secondary" onClick={() => setHtmlPreview(null)}>Hủy HTML</button><button className="btn btn-primary" disabled={committing || processingHtml || htmlPreview.warnings.some((warning) => warning.severity === "error")} onClick={commitHtml}>{processingHtml ? "Đang lưu ảnh…" : committing ? "Đang nhập…" : "Lưu ảnh & nhập Compose"}</button></div>
    </section>}
    {pdfSource && <section className="pdf-import-preview" aria-label="PDF Dual Import">
      <div className="word-import-preview-head"><div><span className="eyebrow">PDF DUAL IMPORT</span><strong>{pdfSource.inspection.title}</strong><small>{pdfSource.file.name}</small></div><FileCheck2 size={24}/></div>
      <div className="pdf-inspection-summary">
        <span><strong>{pdfSource.inspection.pageCount}</strong> trang</span><span><strong>{pdfSource.inspection.nativeTextPages}</strong> có text layer</span><span><strong>{pdfSource.inspection.scannedPages}</strong> cần kiểm tra OCR</span><span><strong>{pdfSource.inspection.totalCharacters}</strong> ký tự</span>
      </div>
      <div className="pdf-thumbnail-strip">{pdfSource.inspection.pages.filter((page) => page.thumbnail).map((page) => <figure key={page.page}><img src={page.thumbnail} alt={`Preview trang ${page.page}`}/><figcaption>Trang {page.page}{page.likelyScanned ? " • Scan" : " • Text"}</figcaption></figure>)}</div>
      <div className="pdf-mode-grid">
        <button data-active={pdfMode === "fixed_layout"} onClick={() => { setPdfMode("fixed_layout"); setPdfResult(null); }}><Eye size={19}/><strong>Giữ nguyên thiết kế</strong><small>Render từng trang thành background khóa; phù hợp khi cần giữ nguyên bản gốc.</small></button>
        <button data-active={pdfMode === "editable_content"} onClick={() => { setPdfMode("editable_content"); setPdfResult(null); }}><Type size={19}/><strong>Nội dung chỉnh sửa</strong><small>Đọc text layer, font spans, vị trí, reading order, bảng và ảnh thành BookDocument.</small></button>
        <button data-active={pdfMode === "ocr"} onClick={() => { setPdfMode("ocr"); setPdfResult(null); }}><FileText size={19}/><strong>OCR PDF scan</strong><small>Tesseract vie+eng tạo block có bounding box và confidence; không dùng AI API.</small></button>
      </div>
      {pdfSource.inspection.warnings.length > 0 && <div className="word-import-warnings">{pdfSource.inspection.warnings.map((warning, index) => <p key={`${warning.code}-${index}`} data-severity={warning.severity}><strong>{warning.code}</strong>{warning.message}</p>)}</div>}
      {pdfMode !== "fixed_layout" && !pdfResult && <div className="pdf-process-callout"><p>{pdfMode === "ocr" ? "OCR chạy bằng Tesseract worker trong Production Mode và trả về từng vùng chữ để kiểm tra." : "H2OBOOK ưu tiên text layer; Production Mode dùng PyMuPDF để lấy thêm ảnh, bảng và bounding box."}</p><button className="btn btn-secondary" disabled={processingPdf} onClick={processPdf}>{processingPdf ? "Đang xử lý…" : "Tạo preview nội dung"}</button></div>}
      {pdfResult && <div className="pdf-semantic-result"><div className="word-import-stats"><span><strong>{pdfResult.statistics.headings}</strong> tiêu đề</span><span><strong>{pdfResult.statistics.paragraphs}</strong> đoạn</span><span><strong>{pdfResult.statistics.tables}</strong> bảng</span><span><strong>{pdfResult.statistics.images}</strong> ảnh</span><span><strong>{pdfResult.statistics.words}</strong> từ</span><span><strong>{pdfResult.document.root.length}</strong> trang semantic</span></div>{pdfResult.warnings.length > 0 && <div className="word-import-warnings">{pdfResult.warnings.slice(0, 8).map((warning, index) => <p key={`${warning.code}-${index}`} data-severity={warning.severity}><strong>{warning.code}</strong>{warning.message}</p>)}</div>}<details className="pdf-correction-panel"><summary>Kiểm tra và sửa nội dung nhận dạng ({pdfEditableNodes.length} khối đầu)</summary><p>Hãy sửa các lỗi OCR hoặc reading order trước khi nhập. Tọa độ và confidence được giữ trong metadata của từng khối.</p><div className="pdf-correction-list">{pdfEditableNodes.map((item) => <label key={item.id}><span>Trang {String(item.attrs.page ?? "-")} • {item.type}{typeof item.attrs.ocrConfidence === "number" ? ` • ${Math.round(item.attrs.ocrConfidence)}%` : ""}</span><textarea value={item.text?.map((span) => span.text).join("") ?? ""} onChange={(event) => updatePdfNode(item.id, event.target.value)}/></label>)}</div></details></div>}
      <div className="word-import-preview-actions"><button className="btn btn-secondary" onClick={() => { setPdfSource(null); setPdfResult(null); }}>Hủy PDF</button>{pdfMode === "fixed_layout" ? <button className="btn btn-primary" disabled={committing} onClick={commitFixedPdf}>{committing ? "Đang nhập…" : "Nhập trang giữ nguyên"}</button> : <button className="btn btn-primary" disabled={!pdfResult || committing || pdfResult.warnings.some((warning) => warning.severity === "error")} onClick={() => pdfResult && commitSemantic(pdfResult, pdfMode === "ocr" ? "PDF OCR" : "PDF")}>{committing ? "Đang nhập…" : "Nhập vào Compose"}</button>}</div>
    </section>}
    <div className="import-mode-list">
      <div><FileText size={18}/><span><strong>PDF Dual Import</strong><small>Giữ nguyên thiết kế, tái tạo nội dung hoặc OCR scan.</small></span></div>
      <div><Type size={18}/><span><strong>Word Import 2.0</strong><small>DOCX thành BookDocument, có preview trước khi mở Compose.</small></span></div>
      <div><ImageIcon size={18}/><span><strong>Image Smart Import</strong><small>Asset, toàn trang, OCR Tesseract hoặc tách vùng thủ công.</small></span></div>
      <div><FileText size={18}/><span><strong>HTML Import 2.0</strong><small>DOM parser server-side, sanitization, bảng, link, nested list và ảnh được localize.</small></span></div>
    </div>
  </>;
}

function BrandPanel() {
  const store = useEditorStore();
  const app = useAppStore();
  return <>
    <div className="brand-switcher"><label>Brand Profile đang dùng</label><select value={store.brand.id} onChange={(event) => { const brand = app.brands.find((item) => item.id === event.target.value); if (brand) store.applyBrand(brand); }}>{app.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div>
    <div className="brand-preview-mini" style={{ background: `linear-gradient(135deg,${store.brand.primaryColor},${store.brand.accentColor})` }}>{store.brand.logoUrl ? <img src={store.brand.logoUrl} alt="Logo"/> : <div className="brand-placeholder">H2O</div>}<small>{store.brand.name}</small><strong>{store.brand.expertName}</strong><span>{store.brand.website}</span></div>
    <div className="smart-field-list"><strong>Smart Fields có sẵn</strong>{["brand.name", "brand.logo", "brand.primary_color", "brand.website", "brand.phone", "expert.name", "expert.title", "expert.avatar"].map((field) => <button key={field} onClick={() => { store.addText("caption"); const selectedId = useEditorStore.getState().selectedIds[0]; if (selectedId) store.updateElement(selectedId, { text: `{{${field}}}`, bindingKey: field }); }}><code>{`{{${field}}}`}</code><Plus size={12}/></button>)}</div>
    <Link href="/brand-kit" className="btn btn-secondary"><Palette size={15}/>Quản lý Brand Kit</Link>
  </>;
}

function LayersPanel() {
  const store = useEditorStore();
  const page = store.book.pages.find((item) => item.id === store.activePageId);
  return <div className="layer-list-v2">{[...(page?.elements ?? [])].reverse().map((element) => <div className={`layer-row-v2 ${store.selectedIds.includes(element.id) ? "active" : ""}`} key={element.id} onClick={(event) => store.setSelected(element.id, event.shiftKey)}>
    <span className="layer-type-icon">{element.type === "text" ? <Type size={13}/> : element.type === "image" ? <ImageIcon size={13}/> : element.type === "qr" ? <QrCode size={13}/> : <Box size={13}/>}</span>
    <span className="layer-name-v2"><strong>{element.name}</strong><small>{element.type}{element.bindingKey ? ` • ${element.bindingKey}` : ""}</small></span>
    <button title={element.hidden ? "Hiện" : "Ẩn"} onClick={(event) => { event.stopPropagation(); store.toggleVisibility(element.id); }}>{element.hidden ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
    <button title={element.locked ? "Mở khóa" : "Khóa"} onClick={(event) => { event.stopPropagation(); store.toggleLock(element.id); }}>{element.locked ? <Lock size={13}/> : <Unlock size={13}/>}</button>
  </div>)}</div>;
}

function FloatingSelectionToolbar({ selected }: { selected: H2OElement[] }) {
  const store = useEditorStore();
  const allText = selected.length > 1 && selected.every((element) => element.type === "text");
  return <div className="floating-selection-toolbar">
    <button onClick={() => store.alignSelected("left")} title="Căn trái"><AlignLeft size={17}/></button>
    <button onClick={() => store.alignSelected("center")} title="Căn giữa ngang"><AlignHorizontalJustifyCenter size={17}/></button>
    <button onClick={() => store.alignSelected("right")} title="Căn phải"><AlignRight size={17}/></button>
    <span/>
    <button onClick={() => store.alignSelected("top")} title="Căn trên"><ArrowUp size={17}/></button>
    <button onClick={() => store.alignSelected("middle")} title="Căn giữa dọc"><AlignVerticalJustifyCenter size={17}/></button>
    <button onClick={() => store.alignSelected("bottom")} title="Căn dưới"><ArrowDown size={17}/></button>
    {allText && <><span/><button className="flow-link-action" onClick={store.linkSelectedTextFrames} title="Nối các khung thành một luồng văn bản"><Link2 size={17}/></button></>}
    <span/>
    <button onClick={store.duplicateElement} title="Nhân bản"><Copy size={17}/></button>
    <button onClick={store.deleteElement} title="Xóa"><Trash2 size={17}/></button>
    <small>{selected.length} lớp</small>
  </div>;
}

function PageProperties() {
  const store = useEditorStore();
  const page = store.book.pages.find((item) => item.id === store.activePageId);
  if (!page) return null;
  return <>
    <PropertySection title="Trang hiện tại">
      <label className="property-field">Tên trang<input value={page.name} onChange={(event) => store.renamePage(page.id, event.target.value)}/></label>
      <label className="property-field">Loại trang<select value={page.pageType ?? "blank"} onChange={(event) => store.applyPageTemplate(event.target.value as PageType)}><option value="blank">Trang trắng</option><option value="cover">Bìa</option><option value="chapter">Mở chương</option><option value="content">Nội dung</option><option value="checklist">Checklist</option><option value="gallery">Hình ảnh</option></select></label>
      <label className="property-field">Màu nền<div className="color-control"><input type="color" value={safeColor(page.background)} onChange={(event) => store.setPageBackground(event.target.value)}/><input value={page.background} onChange={(event) => store.setPageBackground(event.target.value)}/></div></label>
    </PropertySection>
    <PropertySection title="Kích thước"><div className="property-grid"><label className="property-field">Rộng<input value={page.width} disabled/></label><label className="property-field">Cao<input value={page.height} disabled/></label></div><p className="property-note">Khổ A4 dọc chuẩn 794 × 1123 px. Bleed và vùng an toàn sẽ được bổ sung khi xuất file in.</p></PropertySection>
    <PropertySection title="Ghi chú giảng viên"><textarea className="textarea" placeholder="Ghi chú riêng cho giảng viên khi trình chiếu..." value={page.notes ?? ""} onChange={(event) => { const value = event.target.value; useEditorStore.setState((state) => ({ book: { ...state.book, pages: state.book.pages.map((item) => item.id === page.id ? { ...item, notes: value } : item) }, dirty: true })); }}/></PropertySection>
  </>;
}

function PropertiesPanel({ elements }: { elements: H2OElement[] }) {
  const store = useEditorStore();
  const element = elements[0];
  const multiple = elements.length > 1;
  const patch = (value: Partial<H2OElement>, record = true) => multiple ? store.updateSelected(value, record) : store.updateElement(element.id, value, record);
  const allText = elements.every((item) => item.type === "text");
  const flowFrames = element.flowChainId ? collectTextFlowFrames(store.book, element.flowChainId) : [];
  const flowSource = flowFrames[0]?.element.flowSourceText ?? flowFrames.map((frame) => frame.element.text ?? "").join("\n\n");
  const frameNumber = flowFrames.findIndex((frame) => frame.id === element.id) + 1;
  return <>
    <PropertySection title="Vị trí & kích thước">
      <div className="property-grid">{(["x", "y", "width", "height"] as const).map((key) => <label className="property-field" key={key}>{({ x: "X", y: "Y", width: "Rộng", height: "Cao" })[key]}<input type="number" value={Math.round(element[key])} disabled={multiple} onChange={(event) => patch({ [key]: Number(event.target.value) }, false)} onBlur={store.checkpoint}/></label>)}</div>
      <div className="alignment-buttons"><button onClick={() => store.alignSelected("left")}><AlignLeft size={14}/></button><button onClick={() => store.alignSelected("center")}><AlignHorizontalJustifyCenter size={14}/></button><button onClick={() => store.alignSelected("right")}><AlignRight size={14}/></button><button onClick={() => store.alignSelected("top")}><ArrowUp size={14}/></button><button onClick={() => store.alignSelected("middle")}><AlignVerticalJustifyCenter size={14}/></button><button onClick={() => store.alignSelected("bottom")}><ArrowDown size={14}/></button></div>
    </PropertySection>

    {allText && <PropertySection title="Text Flow Engine">
      {multiple ? <>
        <p className="property-note">Chọn từ hai khung chữ theo đúng thứ tự đọc, sau đó nối thành một chuỗi tự chảy.</p>
        <button className="btn btn-primary full-button" onClick={store.linkSelectedTextFrames}><Link2 size={15}/>Nối {elements.length} khung văn bản</button>
      </> : element.flowChainId ? <>
        <div className={`flow-status-card ${element.flowOverflow ? "overflow" : "ready"}`}><div><strong>Khung {frameNumber}/{flowFrames.length}</strong><span>{element.flowOverflow ? "Còn nội dung chưa có khung chứa" : "Luồng đã dàn vừa các khung"}</span></div><b>{element.flowMetrics?.lineCount ?? 0} dòng</b></div>
        <label className="property-field">Nội dung nguồn của chuỗi<textarea className="textarea flow-source-textarea" value={flowSource} onChange={(event) => store.updateFlowSource(element.flowChainId!, event.target.value, false)} onBlur={store.checkpoint}/></label>
        <div className="property-grid"><label className="property-field">Thứ tự<input type="number" value={element.flowOrder ?? frameNumber - 1} disabled/></label><label className="property-field">Padding<input type="number" min="0" max="80" value={element.flowPadding ?? 8} onChange={(event) => patch({ flowPadding: Number(event.target.value) }, false)} onBlur={store.checkpoint}/></label></div>
        <div className="property-action-grid"><button className="btn btn-secondary btn-sm" onClick={() => store.reflowTextChain(element.flowChainId!)}><WandSparkles size={14}/>Dàn lại</button><button className="btn btn-secondary btn-sm" onClick={() => store.appendFlowContinuation(element.flowChainId!)}><Plus size={14}/>Thêm trang tiếp</button><button className="btn btn-secondary btn-sm" onClick={() => store.unlinkTextFrame(element.id)}><Minus size={14}/>Ngắt khung</button></div>
      </> : <>
        <p className="property-note">Khung độc lập. Shift-click thêm một khung chữ rồi bấm biểu tượng liên kết để tạo Text Flow.</p>
        <label className="property-field">Xử lý tràn<select value={element.overflowBehavior ?? "warn"} onChange={(event) => patch({ overflowBehavior: event.target.value as H2OElement["overflowBehavior"] })}><option value="warn">Cảnh báo</option><option value="clip">Cắt nội dung</option><option value="flow">Chảy sang khung khác</option></select></label>
      </>}
    </PropertySection>}

    {element.type === "text" && !multiple && !element.flowChainId && <PropertySection title="Nội dung & kiểu chữ">
      <textarea className="textarea" value={element.text ?? ""} onChange={(event) => patch({ text: event.target.value }, false)} onBlur={store.checkpoint}/>
      <label className="property-field">Font<select value={element.fontFamily ?? "Arial"} onChange={(event) => patch({ fontFamily: event.target.value })}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option><option>Tahoma</option><option>Trebuchet MS</option></select></label>
      <div className="property-grid"><label className="property-field">Cỡ chữ<input type="number" value={element.fontSize ?? 22} onChange={(event) => patch({ fontSize: Number(event.target.value) }, false)} onBlur={store.checkpoint}/></label><label className="property-field">Độ đậm<select value={element.fontWeight ?? 400} onChange={(event) => patch({ fontWeight: Number(event.target.value) })}><option value="400">Thường</option><option value="500">Medium</option><option value="600">Semi Bold</option><option value="700">Bold</option><option value="800">Extra Bold</option></select></label></div>
      <div className="format-buttons"><button className={(element.fontWeight ?? 400) >= 700 ? "active" : ""} onClick={() => patch({ fontWeight: (element.fontWeight ?? 400) >= 700 ? 400 : 700 })}><Bold size={14}/></button><button className={element.fontStyle === "italic" ? "active" : ""} onClick={() => patch({ fontStyle: element.fontStyle === "italic" ? "normal" : "italic" })}><Italic size={14}/></button><button className={element.textDecoration === "underline" ? "active" : ""} onClick={() => patch({ textDecoration: element.textDecoration === "underline" ? "none" : "underline" })}><Underline size={14}/></button><span/><button className={element.align === "left" ? "active" : ""} onClick={() => patch({ align: "left" })}><AlignLeft size={14}/></button><button className={element.align === "center" ? "active" : ""} onClick={() => patch({ align: "center" })}><AlignCenter size={14}/></button><button className={element.align === "right" ? "active" : ""} onClick={() => patch({ align: "right" })}><AlignRight size={14}/></button></div>
      <div className="property-grid"><label className="property-field">Giãn dòng<input type="number" min="0.8" max="3" step="0.05" value={element.lineHeight ?? 1.35} onChange={(event) => patch({ lineHeight: Number(event.target.value) }, false)} onBlur={store.checkpoint}/></label><label className="property-field">Khoảng chữ<input type="number" min="-5" max="20" step="0.5" value={element.letterSpacing ?? 0} onChange={(event) => patch({ letterSpacing: Number(event.target.value) }, false)} onBlur={store.checkpoint}/></label></div>
    </PropertySection>}

    {element.type === "image" && !multiple && <PropertySection title="Hình ảnh">
      {element.imageMetadata && <div className="image-quality-card"><strong>{element.imageMetadata.pixelWidth}×{element.imageMetadata.pixelHeight}px</strong><span>Effective DPI: {Math.round(Math.min(element.imageMetadata.pixelWidth * 96 / Math.max(1, element.width), element.imageMetadata.pixelHeight * 96 / Math.max(1, element.height)))}</span><small>{element.imageMetadata.colorProfile ?? "Profile không rõ"}{element.imageMetadata.dpiX ? ` · Metadata ${Math.round(element.imageMetadata.dpiX)} DPI` : ""}</small></div>}
      <label className="property-field">Chế độ khung<select value={element.imageFit ?? "cover"} onChange={(event) => patch({ imageFit: event.target.value as H2OElement["imageFit"] })}><option value="cover">Lấp đầy khung</option><option value="contain">Vừa trong khung</option><option value="fill">Kéo giãn</option></select></label>
      <label className="property-field">Alt text<input value={element.altText ?? ""} onChange={(event) => patch({ altText: event.target.value }, false)} onBlur={store.checkpoint} placeholder="Mô tả nội dung và mục đích hình ảnh"/></label>
      <label className="property-field">Chú thích<input value={element.caption ?? ""} onChange={(event) => patch({ caption: event.target.value }, false)} onBlur={store.checkpoint}/></label>
      <button className="upload-inline" onClick={() => window.dispatchEvent(new Event("h2obook:open-image-import"))}><Upload size={15}/>Mở Image Smart Import</button>
    </PropertySection>}

    {element.type === "qr" && !multiple && <PropertySection title="QR Code"><label className="property-field">Nội dung QR<input value={element.qrValue ?? ""} onChange={(event) => patch({ qrValue: event.target.value, text: event.target.value }, false)} onBlur={store.checkpoint}/></label><p className="property-note">QR được tạo cục bộ với mức sửa lỗi cao, không gọi API bên ngoài.</p></PropertySection>}

    <PropertySection title="Màu & hiển thị">
      <label className="property-field">Màu chính<div className="color-control"><input type="color" value={safeColor(element.fill)} onChange={(event) => patch({ fill: event.target.value }, false)} onBlur={store.checkpoint}/><input value={element.fill ?? "#ffffff"} onChange={(event) => patch({ fill: event.target.value }, false)} onBlur={store.checkpoint}/></div></label>
      <label className="property-field">Độ trong suốt<div className="range-control"><input type="range" min="0.05" max="1" step="0.05" value={element.opacity} onChange={(event) => patch({ opacity: Number(event.target.value) }, false)} onMouseUp={store.checkpoint}/><span>{Math.round(element.opacity * 100)}%</span></div></label>
      <div className="property-grid"><label className="property-field">Bo góc<input type="number" min="0" max="999" value={element.cornerRadius ?? 0} onChange={(event) => patch({ cornerRadius: Number(event.target.value) }, false)} onBlur={store.checkpoint}/></label><label className="property-field">Xoay<input type="number" min="-360" max="360" value={Math.round(element.rotation)} onChange={(event) => patch({ rotation: Number(event.target.value) }, false)} onBlur={store.checkpoint}/></label></div>
    </PropertySection>

    {!multiple && <PropertySection title="Smart Field"><label className="property-field">Liên kết dữ liệu<select value={element.bindingKey ?? ""} onChange={(event) => patch({ bindingKey: event.target.value || undefined })}><option value="">Không liên kết</option><option value="brand.name">brand.name</option><option value="brand.logo">brand.logo</option><option value="brand.primary_color">brand.primary_color</option><option value="brand.secondary_color">brand.secondary_color</option><option value="brand.accent_color">brand.accent_color</option><option value="brand.phone">brand.phone</option><option value="brand.email">brand.email</option><option value="brand.website">brand.website</option><option value="expert.name">expert.name</option><option value="expert.title">expert.title</option><option value="expert.avatar">expert.avatar</option></select></label></PropertySection>}

    <PropertySection title="Khóa template">
      <div className="permission-list"><label><input type="checkbox" checked={element.permissions.canEditContent} onChange={(event) => patch({ permissions: { ...element.permissions, canEditContent: event.target.checked } })}/>Sửa nội dung</label><label><input type="checkbox" checked={element.permissions.canMove} onChange={(event) => patch({ permissions: { ...element.permissions, canMove: event.target.checked } })}/>Di chuyển</label><label><input type="checkbox" checked={element.permissions.canResize} onChange={(event) => patch({ permissions: { ...element.permissions, canResize: event.target.checked } })}/>Đổi kích thước</label><label><input type="checkbox" checked={element.permissions.canDelete} onChange={(event) => patch({ permissions: { ...element.permissions, canDelete: event.target.checked } })}/>Cho phép xóa</label><label><input type="checkbox" checked={element.permissions.canChangeColor} onChange={(event) => patch({ permissions: { ...element.permissions, canChangeColor: event.target.checked } })}/>Đổi màu</label></div>
      <div className="property-action-grid"><button className="btn btn-secondary btn-sm" onClick={() => store.moveLayer(element.id, "top")}><ArrowUp size={13}/>Lên trên</button><button className="btn btn-secondary btn-sm" onClick={() => store.moveLayer(element.id, "bottom")}><ArrowDown size={13}/>Xuống dưới</button><button className="btn btn-secondary btn-sm" onClick={() => store.toggleLock(element.id)}>{element.locked ? <Unlock size={13}/> : <Lock size={13}/>} {element.locked ? "Mở khóa" : "Khóa"}</button><button className="btn btn-secondary btn-sm" onClick={store.duplicateElement}><Copy size={13}/>Nhân bản</button></div>
      <button className="btn btn-danger btn-sm full-button" onClick={store.deleteElement}><Trash2 size={13}/>Xóa thành phần</button>
    </PropertySection>
  </>;
}

function PropertySection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="property-section-v2"><div className="property-section-title">{title}</div>{children}</section>; }

function flattenTextNodes(nodes: SemanticContentNode[]): SemanticContentNode[] {
  const output: SemanticContentNode[] = [];
  const visit = (items: SemanticContentNode[]) => items.forEach((item) => { if (["heading", "paragraph", "quote", "list_item"].includes(item.type)) output.push(item); visit(item.children); });
  visit(nodes);
  return output;
}
function replaceNodeText(nodes: SemanticContentNode[], nodeId: string, value: string): SemanticContentNode[] {
  return nodes.map((node) => node.id === nodeId ? { ...node, text: [{ text: value }], version: node.version + 1 } : { ...node, children: replaceNodeText(node.children, nodeId, value) });
}

function safeColor(value?: string) { return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"; }
function slug(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function downloadBlob(content: string, filename: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
