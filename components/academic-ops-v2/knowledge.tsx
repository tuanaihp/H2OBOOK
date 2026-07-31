"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { BookOpen, FileText, Link2, Network, NotebookPen, Plus, Search } from "lucide-react";
import { trackAcademicOpsEvent } from "@/lib/academic-ops-v2/analytics";
import { AcademicOpsFlowBar, IntelligenceHeader } from "./shared";
import styles from "./academic-ops.module.css";

const iconMap = { book: BookOpen, note: NotebookPen, pdf: FileText, link: Link2, image: FileText } as const;

export function AcademicKnowledgeV2() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const sources = useMemo(() => store.knowledgeSources.filter((source) => `${source.title} ${source.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [store.knowledgeSources, query]);
  const addSource = () => {
    if (!sourceTitle.trim()) return;
    store.addKnowledgeSource({ title: sourceTitle.trim(), sourceType: "note", tags: ["tự tạo"] });
    trackAcademicOpsEvent("academic_knowledge_source_created", { sourceType: "note" });
    setSourceTitle("");
  };

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="KNOWLEDGE OPERATIONS" title="Knowledge Space" description="Một lớp dữ liệu chung cho sách, ghi chú, tài liệu và liên kết học thuật."/>
        <section className={styles.hero}>
          <div><span className={styles.eyebrow}>H2O KNOWLEDGE MEMORY</span><h1>Một nơi cho toàn bộ tri thức của bạn.</h1><p>Nguồn tri thức được dùng lại trong Reader, lớp học, bài tập, quiz và flashcard. AI chỉ là lớp hỗ trợ tùy chọn.</p></div>
          <div className={styles.orb}><Network size={58}/></div>
        </section>
        <div className={styles.toolbar}>
          <div className={styles.search}><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm nguồn hoặc thẻ..."/></div>
          <div className={styles.search}><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addSource()} placeholder="Thêm ghi chú hoặc nguồn mới..."/></div>
          <button className="btn btn-primary" onClick={addSource}><Plus size={15}/>Thêm</button>
        </div>
        <section className={styles.cardGrid}>
          {sources.map((source) => {
            const Icon = iconMap[source.sourceType as keyof typeof iconMap] ?? FileText;
            return (
              <article className={styles.entityCard} key={source.id}>
                <span className={styles.iconTile}><Icon size={19}/></span>
                <div className={styles.meta}><span>{source.sourceType.toUpperCase()}</span><span>{source.status}</span></div>
                <h3>{source.title}</h3>
                <p>{source.tags.map((tag) => `#${tag}`).join(" · ") || "Chưa có thẻ"}</p>
              </article>
            );
          })}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Ghi chú đã lưu</h2><p>Gắn trực tiếp với sách và hành trình học.</p></div></div>
          <div className={`${styles.panelBody} ${styles.cardGrid}`}>
            {store.learningNotes.map((note) => <article className={styles.entityCard} key={note.id}><h3>{note.title}</h3><p>{note.content}</p><div className={styles.meta}>{note.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></article>)}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
