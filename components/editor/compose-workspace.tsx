"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import { TableKit } from "@tiptap/extension-table";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, BookOpen, Braces,
  Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus,
  Quote, Redo2, Save, Strikethrough, Table2, Underline, Undo2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import {
  flattenSemanticForOutline,
  semanticNodesToTiptapDoc,
  tiptapDocToSemanticNodes,
} from "@/lib/editor/tiptap-content";
import {
  H2OChapter, H2OCitation, H2OFootnote, H2OImageBlock,
  H2OSection, H2OSemanticAttributes,
} from "@/lib/editor/tiptap-extensions";
import { legacyBookToDocument, type BookDocument } from "@h2obook/content-core";

function safeParseDocument(raw: string | null): BookDocument | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as BookDocument; } catch { return null; }
}

function textFromJson(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(textFromJson).join("");
}

function buildOutline(json: JSONContent) {
  const result: Array<{ id: string; level: number; text: string }> = [];
  const visit = (nodes?: JSONContent[]) => nodes?.forEach((node) => {
    if (node.type === "heading") {
      result.push({
        id: String((node.attrs as Record<string, unknown> | undefined)?.h2oNodeId ?? ""),
        level: Number((node.attrs as Record<string, unknown> | undefined)?.level ?? 2),
        text: textFromJson(node) || "Tiêu đề chưa đặt",
      });
    }
    visit(node.content);
  });
  visit(json.content);
  return result;
}

function ToolbarButton({ active, disabled, title, onClick, children }: {
  active?: boolean; disabled?: boolean; title: string; onClick: () => void; children: React.ReactNode;
}) {
  return <button type="button" className={active ? "active" : ""} disabled={disabled} title={title} aria-label={title} onClick={onClick}>{children}</button>;
}

