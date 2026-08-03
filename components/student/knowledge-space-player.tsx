"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Lock, Send, Sparkles, Wand2 } from "lucide-react";
import type { KnowledgeSpaceManifest, BlockRecord } from "@/lib/learning-intelligence/service";
import styles from "./knowledge-space-player.module.css";

type ChatMessage = { role: "user" | "assistant"; text: string };

// Dedicated rendering is implemented for: mission_brief, rich_text, checklist, video (metadata
// only — no player wired yet), case_study, before_after, download (see BlockBody below). Other
// block types (quiz/assignment/reflection/flashcards/tool_embed/result/share_card/
// expert_insight/warning/process/timeline/knowledge_map/audio/gallery) fall through to the
// generic text renderer with a manual "mark complete" action; specialized grading/quiz-scoring
// UI is intentionally deferred — see the integration report for module 8.

export function KnowledgeSpacePlayer({ manifest, organizationId }: { manifest: KnowledgeSpaceManifest; organizationId: string }) {
  const allBlocks = useMemo(() => manifest.sections.flatMap((section) => section.blocks), [manifest.sections]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(allBlocks[0]?.id ?? null);
  const [blockProgress, setBlockProgress] = useState(manifest.blockProgress);
  const [notes, setNotes] = useState<{ id: string; body: string; title: string }[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [checklistState, setChecklistState] = useState<Record<string, boolean[]>>({});

  const activeBlock = allBlocks.find((block) => block.id === activeBlockId) ?? null;
  const overallPercent = manifest.progress?.percent ?? 0;

  async function loadNotes() {
    const res = await fetch(`/api/learning/notes?knowledgeSpaceId=${manifest.id}`);
    const json = await res.json();
    if (res.ok) setNotes(json.notes ?? []);
  }

  async function submitNote() {
    if (!noteDraft.trim()) return;
    const res = await fetch("/api/learning/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ knowledgeSpaceId: manifest.id, organizationId, blockId: activeBlockId, body: noteDraft.trim() }) });
    if (res.ok) { setNoteDraft(""); await loadNotes(); }
  }

  async function markComplete(block: BlockRecord, percent = 100) {
    setBlockProgress((current) => ({ ...current, [block.id]: { percent, completedAt: percent >= 100 ? new Date().toISOString() : null, lastPositionSeconds: null } }));
    const res = await fetch("/api/learning/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blockId: block.id, percent }) });
    await res.json().catch(() => null);
  }

  function toggleChecklistItem(block: BlockRecord, index: number) {
    const items = (block.payload.items as string[] | undefined) ?? [];
    const current = checklistState[block.id] ?? items.map(() => false);
    const next = current.map((value, i) => (i === index ? !value : value));
    setChecklistState((state) => ({ ...state, [block.id]: next }));
    const percent = items.length ? Math.round((next.filter(Boolean).length / items.length) * 100) : 100;
    markComplete(block, percent);
  }

  async function sendAssistantMessage() {
    if (!chatDraft.trim() || !activeBlockId) return;
    const question = chatDraft.trim();
    setChat((log) => [...log, { role: "user", text: question }]);
    setChatDraft(""); setChatBusy(true);
    const res = await fetch("/api/brain/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spaceId: manifest.id, query: question }) });
    const json = await res.json();
    setChatBusy(false);
    setChat((log) => [...log, { role: "assistant", text: res.ok ? json.answer : (json.error ?? "Có lỗi xảy ra, thử lại sau nhé.") }]);
  }

  return <div className={styles.shell}>
    <nav className={styles.nav}>
      <div className={styles.navHeader}>
        <h1>{manifest.title}</h1>
        <p>{manifest.instructorName || "H2OBOOK"} · {manifest.estimatedMinutes} phút</p>
        <div className={styles.progressBar}><i style={{ width: `${overallPercent}%` }} /></div>
        <a className={styles.createCta} href={`/student/create?lessonId=${manifest.contentItemId}&spaceId=${manifest.id}`}><Wand2 size={13} />Tạo kết quả từ bài học này</a>
      </div>
      {manifest.sections.map((section) => <div key={section.id} className={styles.section}>
        <strong>{section.title}</strong>
        {section.blocks.map((block) => {
          const done = (blockProgress[block.id]?.percent ?? 0) >= 100;
          const locked = block.visibility === "instructor" || block.visibility === "admin";
          return <div key={block.id} className={`${styles.blockLink} ${locked ? styles.blockLocked : ""}`} data-active={block.id === activeBlockId} onClick={() => !locked && setActiveBlockId(block.id)}>
            {locked ? <Lock size={13} /> : <span className={styles.check} data-done={done} />}
            <span>{block.title || block.type}</span>
          </div>;
        })}
      </div>)}
    </nav>

    <section className={styles.canvas}>
      {!activeBlock ? <div className={styles.locked}>Knowledge Space này chưa có nội dung.</div> : <BlockView block={activeBlock} progress={blockProgress[activeBlock.id]} checklistState={checklistState[activeBlock.id]} onToggleChecklist={(index) => toggleChecklistItem(activeBlock, index)} onMarkComplete={() => markComplete(activeBlock)} />}
    </section>

    <aside className={styles.panel}>
      {manifest.assistantEnabled && <div className={styles.panelBlock}>
        <h3><Sparkles size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />H2O Brain Assistant</h3>
        <div className={styles.chatLog}>{chat.map((message, index) => <div key={index} className={`${styles.chatBubble} ${message.role === "user" ? styles.chatBubbleUser : ""}`}>{message.text}</div>)}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input className={styles.noteInput} value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Hỏi về nội dung bài học…" onKeyDown={(event) => { if (event.key === "Enter") sendAssistantMessage(); }} />
          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={chatBusy} onClick={sendAssistantMessage}><Send size={14} /></button>
        </div>
      </div>}

      <div className={styles.panelBlock}>
        <h3>Ghi chú của tôi</h3>
        {notes.length === 0 ? <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={loadNotes}>Xem ghi chú</button> : notes.map((note) => <div key={note.id} className={styles.noteItem}>{note.title && <strong>{note.title}</strong>}<div>{note.body}</div></div>)}
        <textarea className={styles.noteInput} rows={3} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Ghi lại điều bạn học được…" style={{ marginTop: 8 }} />
        <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 8 }} onClick={submitNote}>Lưu ghi chú</button>
      </div>
    </aside>
  </div>;
}

function BlockView({ block, progress, checklistState, onToggleChecklist, onMarkComplete }: { block: BlockRecord; progress?: { percent: number }; checklistState?: boolean[]; onToggleChecklist: (index: number) => void; onMarkComplete: () => void }) {
  const done = (progress?.percent ?? 0) >= 100;
  return <div>
    <div className={styles.blockMeta}><span className={styles.badge}>{block.type}</span><span>{block.estimatedMinutes} phút</span>{done && <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} />Đã hoàn thành</span>}</div>
    <h2>{block.title}</h2>
    <BlockBody block={block} checklistState={checklistState} onToggleChecklist={onToggleChecklist} />
    {block.type !== "checklist" && <div className={styles.actions}>
      <button className={`${styles.btn} ${done ? styles.btnSecondary : styles.btnPrimary}`} onClick={onMarkComplete}>{done ? <><Circle size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />Bỏ đánh dấu</> : <><CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />Đánh dấu hoàn thành</>}</button>
    </div>}
  </div>;
}

function BlockBody({ block, checklistState, onToggleChecklist }: { block: BlockRecord; checklistState?: boolean[]; onToggleChecklist: (index: number) => void }) {
  const payload = block.payload;
  if (block.type === "checklist") {
    const items = (payload.items as string[] | undefined) ?? [];
    if (!items.length) return <p>Chưa có nội dung checklist.</p>;
    return <div>{items.map((item, index) => <label key={index} className={styles.checklistItem}><input type="checkbox" checked={Boolean(checklistState?.[index])} onChange={() => onToggleChecklist(index)} /><span>{item}</span></label>)}</div>;
  }
  if (block.type === "video") {
    return <p>Video: assetId <code>{String(payload.assetId ?? "chưa gán")}</code>. Trình phát video sẽ được nối vào Cloudflare Stream ở bước tiếp theo.</p>;
  }
  if (block.type === "before_after") {
    return <p>{String(payload.description ?? "So sánh trước/sau — nội dung chi tiết đang được biên soạn.")}</p>;
  }
  const text = (payload.text as string | undefined) ?? (payload.instructions as string | undefined) ?? "";
  return text ? <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{text}</p> : <p style={{ color: "#8d97a6" }}>Nội dung block này đang được biên soạn.</p>;
}
