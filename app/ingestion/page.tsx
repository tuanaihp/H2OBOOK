"use client";

import { AppShell } from "@/components/layout/app-shell";
import { localizeHtmlAssets, previewHtmlFile } from "@/lib/input/html-import";
import { ingest, previewIngestion, type IngestionPreview, type IngestionSourceType } from "@h2obook/ingestion-core";
import type { BookDocument } from "@h2obook/content-core";
import type { ImportDocument } from "@h2obook/input-core";
import { useAppStore } from "@/store/app-store";
import { ArrowRight, BookPlus, FileAudio, FileCode2, FileText, Globe2, Loader2, Podcast, RotateCcw, Sparkles, Upload, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const modes: { id: IngestionSourceType; label: string; description: string; icon: typeof FileText; placeholder: string }[] = [
  { id: "markdown", label: "Markdown / văn bản", description: "Nhận heading, list, quote và ảnh Markdown.", icon: FileText, placeholder: "# Tên sách\n\n## Chương 1\n\nNội dung..." },
  { id: "html", label: "HTML / HTM", description: "Upload HTML, làm sạch trên server và giữ bảng, link, nested list, figure và inline marks.", icon: FileCode2, placeholder: "Chọn file .html, .htm hoặc .xhtml" },
  { id: "url", label: "URL / Google Docs", description: "Lấy nội dung từ trang công khai bằng cùng HTML Import 2.0 và kiểm tra SSRF.", icon: Globe2, placeholder: "https://..." },
  { id: "transcript", label: "Transcript", description: "Nhập transcript có timestamp hoặc tên người nói.", icon: Video, placeholder: "00:00 Mở đầu bài học\n00:35 Nội dung..." },
  { id: "podcast_rss", label: "Podcast RSS", description: "Tạo chương từ danh sách tập podcast.", icon: Podcast, placeholder: "Dán XML RSS hoặc nhập URL RSS ở chế độ URL." },
  { id: "audio_transcript", label: "Audio transcript", description: "Dùng transcript thủ công, không bắt buộc dịch vụ AI.", icon: FileAudio, placeholder: "Dán transcript đã có tại đây..." },
];

export default function IngestionPage() {
  const store = useAppStore();
  const router = useRouter();
  const [mode, setMode] = useState<IngestionSourceType>("markdown");
  const [value, setValue] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<IngestionPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Sẵn sàng phân tích trên thiết bị");
  const current = modes.find((item) => item.id === mode) ?? modes[0];
  const outline = useMemo(() => preview?.nodes.filter((node) => ["chapter", "section", "heading"].includes(node.type)).slice(0, 30) ?? [], [preview]);

  const reset = () => {
    setValue(""); setHtmlFile(null); setPreview(null); setImportResult(null); setMessage("Đã làm mới");
  };

  const run = async () => {
    if (mode === "html" ? !htmlFile : !value.trim()) return;
    setLoading(true); setMessage("Đang chuẩn hóa nội dung..."); setImportResult(null);
    try {
      if (mode === "html" && htmlFile) {
        const result = await previewHtmlFile(htmlFile, { bookId: `preview-${crypto.randomUUID()}`, organizationId: store.workspace.id });
        setImportResult(result);
        setPreview({
          title: result.title, sourceType: "html", nodes: result.nodes,
          warnings: result.warnings.map(({ code, message, severity }) => ({ code, message, severity })),
          statistics: {
            chapters: result.nodes.filter((node) => node.type === "chapter").length,
            headings: result.statistics.headings,
            paragraphs: result.statistics.paragraphs,
            lists: result.statistics.lists,
            words: result.statistics.words,
          },
          metadata: result.metadata,
        });
      } else if (mode === "url") {
        const response = await fetch("/api/ingestion/url", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: value.trim(), organizationId: store.workspace.id, bookId: `preview-${crypto.randomUUID()}` }),
        });
        const payload = await response.json() as { preview?: IngestionPreview; result?: ImportDocument; error?: string };
        if (!response.ok || !payload.preview) throw new Error(payload.error ?? "Không thể đọc URL");
        setPreview(payload.preview); setImportResult(payload.result ?? null);
      } else {
        setPreview(previewIngestion({ type: mode, content: value, title: undefined }));
      }
      setMessage("Đã tạo bản xem trước. Có thể chỉnh lại sau khi vào Compose Mode.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể phân tích nguồn");
    } finally { setLoading(false); }
  };

  const createDraft = async () => {
    if (!preview) return;
    setLoading(true); setMessage("Đang tạo bản thảo...");
    try {
      const book = store.createBook({ title: preview.title, description: `Được tạo từ ${preview.sourceType}`, status: "draft" });
      let semanticDocument: BookDocument;
      if (importResult) {
        const localized = await localizeHtmlAssets({ ...importResult, document: { ...importResult.document, bookId: book.id } }, {
          organizationId: store.workspace.id,
          progress: (done, total) => setMessage(`Đang lưu ảnh HTML ${done}/${total}...`),
        });
        semanticDocument = { ...localized.document, bookId: book.id };
      } else {
        const result = ingest({ type: preview.sourceType, title: preview.title, content: value, metadata: preview.metadata }, { bookId: book.id });
        if (mode === "url") result.document.root = preview.nodes;
        semanticDocument = result.document;
      }
      // Compose Mode loads its working copy from h2obook-document: — mirroring the imported document
      // there keeps the parsed content visible even before (or without) the cloud round-trip.
      localStorage.setItem(`h2obook-semantic-${book.id}`, JSON.stringify(semanticDocument));
      localStorage.setItem(`h2obook-document:${book.id}`, JSON.stringify(semanticDocument));
      // Cloud-first draft: cloud-save creates the books row (client_key = book.id), then the document
      // PUT stores the semantic tree — so /api/books/list and /api/books/[id]/document both see the
      // import instead of the draft silently existing only in this browser.
      if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
        try {
          setMessage("Đang đồng bộ bản thảo lên cloud...");
          const saved = await fetch("/api/books/cloud-save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: store.workspace.id, book }) });
          if (!saved.ok) {
            console.error("[H2OBOOK ingestion] cloud-save failed", saved.status, await saved.text().catch(() => ""));
          } else {
            const synced = await fetch(`/api/books/${encodeURIComponent(book.id)}/document`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: store.workspace.id, document: semanticDocument }) });
            if (!synced.ok) console.error("[H2OBOOK ingestion] document sync failed", synced.status, await synced.text().catch(() => ""));
          }
        } catch (error) {
          console.error("[H2OBOOK ingestion] cloud sync", error);
        }
      }
      store.addKnowledgeSource({ title: preview.title, sourceType: mode === "url" ? "url" : "note", url: mode === "url" ? value : undefined, bookId: book.id, tags: ["ingestion", mode] });
      router.push(`/editor/${book.id}/compose`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo bản thảo");
    } finally { setLoading(false); }
  };

  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">UNIVERSAL CONTENT INGESTION</span><h1>Biến nguồn nội dung thành bản thảo có cấu trúc.</h1><p>Rule-based local trước, AI chỉ là tùy chọn. Nội dung luôn được xem trước trước khi tạo sách.</p></div><button className="btn btn-secondary" onClick={reset}><RotateCcw size={15}/>Làm mới</button></div>
    <div className="ingestion-shell">
      <aside className="section-card ingestion-modes"><div className="section-head"><h2>Nguồn đầu vào</h2></div>{modes.map((item) => { const Icon = item.icon; return <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => { setMode(item.id); setPreview(null); setImportResult(null); }}><Icon/><span><strong>{item.label}</strong><small>{item.description}</small></span></button>; })}<div className="ingestion-note"><Sparkles/><p>PDF, DOCX, ảnh và HTML đều quy về Semantic Content Model. HTML/URL dùng parser server-side, không thực thi script.</p></div></aside>
      <main className="section-card ingestion-workbench"><div className="section-head"><div><h2>{current.label}</h2><p>{current.description}</p></div></div>
        {mode === "html" ? <label className="upload-zone upload-zone-large"><Upload size={28}/><strong>{htmlFile?.name ?? "Chọn file HTML"}</strong><span>.html, .htm hoặc .xhtml — tối đa 5 MB</span><input type="file" accept=".html,.htm,.xhtml,text/html,application/xhtml+xml" onChange={(event) => { setHtmlFile(event.target.files?.[0] ?? null); setPreview(null); setImportResult(null); }}/></label>
          : mode === "url" ? <input className="ingestion-url" value={value} onChange={(event) => setValue(event.target.value)} placeholder={current.placeholder}/>
            : <textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={current.placeholder}/>} 
        <div className="ingestion-actions"><button className="btn btn-primary" onClick={run} disabled={loading || (mode === "html" ? !htmlFile : !value.trim())}>{loading ? <Loader2 className="spin"/> : <ArrowRight/>}Phân tích nguồn</button><span>{message}</span></div>
      </main>
      <aside className="section-card ingestion-preview"><div className="section-head"><div><h2>Bản xem trước</h2><p>{preview ? preview.title : "Chưa có dữ liệu"}</p></div></div>{preview ? <><div className="ingestion-stats"><span><strong>{preview.statistics.chapters}</strong> chương</span><span><strong>{preview.statistics.headings}</strong> mục</span><span><strong>{preview.statistics.words}</strong> từ</span></div><div className="ingestion-outline">{outline.length ? outline.map((item) => <div key={item.id} className={`level-${Number(item.attrs.level ?? 2)}`}><span>{item.type}</span><strong>{item.text?.map((part) => part.text).join("")}</strong></div>) : <p>Chưa phát hiện heading. Có thể thêm chương trong Compose Mode.</p>}</div>{preview.warnings.map((warning) => <div className={`ingestion-warning ${warning.severity}`} key={warning.code}>{warning.message}</div>)}<button className="btn btn-primary btn-block" onClick={createDraft} disabled={loading}><BookPlus/>Tạo bản thảo sách</button></> : <div className="empty-state compact">Nhập nguồn rồi chọn “Phân tích nguồn”.</div>}</aside>
    </div>
  </AppShell>;
}
