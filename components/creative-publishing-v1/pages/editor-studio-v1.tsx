"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Boxes, FileCheck2, Layers3, type LucideIcon, MousePointer2, Palette, Send, Type, Upload, WandSparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { readCreativeHandoff } from "@/lib/creative-publishing-v1/editor-handoff";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";

export function EditorStudioV1() {
  // Selecting a raw slice and memoizing the derived filter, not deriving inline: an
  // inline `.filter()` in the selector returns a new array every render and loops
  // with Zustand's useSyncExternalStore (React error #185, seen live during preview).
  const allBooks = useAppStore((state) => state.books);
  const books = useMemo(() => allBooks.filter((book) => !book.archivedAt), [allBooks]);
  const [handoff, setHandoff] = useState<ReturnType<typeof readCreativeHandoff>>(null);
  useEffect(() => { setHandoff(readCreativeHandoff()); }, []);
  return <CreativePageFrame active="editor" eyebrow="PROFESSIONAL AUTHORING" title="H2OBOOK Studio" description="Editor hiện tại được giữ nguyên; module chỉ chuẩn hóa handoff và luồng dữ liệu trước/sau Editor." actions={<Link className={styles.primaryButton} href={`/editor/${books[0]?.id ?? "book_makeup_pro"}`}><WandSparkles/>Mở Studio</Link>} metrics={[
    { label: "Dự án sẵn sàng", value: books.length },
    { label: "Handoff chờ", value: handoff ? 1 : 0 },
    { label: "Text Flow", value: "V2" },
    { label: "Lịch sử", value: "JSON Patch" },
  ]}>
    <SurfaceCard title="Editor Contract" description="Không overlay Neural animation lên canvas và không thay useEditorStore." tone="dark" icon={<MousePointer2/>}>
      <div className={styles.editorContract}>{([
        [Layers3, "Pages & Layers", "Cấu trúc trang và layer có quyền riêng"],
        [Type, "Compose & Text Flow", "Rich text, chain frame và overflow"],
        [Upload, "Asset ID", "Ảnh dùng assetId, signed URL và metadata"],
        [Palette, "Brand Kit", "Smart Fields, màu và font"],
        [Boxes, "Block Handoff", "Nhận reusable block từ local queue"],
        [FileCheck2, "Preflight", "Chặn lỗi trước Publish Center"],
      ] as [LucideIcon, string, string][]).map(([Icon, title, description]) => <article key={title}><span><Icon/></span><div><strong>{title}</strong><p>{description}</p></div></article>)}</div>
    </SurfaceCard>
    {handoff ? <div className={styles.handoffPanel}><StatusPill tone="warning">Handoff đang chờ</StatusPill><strong>{handoff.kind}: {handoff.sourceId}</strong><span>Đích: {handoff.targetBookId ?? "chưa chọn"}</span></div> : null}
    <SurfaceCard title="Tiếp tục dự án" description="Mở trực tiếp Studio, Reader, Preflight hoặc Publish.">
      <div className={styles.projectGrid}>{books.slice(0, 6).map((book) => <article key={book.id}><span className={styles.projectCover} style={{ background: book.cover }}>{book.pages.length}</span><div><strong>{book.title}</strong><small>{book.pages.length} trang · v{book.version} · {book.status}</small></div><div className={styles.projectActions}><Link href={`/editor/${book.id}`}><WandSparkles/>Chỉnh sửa</Link><Link href={`/reader/${book.id}`}><BookOpen/>Xem</Link><Link href={`/content-health?bookId=${book.id}`}><FileCheck2/>Quét</Link><Link href={`/publish?bookId=${book.id}`}><Send/>Xuất</Link></div></article>)}</div>
    </SurfaceCard>
  </CreativePageFrame>;
}
