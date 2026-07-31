"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/store/app-store";
import { BarChart3, CheckCircle2, Clock3, FileQuestion, Plus, Send } from "lucide-react";
import { trackAcademicOpsEvent } from "@/lib/academic-ops-v2/analytics";
import { AcademicOpsFlowBar, IntelligenceHeader } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicQuizzesV2() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const [passing, setPassing] = useState(70);
  const create = () => {
    const quiz = store.createQuiz({ title: title.trim() || "Bài kiểm tra mới", bookId, passingScore: passing, status: "draft" });
    trackAcademicOpsEvent("academic_quiz_created", { quizId: quiz.id });
    setOpen(false); setTitle("");
  };

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="KNOWLEDGE ASSESSMENT" title="Quiz & kiểm tra" description="Đánh giá kiến thức, chuẩn kỹ năng và hiệu quả nội dung học." actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16}/>Tạo quiz</button>}/>
        <section className={styles.cardGrid}>
          {store.quizzes.map((quiz) => { const book = store.books.find((item) => item.id === quiz.bookId); return <article className={styles.entityCard} key={quiz.id}><span className={styles.status}>{quiz.status === "published" ? "Đang sử dụng" : "Bản nháp"}</span><h3>{quiz.title}</h3><p>{book?.title} · {quiz.chapterName}</p><div className={styles.meta}><span><FileQuestion size={12}/> {quiz.questions.length} câu</span><span><Clock3 size={12}/> {quiz.timeLimitMinutes} phút</span><span><CheckCircle2 size={12}/> {quiz.passingScore}% đạt</span></div><div className={styles.meta}><span><BarChart3 size={12}/> Điểm trung bình {quiz.averageScore || 0}%</span><span>{quiz.attemptCount} lượt làm</span></div><span className={styles.progress}><i style={{ width: `${quiz.averageScore}%` }}/></span><div className={styles.actions}><button className="btn btn-secondary">Chỉnh sửa câu hỏi</button></div></article>; })}
        </section>
        <Modal open={open} onClose={() => setOpen(false)} title="Tạo bài kiểm tra" description="Sau khi tạo có thể bổ sung câu hỏi và xuất bản."><div className="form-grid"><label className="field full"><span>Tên bài kiểm tra</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Kiểm tra kỹ thuật nền"/></label><label className="field"><span>Sách liên quan</span><select className="select" value={bookId} onChange={(event) => setBookId(event.target.value)}>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label className="field"><span>Điểm đạt (%)</span><input className="input" type="number" min="0" max="100" value={passing} onChange={(event) => setPassing(Number(event.target.value))}/></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={create}><Send size={15}/>Tạo quiz</button></div></Modal>
      </div>
    </AppShell>
  );
}
