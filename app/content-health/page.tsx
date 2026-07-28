"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/utils";
import { Accessibility, BookOpenCheck, CircleAlert, ImageIcon, Palette, RefreshCw, ShieldCheck, TextSearch } from "lucide-react";

export default function ContentHealthPage() {
  const store = useAppStore(); const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const report = useMemo(() => store.contentHealthReports.find((item) => item.bookId === bookId), [store.contentHealthReports, bookId]);
  const book = store.books.find((item) => item.id === bookId);
  const scan = () => store.scanBookHealth(bookId);
  const scores = report ? [
    { label: "Khả năng đọc", value: report.readability, icon: TextSearch },
    { label: "Tiếp cận", value: report.accessibility, icon: Accessibility },
    { label: "Nhất quán thương hiệu", value: report.brandConsistency, icon: Palette },
    { label: "Chất lượng hình ảnh", value: report.imageQuality, icon: ImageIcon }
  ] : [];
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">CONTENT QUALITY CONTROL</span><h1>Kiểm tra chất lượng sách</h1><p>Quét nội dung, khả năng đọc, accessibility, thương hiệu và chất lượng tài sản trước khi phát hành.</p></div><div className="header-actions"><select className="select health-book-select" value={bookId} onChange={(event) => setBookId(event.target.value)}>{store.books.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><button className="btn btn-primary" onClick={scan}><RefreshCw size={15}/>Quét lại</button></div></div>
    {report ? <div className="health-layout"><section className="section-card health-score-card"><div className="health-score-ring" style={{ "--score": report.score } as React.CSSProperties}><span><strong>{report.score}</strong><small>/100</small></span></div><h2>{report.score >= 90 ? "Sẵn sàng phát hành" : report.score >= 75 ? "Chất lượng tốt, còn điểm cần tối ưu" : "Cần chỉnh sửa trước khi phát hành"}</h2><p>{book?.title}</p><Badge tone={report.score >= 90 ? "success" : "warning"}>Quét {formatDate(report.lastScannedAt)}</Badge><Link className="btn btn-secondary" href={`/editor/${bookId}`}><BookOpenCheck size={15}/>Mở trong Studio</Link></section><section className="section-card"><div className="section-head"><div><h2>Điểm thành phần</h2><p>Đánh giá theo từng tiêu chí xuất bản.</p></div><ShieldCheck size={19}/></div><div className="section-body health-score-list">{scores.map(({ label, value, icon: Icon }) => <div key={label}><span><Icon size={16}/><strong>{label}</strong></span><div><i style={{ width: `${value}%` }}/></div><b>{value}</b></div>)}</div></section><section className="section-card health-warnings"><div className="section-head"><div><h2>Cảnh báo cần xử lý</h2><p>{report.warnings.length} phát hiện trong lần quét gần nhất.</p></div><CircleAlert size={19}/></div><div className="section-body">{report.warnings.map((warning, index) => <article key={`${warning}-${index}`}><span>{index + 1}</span><p>{warning}</p></article>)}{report.brokenLinks > 0 && <article><span>!</span><p>{report.brokenLinks} liên kết không hoạt động.</p></article>}</div></section></div> : <section className="section-card health-empty"><ShieldCheck size={38}/><h2>Chưa có báo cáo cho sách này</h2><p>Chạy kiểm tra để tạo điểm chất lượng và danh sách việc cần sửa.</p><button className="btn btn-primary" onClick={scan}>Bắt đầu quét</button></section>}
  </AppShell>;
}
