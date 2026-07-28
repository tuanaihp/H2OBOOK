"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, ClipboardCheck, Clock3, FileUp, Plus, Send } from "lucide-react";

export default function AssignmentsPage() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(store.classes.find((item) => item.status === "active")?.id ?? store.classes[0]?.id ?? "");
  const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const [instructions, setInstructions] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = store.assignments.find((item) => item.id === detailId);
  const pending = store.assignments.reduce((sum, item) => sum + Math.max(0, item.submissionCount - item.gradedCount), 0);
  const create = () => { store.createAssignment({ title: title.trim() || "Bài tập mới", classId, bookId, instructions, status: "published" }); setOpen(false); setTitle(""); setInstructions(""); };
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">PRACTICE & FEEDBACK</span><h1>Bài tập thực hành</h1><p>Giao nhiệm vụ theo sách, nhận ảnh/video và quản lý chấm điểm.</p></div><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16}/>Tạo bài tập</button></div>
    <section className="metric-grid"><MetricCard label="Tổng bài tập" value={String(store.assignments.length)} note={`${store.assignments.filter((item) => item.status === "published").length} đang mở`} icon={ClipboardCheck}/><MetricCard label="Bài nộp chờ chấm" value={String(pending)} note="Cần phản hồi học viên" icon={Clock3} tone="warning"/><MetricCard label="Đã chấm" value={String(store.assignments.reduce((sum, item) => sum + item.gradedCount, 0))} note="Tất cả lớp học" icon={CheckCircle2} tone="success"/><MetricCard label="Tổng bài nộp" value={String(store.assignments.reduce((sum, item) => sum + item.submissionCount, 0))} note="Ảnh, video và ghi chú" icon={FileUp} tone="blue"/></section>
    <div className="assignment-grid">{store.assignments.map((assignment) => { const course = store.classes.find((item) => item.id === assignment.classId); const book = store.books.find((item) => item.id === assignment.bookId); const percent = Math.round(assignment.gradedCount / Math.max(1, assignment.submissionCount) * 100); return <article className="assignment-card" key={assignment.id}><div className="assignment-card-head"><span className="assignment-icon"><ClipboardCheck size={20}/></span><Badge tone={assignment.status === "published" ? "success" : "warning"}>{assignment.status === "published" ? "Đang nhận bài" : "Bản nháp"}</Badge></div><h3>{assignment.title}</h3><p>{assignment.instructions}</p><div className="assignment-relations"><span>{course?.name ?? "Lớp đã xóa"}</span><span>{book?.title ?? "Không gắn sách"}</span><span>Hạn {formatDate(assignment.dueAt)}</span></div><div className="grading-progress"><div><span>Đã chấm {assignment.gradedCount}/{assignment.submissionCount}</span><strong>{percent}%</strong></div><div className="progress"><span style={{ width: `${percent}%` }}/></div></div><div className="assignment-actions"><button className="btn btn-secondary btn-sm" onClick={() => setDetailId(assignment.id)}>Xem bài nộp</button><button className="btn btn-soft btn-sm" onClick={() => store.updateAssignment(assignment.id, { gradedCount: Math.min(assignment.submissionCount, assignment.gradedCount + 1) })}>Chấm nhanh</button></div></article>; })}</div>

    <Modal open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail?.title ?? "Bài nộp"} description={`${detail?.submissionCount ?? 0} bài nộp • ${detail?.gradedCount ?? 0} đã chấm`} width={720}><div className="submission-list">{Array.from({ length: Math.min(detail?.submissionCount ?? 0, 6) }, (_, index) => <article key={index}><span className="mini-avatar">HV</span><div><strong>Học viên {index + 1}</strong><small>Ảnh thực hành, công thức sản phẩm và tự đánh giá.</small></div><Badge tone={index < (detail?.gradedCount ?? 0) ? "success" : "warning"}>{index < (detail?.gradedCount ?? 0) ? "Đã chấm" : "Chờ chấm"}</Badge></article>)}</div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setDetailId(null)}>Đóng</button><button className="btn btn-primary" onClick={() => detail && store.updateAssignment(detail.id, { gradedCount: detail.submissionCount })}><CheckCircle2 size={15}/>Đánh dấu đã chấm tất cả</button></div></Modal>
    <Modal open={open} onClose={() => setOpen(false)} title="Tạo bài tập thực hành" description="Bài tập sẽ xuất hiện trong lớp và thư viện của học viên."><div className="form-grid"><label className="field full"><span>Tên bài tập</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Thực hành nền trong trẻo"/></label><label className="field"><span>Lớp học</span><select className="select" value={classId} onChange={(event) => setClassId(event.target.value)}>{store.classes.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label className="field"><span>Sách liên quan</span><select className="select" value={bookId} onChange={(event) => setBookId(event.target.value)}>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label className="field full"><span>Yêu cầu bài nộp</span><textarea className="textarea" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Nộp ảnh before/after, công thức sản phẩm và tự đánh giá..."/></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={create}><Send size={15}/>Tạo và giao bài</button></div></Modal>
  </AppShell>;
}