export function ComposeWorkspace() {
  const params = useParams<{ bookId: string }>();
  const app = useAppStore();
  const book = app.books.find((item) => item.id === params.bookId) ?? app.books[0];
  const [documentModel, setDocumentModel] = useState<BookDocument | null>(null);
  const [status, setStatus] = useState("Đang khởi tạo Compose Engine…");
  const [changed, setChanged] = useState(false);
  const [cloudDirty, setCloudDirty] = useState(false);
  const [outline, setOutline] = useState<Array<{ id: string; level: number; text: string }>>([]);
  const loadingRef = useRef(false);
  const autoSaveTimer = useRef<number | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TableKit.configure({ table: { resizable: true, cellMinWidth: 80 } }),
      Placeholder.configure({ placeholder: "Bắt đầu biên soạn nội dung…" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Typography,
      H2OSemanticAttributes,
      H2OChapter,
      H2OSection,
      H2OImageBlock,
      H2OFootnote,
      H2OCitation,
    ],
    content: { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: "compose-prosemirror",
        spellcheck: "true",
        autocapitalize: "sentences",
        "aria-label": "Nội dung sách",
      },
      transformPastedHTML: (html) => html
        .replace(/<o:p>.*?<\/o:p>/gis, "")
        .replace(/class=("|')Mso[^"']*("|')/gi, ""),
    },
    onUpdate: ({ editor: instance }) => {
      setOutline(buildOutline(instance.getJSON()));
      if (loadingRef.current) return;
      setChanged(true);
      setCloudDirty(true);
      setStatus("Có thay đổi chưa lưu lên cloud");
    },
    onSelectionUpdate: ({ editor: instance }) => setOutline(buildOutline(instance.getJSON())),
  });

  const applyDocument = useCallback((next: BookDocument, nextStatus: string) => {
    if (!editor) return;
    loadingRef.current = true;
    setDocumentModel(next);
    const json = semanticNodesToTiptapDoc(next.root);
    editor.commands.setContent(json, { emitUpdate: false });
    setOutline(buildOutline(editor.getJSON()));
    setChanged(false);
    setCloudDirty(false);
    setStatus(nextStatus);
    queueMicrotask(() => { loadingRef.current = false; });
  }, [editor]);

  useEffect(() => {
    if (!book || !editor) return;
    const fallback = legacyBookToDocument(book);
    const local = safeParseDocument(localStorage.getItem(`h2obook-document:${book.id}`));
    applyDocument(local ?? fallback, local ? "Đã tải bản biên soạn trên thiết bị" : "Đã chuyển sách cũ sang Semantic Document");

    if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
      void fetch(`/api/books/${encodeURIComponent(book.id)}/document`, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => { if (payload?.document) applyDocument(payload.document as BookDocument, "Đã tải bản mới nhất từ PostgreSQL"); })
        .catch(() => setStatus("Đang dùng bản local; cloud tạm thời chưa kết nối"));
    }
  }, [applyDocument, book?.id, editor]);

  const buildNextDocument = useCallback((): BookDocument | null => {
    if (!book || !editor) return null;
    return {
      ...(documentModel ?? legacyBookToDocument(book)),
      title: book.title,
      root: tiptapDocToSemanticNodes(editor.getJSON()),
      version: (documentModel?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(documentModel?.metadata ?? {}),
        editorEngine: "tiptap-prosemirror",
        editorVersion: "4.12",
      },
    };
  }, [book, documentModel, editor]);

  useEffect(() => {
    if (!changed || !book || !editor) return;
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      const next = buildNextDocument();
      if (!next) return;
      localStorage.setItem(`h2obook-document:${book.id}`, JSON.stringify(next));
      setDocumentModel(next);
      setChanged(false);
      setCloudDirty(process.env.NEXT_PUBLIC_APP_MODE === "production");
      setStatus(process.env.NEXT_PUBLIC_APP_MODE === "production" ? "Đã tự lưu trên thiết bị; cloud còn chờ xác nhận" : "Đã tự lưu trên thiết bị");
    }, 1200);
    return () => { if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current); };
  }, [book, buildNextDocument, changed, editor]);

  const save = useCallback(async () => {
    if (!book) return;
    const next = buildNextDocument();
    if (!next) return;
    localStorage.setItem(`h2obook-document:${book.id}`, JSON.stringify(next));
    setDocumentModel(next);
    setChanged(false);
    setCloudDirty(process.env.NEXT_PUBLIC_APP_MODE === "production");
    setStatus("Đã lưu semantic document trên thiết bị");
    if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
      setStatus("Đang đồng bộ PostgreSQL…");
      try {
        const response = await fetch(`/api/books/${encodeURIComponent(book.id)}/document`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId: app.workspace.id, document: next }),
        });
        setCloudDirty(!response.ok);
        setStatus(response.ok ? "Đã lưu Compose Document lên cloud" : "Đã lưu local; cloud chưa đồng bộ");
      } catch {
        setCloudDirty(true);
        setStatus("Đã lưu local; không thể kết nối cloud");
      }
    }
  }, [app.workspace.id, book, buildNextDocument]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
      if (event.key.toLowerCase() === "k" && editor) {
        event.preventDefault();
        const href = window.prompt("Nhập liên kết https://");
        if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, save]);

  const documentStats = useMemo(() => {
    const text = editor?.getText() ?? "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const nodes = documentModel ? flattenSemanticForOutline(documentModel.root).length : 0;
    return { words, characters: text.length, nodes };
  }, [documentModel, editor, outline]);

  if (!book) return <AppShell><div className="empty-state">Không tìm thấy sách.</div></AppShell>;

  const setLink = () => {
    if (!editor) return;
    const current = String(editor.getAttributes("link").href ?? "");
    const href = window.prompt("Nhập liên kết https://", current || "https://");
    if (href === null) return;
    if (!href.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  const insertFootnote = () => {
    if (!editor) return;
    const note = window.prompt("Nội dung chú thích cuối trang:");
    if (!note) return;
    const label = String((editor.getJSON().content?.length ?? 0) + 1);
    editor.chain().focus().insertContent({ type: "h2oFootnote", attrs: { h2oNodeId: crypto.randomUUID(), h2oVersion: 1, label, note } }).run();
  };

  return <AppShell><div className="compose-page compose-v412">
    <header className="compose-header">
      <div><span className="eyebrow">PROFESSIONAL COMPOSE ENGINE 4.12</span><h1>{book.title}</h1><p>Tiptap/ProseMirror quản lý nội dung bằng schema, transaction và semantic node ổn định.</p></div>
      <div className="header-actions"><Link className="btn btn-secondary" href={`/editor/${book.id}`}><BookOpen size={17}/>Design Mode</Link><button className="btn btn-primary" onClick={() => void save()}><Save size={17}/>{changed ? "Lưu thay đổi" : cloudDirty ? "Đồng bộ cloud" : "Đã lưu"}</button></div>
    </header>

    <div className="compose-layout">
      <aside className="compose-outline">
        <div className="compose-panel-title"><strong>Cấu trúc nội dung</strong><span>{outline.length} tiêu đề</span></div>
        <nav>{outline.length ? outline.map((item) => <button key={item.id || `${item.level}-${item.text}`} style={{ paddingLeft: `${10 + (item.level - 1) * 14}px` }} onClick={() => {
          const target = item.id ? document.querySelector(`[data-h2o-node-id="${CSS.escape(item.id)}"]`) : null;
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}><span>H{item.level}</span>{item.text}</button>) : <p>Thêm Heading 1–3 để tạo mục lục tự động.</p>}</nav>
      </aside>

      <section className="compose-canvas">
        <div className="compose-toolbar" role="toolbar" aria-label="Công cụ biên soạn">
          <div className="compose-toolbar-group">
            <ToolbarButton title="Hoàn tác" disabled={!editor?.can().chain().focus().undo().run()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={18}/></ToolbarButton>
            <ToolbarButton title="Làm lại" disabled={!editor?.can().chain().focus().redo().run()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={18}/></ToolbarButton>
          </div>
          <div className="compose-toolbar-group">
            <ToolbarButton title="Tiêu đề 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={18}/></ToolbarButton>
            <ToolbarButton title="Tiêu đề 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={18}/></ToolbarButton>
            <ToolbarButton title="Tiêu đề 3" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={18}/></ToolbarButton>
          </div>
          <div className="compose-toolbar-group">
            <ToolbarButton title="Đậm" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={18}/></ToolbarButton>
            <ToolbarButton title="Nghiêng" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={18}/></ToolbarButton>
            <ToolbarButton title="Gạch chân" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={18}/></ToolbarButton>
            <ToolbarButton title="Gạch ngang" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={18}/></ToolbarButton>
            <ToolbarButton title="Liên kết (Ctrl/⌘ K)" active={editor?.isActive("link")} onClick={setLink}><Link2 size={18}/></ToolbarButton>
          </div>
          <div className="compose-toolbar-group">
            <ToolbarButton title="Danh sách chấm" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={18}/></ToolbarButton>
            <ToolbarButton title="Danh sách số" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={18}/></ToolbarButton>
            <ToolbarButton title="Trích dẫn" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={18}/></ToolbarButton>
            <ToolbarButton title="Đường phân cách" onClick={() => editor?.chain().focus().setHorizontalRule().run()}><Minus size={18}/></ToolbarButton>
          </div>
          <div className="compose-toolbar-group">
            <ToolbarButton title="Căn trái" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}><AlignLeft size={18}/></ToolbarButton>
            <ToolbarButton title="Căn giữa" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}><AlignCenter size={18}/></ToolbarButton>
            <ToolbarButton title="Căn phải" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}><AlignRight size={18}/></ToolbarButton>
            <ToolbarButton title="Căn đều" active={editor?.isActive({ textAlign: "justify" })} onClick={() => editor?.chain().focus().setTextAlign("justify").run()}><AlignJustify size={18}/></ToolbarButton>
          </div>
          <div className="compose-toolbar-group">
            <ToolbarButton title="Chèn bảng 3 × 3" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={18}/></ToolbarButton>
            <ToolbarButton title="Chèn footnote" onClick={insertFootnote}><Braces size={18}/></ToolbarButton>
          </div>
        </div>

        {editor?.isActive("table") && <div className="compose-table-toolbar">
          <strong>Bảng</strong>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Cột</button>
          <button onClick={() => editor.chain().focus().addRowAfter().run()}>+ Hàng</button>
          <button onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Header</button>
          <button onClick={() => editor.chain().focus().mergeOrSplit().run()}>Gộp/Tách</button>
          <button className="danger" onClick={() => editor.chain().focus().deleteTable().run()}>Xóa bảng</button>
        </div>}

        <EditorContent editor={editor}/>
        <footer className="compose-document-footer"><span>{documentStats.words.toLocaleString("vi-VN")} từ</span><span>{documentStats.characters.toLocaleString("vi-VN")} ký tự</span><span>{documentStats.nodes.toLocaleString("vi-VN")} semantic nodes</span><span>Tự lưu local</span></footer>
      </section>

      <aside className="compose-inspector">
        <div className="compose-panel-title"><strong>Document Model</strong><span>Schema-based</span></div>
        <dl><div><dt>Phiên bản</dt><dd>{documentModel?.version ?? 1}</dd></div><div><dt>Ngôn ngữ</dt><dd>{documentModel?.language ?? "vi"}</dd></div><div><dt>Engine</dt><dd>ProseMirror</dd></div><div><dt>Node</dt><dd>{documentStats.nodes}</dd></div></dl>
        <div className={`compose-status ${changed || cloudDirty ? "pending" : "saved"}`}>{status}</div>
        <div className="compose-capabilities"><strong>Đã hỗ trợ</strong><span>Heading • Marks • Link • Lists</span><span>Table • Footnote • Quote</span><span>Semantic ID • Transaction history</span><span>Paste cleanup • Keyboard shortcuts</span></div>
      </aside>
    </div>
  </div></AppShell>;
}
