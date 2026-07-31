"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/utils";
import { BookOpen, CalendarDays, Plus, Search, Users } from "lucide-react";
import { trackAcademicOpsEvent } from "@/lib/academic-ops-v2/analytics";
import { AcademicOpsFlowBar, IntelligenceHeader } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicClassesV2() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState(store.workspace.ownerName);
  const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const filtered = useMemo(() => store.classes.filter((item) => `${item.name} ${item.code} ${item.teacherName}`.toLowerCase().includes(query.toLowerCase())), [store.classes, query]);
  const create = () => {
    const course = store.createClass({ name: name.trim() || "Lớp học mới", teacherName: teacher, bookIds: bookId ? [bookId] : [], status: "upcoming" });
    trackAcademicOpsEvent("academic_class_created", { classId: course.id });
    setOpen(false); setName("");
  };

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="TRAINING OPERATIONS" title="Quản lý lớp học" description="Nối giảng viên, học viên, sách, bài tập và tiến độ vào cùng một lớp." actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16}/>Tạo lớp mới</button>}/>
        <div className={styles.toolbar}><div className={styles.search}><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm lớp, mã lớp, giảng viên..."/></div><span>{filtered.length} lớp</span></div>
        <section className={styles.cardGrid}>
          {filtered.map((course) => <article className={styles.entityCard} key={course.id}><span className={styles.status}>{course.status === "active" ? "Đang học" : course.status === "completed" ? "Đã hoàn thành" : "Sắp mở"}</span><div className={styles.meta}><span>{course.code}</span></div><h3>{course.name}</h3><p>Giảng viên: {course.teacherName}</p><div className={styles.meta}><span><Users size={12}/> {course.studentIds.length} học viên</span><span><BookOpen size={12}/> {course.bookIds.length} sách</span><span><CalendarDays size={12}/> {formatDate(course.startDate)} – {formatDate(course.endDate)}</span></div><span className={styles.progress}><i style={{ width: `${course.status === "completed" ? 100 : course.status === "active" ? 58 : 5}%` }}/></span><div className={styles.actions}><button className="btn btn-secondary">Xem chi tiết</button><Link className="btn btn-soft" href="/academic-ops-v2-preview/library">Cấp tài liệu</Link></div></article>)}
        </section>
        <Modal open={open} onClose={() => setOpen(false)} title="Tạo lớp học mới" description="Sau khi tạo, bạn có thể cấp sách và mời học viên."><div className="form-grid"><label className="field full"><span>Tên lớp</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Makeup Chuyên Nghiệp K27"/></label><label className="field"><span>Giảng viên</span><input className="input" value={teacher} onChange={(event) => setTeacher(event.target.value)}/></label><label className="field"><span>Sách nền</span><select className="select" value={bookId} onChange={(event) => setBookId(event.target.value)}>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={create}>Tạo lớp</button></div></Modal>
      </div>
    </AppShell>
  );
}
