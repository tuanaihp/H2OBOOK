"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Blocks, BookOpen, CheckSquare, Megaphone, Search, UserRound, Wrench } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { queueCreativeHandoff } from "@/lib/creative-publishing-v1/editor-handoff";
import { emitCreativeEvent } from "@/lib/creative-publishing-v1/events";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";

const categoryIcons = { lesson: BookOpen, practice: Wrench, marketing: Megaphone, profile: UserRound, assessment: CheckSquare };

export function BlockLibraryV1() {
  const router = useRouter();
  const blocks = useAppStore((state) => state.reusableBlocks);
  const allBooks = useAppStore((state) => state.books);
  // useAppStore selectors must return a stable reference; deriving `.filter()` inline
  // creates a new array every render and loops with Zustand's useSyncExternalStore
  // (React error #185). Memoize the derived list instead.
  const books = useMemo(() => allBooks.filter((book) => !book.archivedAt), [allBooks]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [targetBookId, setTargetBookId] = useState(books[0]?.id ?? "");
  const filtered = useMemo(() => blocks.filter((block) => (category === "all" || block.category === category) && `${block.name} ${block.description}`.toLowerCase().includes(query.toLowerCase())), [blocks, category, query]);

  const applyBlock = (blockId: string) => {
    const target = targetBookId || books[0]?.id;
    if (!target) return;
    queueCreativeHandoff({ kind: "block", sourceId: blockId, targetBookId: target });
    emitCreativeEvent({ name: "creative_handoff_queued", surface: "blocks", action: "insert_block", entityId: blockId, metadata: { targetBookId: target } });
    router.push(`/editor/${target}?creativeHandoff=block`);
  };

  return <CreativePageFrame active="blocks" eyebrow="REUSABLE CONTENT SYSTEM" title="Block Library" description="Tạo một lần, dùng lại trong nhiều sách nhưng vẫn nhận Brand Kit của sách đích." actions={<button className={styles.primaryButton}><Blocks/>Tạo block từ trang</button>} metrics={[
    { label: "Block", value: blocks.length },
    { label: "Bài học", value: blocks.filter((item) => item.category === "lesson").length },
    { label: "Thực hành", value: blocks.filter((item) => item.category === "practice").length },
    { label: "Đánh giá", value: blocks.filter((item) => item.category === "assessment").length },
  ]}>
    <SurfaceCard title="Kho khối nội dung" description="Chọn sách đích trước khi dùng block để handoff sang Editor.">
      <div className={styles.toolbar}>
        <label className={styles.search}><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm block..."/></label>
        <select className={styles.select} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Tất cả nhóm</option><option value="lesson">Lesson</option><option value="practice">Practice</option><option value="assessment">Assessment</option><option value="profile">Profile</option><option value="marketing">Marketing</option></select>
        <select className={styles.select} value={targetBookId} onChange={(event) => setTargetBookId(event.target.value)}>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select>
      </div>
      <div className={styles.blockGrid}>{filtered.map((block, index) => {
        const Icon = categoryIcons[block.category];
        return <article key={block.id} className={styles.blockCard}><div className={styles.blockPreview}><strong>{String(index + 1).padStart(2, "0")}</strong><i/><i/><i/></div><div className={styles.blockBody}><StatusPill tone="info"><Icon/>{block.category}</StatusPill><h3>{block.name}</h3><p>{block.description}</p><footer><small>{block.elementCount} thành phần</small><button className={styles.softButton} onClick={() => applyBlock(block.id)}>Dùng block</button></footer></div></article>;
      })}</div>
    </SurfaceCard>
  </CreativePageFrame>;
}
