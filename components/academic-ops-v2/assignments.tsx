"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, ClipboardCheck, Clock3, FileUp, Plus, Send } from "lucide-react";
import { buildAcademicOpsViewModel } from "@/lib/academic-ops-v2/selectors";
import { trackAcademicOpsEvent } from "@/lib/academic-ops-v2/analytics";
import { AcademicOpsFlowBar, IntelligenceHeader, MetricGrid } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicAssignmentsV2() {
  const store = useAppStore();
  const model = buildAcademicOpsViewModel(store);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(store.classes.find((item) => item.status === "active")?.id ?? store.classes[0]?.id ?? "");
  const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const [instructions, setInstructions] = useState("");

  const create = () => {
    const assignment = store.createAssignment({ title: title.trim() || "Bài tập mới", classId, bookId, instructions, status: "published" });
    trackAcademicOpsEvent("academic_assignment_created", { assignmentId: assignment.id });
    setOpen(false); setTitle(""); setInstructions("");
  };

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="PRACTICE & FEEDBACK" title="Bài tập thực hành" description="Giao nhiệm vụ, nhận bằng chứng và quản lý hàng đợi chấm điểm." actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16}/>Tạo bài tập</button>}/>
        <MetricGrid items={[
          { label: "Tổng bài tập", value: String(model.assignments.length), note: `${model.assignments.filter((item) => item.status === "published").length} đang mở` },
          { label: "Bài nộp chờ chấm", value: String(model.metrics.pendingGrades), note: "Cần phản hồi học viên" },
          { label: "Đã chấm", value: String(model.metrics.gradedSubmissions), note: "Tất cả lớp học" },
          { label: "Tổng bài nộp", value: String(model.metrics.totalSubmissions), note: "Ảnh, video và ghi chú" }
        ]}/>
        <section className={styles.cardGrid}>
          {model.assignments.map((assignment) => {
            const course = model.classes.find((item) => item.id === assignment.classId);
            const book = model.books.find((item) => item.id === assignment.bookId);
            const percent = Math.round(assignment.gradedCount / Math.max(1, assignment.submissionCount) * 100);
            return <article className={styles.entityCard} key={assignment.id}><span className={styles.status}>{assignment.status === "published" ? "Đang nhận bài" : assignment.status}</span><h3>{assignment.title}</h3><p>{assignment.instructions}</p><div className={styles.meta}><span>{course?.name ?? "Lớp đã xóa"}</span><span>{book?.title ?? "Không gắn sách"}</span><span>Hạn {formatDate(assignment.dueAt)}</span></div><div className={styles.meta}><span>Đã chấm {assignment.gradedCount}/{assignment.submissionCount}</span><span>{percent}%</span></div><span className={styles.progress}><i style={{ width: `${percent}%` }}/></span><div className={styles.actions}><button className="btn btn-secondary">Xem bài nộp</button><button className="btn btn-soft" onClick={() => { store.updateAssignment(assignment.id, { gradedCount: Math.min(assignment.submissionCount, assignment.gradedCount + 1) }); trackAcademicOpsEvent("academic_assignment_graded", { assignmentId: assignment.id }); }}><CheckCircle2 size={15}/>Chấm nhanh</button></div></article>;
          })}
        </section>
        <Modal open={open} onClose={() => setOpen(false)} title="Tạo bài tập thực hành" description="Bài tập sẽ xuất hiện trong lớp và không gian học viên."><div className="form-grid"><label className="field full"><span>Tên bài tập</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Thực hành nền trong trẻo"/></label><label className="field"><span>Lớp học</span><select className="select" value={classId} onChange={(event) => setClassId(event.target.value)}>{store.classes.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label className="field"><span>Sách liên quan</span><select className="select" value={bookId} onChange={(event) => setBookId(event.target.value)}>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label className="field full"><span>Yêu cầu bài nộp</span><textarea className="textarea" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Nộp ảnh before/after, công thức sản phẩm và tự đánh giá..."/></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={create}><Send size={15}/>Tạo và giao bài</button></div></Modal>
      </div>
    </AppShell>
  );
}
