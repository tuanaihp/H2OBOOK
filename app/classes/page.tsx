"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/utils";
import type { CourseClass } from "@/types/domain";
import { AlertTriangle, BookOpen, CalendarDays, CloudOff, GraduationCap, Plus, Search, Users } from "lucide-react";

type CloudClass = {
  id: string; name: string; code: string; status: string;
  studentCount: number; avgProgressPercent: number; atRiskCount: number;
  teacherName?: string; startDate?: string | null; endDate?: string | null; color?: string | null; bookCount?: number;
};

type ClassView = {
  id: string; name: string; code: string; status: string; source: "cloud" | "local";
  teacherName: string; studentCount: number; bookCount: number; progressPercent: number; atRiskCount: number;
  startDate: string | null; endDate: string | null; color: string;
  local?: CourseClass;
};

const STATUS_LABEL: Record<string, { label: string; tone: "success" | "neutral" | "warning" }> = {
  active: { label: "Đang học", tone: "success" },
  completed: { label: "Đã hoàn thành", tone: "neutral" },
  archived: { label: "Đã lưu trữ", tone: "neutral" },
  upcoming: { label: "Sắp mở", tone: "warning" }
};

export default function ClassesPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState(store.workspace.ownerName);
  const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const [cloudClasses, setCloudClasses] = useState<CloudClass[]>([]);
  const [cloudReady, setCloudReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const production = process.env.NEXT_PUBLIC_APP_MODE === "production";

  // Cloud classes are the source of truth in production; local store classes stay visible but are
  // badged so a device-only row is never mistaken for a synced one.
  useEffect(() => {
    if (!production) return;
    let cancelled = false;
    void fetch(`/api/teaching/classes?organizationId=${encodeURIComponent(store.workspace.id)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP_${response.status}`)))
      .then((payload: { classes?: CloudClass[] }) => { if (!cancelled) { setCloudClasses(payload.classes ?? []); setCloudReady(true); } })
      .catch(() => { if (!cancelled) setNotice("Không đọc được lớp từ server — đang hiển thị dữ liệu trên thiết bị."); });
    return () => { cancelled = true; };
  }, [production, store.workspace.id]);

  const views = useMemo<ClassView[]>(() => {
    const cloud = cloudClasses.map((klass): ClassView => ({
      id: klass.id, name: klass.name, code: klass.code, status: klass.status, source: "cloud",
      teacherName: klass.teacherName || store.workspace.ownerName,
      studentCount: klass.studentCount, bookCount: klass.bookCount ?? 0,
      progressPercent: klass.avgProgressPercent, atRiskCount: klass.atRiskCount,
      startDate: klass.startDate ?? null, endDate: klass.endDate ?? null,
      color: klass.color ?? store.workspace.brandColor
    }));
    const cloudIds = new Set(cloud.map((item) => item.id));
    const local = store.classes.filter((item) => !cloudIds.has(item.id)).map((item): ClassView => ({
      id: item.id, name: item.name, code: item.code, status: item.status, source: "local",
      teacherName: item.teacherName, studentCount: item.studentIds.length, bookCount: item.bookIds.length,
      progressPercent: item.status === "completed" ? 100 : item.status === "active" ? 58 : 5, atRiskCount: 0,
      startDate: item.startDate, endDate: item.endDate, color: item.color, local: item
    }));
    return [...cloud, ...local];
  }, [cloudClasses, store.classes, store.workspace.brandColor, store.workspace.ownerName]);

  const filtered = useMemo(() => views.filter((item) => `${item.name} ${item.code} ${item.teacherName}`.toLowerCase().includes(query.toLowerCase())), [views, query]);
  const detail = views.find((item) => item.id === detailId) ?? null;

  const create = async () => {
    const className = name.trim() || "Lớp học mới";
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const code = `H2B-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const bookIds = bookId ? [bookId] : [];
    setSaving(true);
    if (production) {
      try {
        const response = await fetch(`/api/teaching/classes?organizationId=${encodeURIComponent(store.workspace.id)}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: className, code, status: "upcoming", startDate, endDate, color: store.workspace.brandColor, bookIds })
        });
        const payload = await response.json().catch(() => null) as { class?: CloudClass; error?: string } | null;
        if (response.ok && payload?.class) {
          const created = payload.class;
          const item: CloudClass = {
            ...created,
            studentCount: created.studentCount ?? 0,
            avgProgressPercent: created.avgProgressPercent ?? 0,
            atRiskCount: created.atRiskCount ?? 0,
            teacherName: created.teacherName || teacher.trim()
          };
          setCloudClasses((current) => [item, ...current]);
          setOpen(false); setName(""); setNotice(null); setSaving(false);
          return;
        }
        setNotice(payload?.error === "CLASS_CODE_ALREADY_EXISTS" ? "Mã lớp đã tồn tại — lớp được giữ trên thiết bị." : "Không lưu được lớp lên server — lớp được giữ trên thiết bị.");
      } catch {
        setNotice("Không kết nối được server — lớp được giữ trên thiết bị.");
      }
    }
    store.createClass({ name: className, code, teacherName: teacher, bookIds, status: "upcoming", startDate, endDate, color: store.workspace.brandColor });
    setOpen(false); setName(""); setSaving(false);
  };

  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">TRAINING OPERATIONS</span><h1>Quản lý lớp học</h1><p>Gắn sách, giảng viên, học viên, bài tập và tiến độ vào từng lớp.</p></div><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16}/>Tạo lớp mới</button></div>
    {notice && <p role="status" style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 14px", padding: "10px 14px", border: "1px solid #ecd9b0", borderRadius: 12, background: "#fff8ec", color: "#8a5a12", fontSize: 12 }}><AlertTriangle size={14}/>{notice}</p>}
    {production && !cloudReady && !notice && <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>Đang đồng bộ danh sách lớp từ server…</p>}
    <section className="section-card"><div className="table-toolbar"><div className="search-box compact"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm lớp, mã lớp, giảng viên..."/></div><span className="result-count">{filtered.length} lớp</span></div><div className="section-body"><div className="class-grid">{filtered.map((course) => { const status = STATUS_LABEL[course.status] ?? STATUS_LABEL.upcoming; return <article className="class-card" key={`${course.source}-${course.id}`}><div className="class-card-accent" style={{ background: course.color }}/><div className="class-card-head"><span className="class-code">{course.code}</span><span style={{ display: "inline-flex", gap: 6 }}><Badge tone={status.tone}>{status.label}</Badge>{course.source === "local" && <Badge tone="warning"><CloudOff size={11}/>Thiết bị</Badge>}</span></div><h3>{course.name}</h3><p>Giảng viên: <strong>{course.teacherName}</strong></p><div className="class-metrics"><div><Users size={16}/><span><strong>{course.studentCount}</strong> học viên</span></div><div><BookOpen size={16}/><span><strong>{course.bookCount}</strong> sách</span></div><div><CalendarDays size={16}/><span>{course.startDate ? formatDate(course.startDate) : "—"} – {course.endDate ? formatDate(course.endDate) : "—"}</span></div></div><div className="class-progress"><span style={{ width: `${course.progressPercent}%` }}/></div>{course.atRiskCount > 0 && <p className="muted" style={{ fontSize: 11, margin: "6px 0 0" }}><AlertTriangle size={11}/> {course.atRiskCount} học viên cần hỗ trợ</p>}<div className="class-actions"><button className="btn btn-secondary btn-sm" onClick={() => setDetailId(course.id)}>Xem chi tiết</button><Link className="btn btn-soft btn-sm" href="/library">Cấp tài liệu</Link></div></article>; })}</div></div></section>
    <Modal open={open} onClose={() => setOpen(false)} title="Tạo lớp học mới" description={production ? "Lớp được lưu vào Supabase và gán cho tài khoản hiện tại; nếu server lỗi, bản nháp vẫn được giữ trên thiết bị." : "Sau khi tạo, bạn có thể mời học viên và giao thêm sách."}><div className="form-grid"><label className="field full"><span>Tên lớp</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Makeup Chuyên Nghiệp K27"/></label><label className="field"><span>Giảng viên</span><input className="input" value={teacher} onChange={(event) => setTeacher(event.target.value)} disabled={production}/></label><label className="field"><span>Sách chính</span><select className="select" value={bookId} onChange={(event) => setBookId(event.target.value)}>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setOpen(false)}>Hủy</button><button className="btn btn-primary" disabled={saving} onClick={() => void create()}><GraduationCap size={15}/>{saving ? "Đang tạo…" : "Tạo lớp"}</button></div></Modal>
    <Modal open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail?.name ?? "Chi tiết lớp"} description={`${detail?.code ?? ""} • Giảng viên ${detail?.teacherName ?? ""}${detail?.source === "local" ? " • chỉ lưu trên thiết bị" : ""}`} width={720}>
      <div className="class-detail-summary"><div><Users size={18}/><span><strong>{detail?.studentCount ?? 0}</strong> học viên</span></div><div><BookOpen size={18}/><span><strong>{detail?.bookCount ?? 0}</strong> tài liệu</span></div><div><CalendarDays size={18}/><span>{detail ? `${detail.startDate ? formatDate(detail.startDate) : "—"} – ${detail.endDate ? formatDate(detail.endDate) : "—"}` : ""}</span></div></div>
      {detail?.source === "cloud" ? <div className="detail-two-columns"><section><h3>Tiến độ lớp</h3><div className="detail-list-row"><Users size={15}/><span><strong>{detail.progressPercent}% tiến độ trung bình</strong><small>{detail.atRiskCount} học viên cần hỗ trợ</small></span></div></section><section><h3>Quản trị lớp</h3><p className="muted">Lớp cloud được quản lý đầy đủ trong Class Command Center — danh sách học viên, buổi học, đánh giá và tốt nghiệp.</p></section></div> : <div className="detail-two-columns"><section><h3>Sách đang cấp</h3>{detail?.local?.bookIds.length ? detail.local.bookIds.map((id) => { const book = store.books.find((item) => item.id === id); return book ? <Link className="detail-list-row" key={id} href={`/reader/${book.id}`}><BookOpen size={15}/><span><strong>{book.title}</strong><small>{book.pages.length} trang</small></span></Link> : null; }) : <p className="muted">Chưa có sách.</p>}</section><section><h3>Học viên</h3>{detail?.local?.studentIds.length ? detail.local.studentIds.map((id) => { const student = store.students.find((item) => item.id === id); return student ? <div className="detail-list-row" key={id}><Users size={15}/><span><strong>{student.name}</strong><small>{student.progress}% tiến độ</small></span></div> : null; }) : <p className="muted">Chưa có học viên.</p>}</section></div>}
      <div className="modal-actions">{detail?.source === "cloud" && <Link className="btn btn-secondary" href={`/instructor/classes/${detail.id}`}>Mở Command Center</Link>}<Link className="btn btn-secondary" href="/students">Quản lý học viên</Link><Link className="btn btn-primary" href="/assignments">Giao bài tập</Link></div>
    </Modal>
  </AppShell>;
}
