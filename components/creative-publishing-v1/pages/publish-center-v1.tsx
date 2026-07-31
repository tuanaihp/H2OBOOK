"use client";

import Link from "next/link";
import { BookOpen, CloudCog, Download, FileArchive, FileText, Play, Printer, Send, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { emitCreativeEvent } from "@/lib/creative-publishing-v1/events";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";

const profiles = [
  { id: "web_reader", label: "Web Reader", detail: "Responsive", icon: BookOpen },
  { id: "pdf_web", label: "PDF Web", detail: "210×297 mm", icon: FileText },
  { id: "pdf_print", label: "PDF Print A4", detail: "Bleed + font embed", icon: Printer },
  { id: "epub_reflowable", label: "EPUB 3 Reflowable", detail: "Responsive", icon: FileArchive },
  { id: "epub_fixed", label: "EPUB 3 Fixed", detail: "794×1123 px", icon: FileArchive },
  { id: "scorm_12", label: "SCORM 1.2", detail: "LMS package", icon: FileArchive },
  { id: "scorm_2004", label: "SCORM 2004", detail: "LMS package", icon: FileArchive },
  { id: "xapi", label: "xAPI / Tin Can", detail: "LRS package", icon: FileArchive },
];

export function PublishCenterV1() {
  // Select the raw slice and memoize the filter: an inline `.filter()` in the selector
  // returns a new array every render and loops with Zustand's useSyncExternalStore
  // (React error #185, seen live during preview).
  const allBooks = useAppStore((state) => state.books);
  const books = useMemo(() => allBooks.filter((book) => !book.archivedAt), [allBooks]);
  const reports = useAppStore((state) => state.contentHealthReports);
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [profile, setProfile] = useState("pdf_web");
  const [mode, setMode] = useState<"local" | "worker">("local");
  const [message, setMessage] = useState("Sẵn sàng xuất bản");
  const report = reports.find((item) => item.bookId === bookId);
  const selectedProfile = profiles.find((item) => item.id === profile) ?? profiles[0];

  const create = () => {
    setMessage(mode === "local" ? `Đang tạo ${selectedProfile.label} trên thiết bị...` : `Đã gửi ${selectedProfile.label} vào publishing worker.`);
    emitCreativeEvent({ name: "creative_job_started", surface: "publish", action: mode === "local" ? "local_export" : "worker_export", entityId: bookId, metadata: { profile } });
    window.setTimeout(() => {
      setMessage(mode === "local" ? "Artifact local đã sẵn sàng tải xuống." : "Job worker đã được xếp hàng và có thể theo dõi.");
      emitCreativeEvent({ name: "creative_job_completed", surface: "publish", action: mode === "local" ? "local_export" : "worker_export", entityId: bookId, metadata: { profile } });
    }, 700);
  };

  return <CreativePageFrame active="publish" eyebrow="PROFESSIONAL PUBLISHING" title="Publish Center" description="Một nguồn nội dung, nhiều định dạng Web, PDF, EPUB và LMS." actions={<Link className={styles.secondaryButton} href={`/editor/${bookId || "book_makeup_pro"}`}><BookOpen/>Quay lại Studio</Link>} metrics={[
    { label: "Hồ sơ xuất", value: profiles.length },
    { label: "Preflight", value: report?.score ?? "—" },
    { label: "Chế độ", value: mode === "local" ? "Local" : "Worker" },
    { label: "Định dạng", value: selectedProfile.label },
  ]}>
    <div className={styles.publishLayout}>
      <SurfaceCard title="Chọn hồ sơ xuất bản" description="Profile quyết định output, font, bleed và accessibility." icon={<Send/>}>
        <select className={styles.selectWide} value={bookId} onChange={(event) => setBookId(event.target.value)}>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select>
        <div className={styles.profileGrid}>{profiles.map(({ id, label, detail, icon: Icon }) => <button key={id} className={profile === id ? styles.profileActive : styles.profileCard} onClick={() => setProfile(id)}><Icon/><strong>{label}</strong><small>{detail}</small></button>)}</div>
        <div className={styles.publishActions}><button className={mode === "local" ? styles.modeActive : styles.modeButton} onClick={() => setMode("local")}><Download/>Tạo trên thiết bị</button><button className={mode === "worker" ? styles.modeActive : styles.modeButton} onClick={() => setMode("worker")}><CloudCog/>Đưa vào worker</button><button className={styles.primaryButton} onClick={create}><Play/>Bắt đầu xuất</button></div>
      </SurfaceCard>
      <SurfaceCard title="Thông số" description="Giá trị phải lấy từ export profile production.">
        <dl className={styles.specList}><div><dt>Định dạng</dt><dd>{profile}</dd></div><div><dt>Bleed</dt><dd>{profile === "pdf_print" ? "3 mm" : "0 mm"}</dd></div><div><dt>Font nhúng</dt><dd>{profile.startsWith("pdf") ? "Có trong worker" : "Theo package"}</dd></div><div><dt>Accessibility</dt><dd>Bật</dd></div><div><dt>PDF/X</dt><dd>{profile === "pdf_print" ? "Cần ICC + validator" : "Không áp dụng"}</dd></div><div><dt>Preflight</dt><dd><StatusPill tone={report && report.score >= 85 ? "success" : "warning"}>{report?.score ?? "Chưa quét"}</StatusPill></dd></div></dl>
        <div className={styles.callout}><ShieldCheck/><div><strong>Trạng thái job</strong><p>{message}</p></div></div>
      </SurfaceCard>
    </div>
  </CreativePageFrame>;
}
