"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { emitCreativeEvent } from "@/lib/creative-publishing-v1/events";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";

export function ContentHealthV1() {
  const store = useAppStore();
  const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const book = store.books.find((item) => item.id === bookId);
  const report = useMemo(() => store.contentHealthReports.find((item) => item.bookId === bookId), [store.contentHealthReports, bookId]);

  const scan = () => {
    const result = store.scanBookHealth(bookId);
    emitCreativeEvent({ name: result ? "creative_job_completed" : "creative_job_failed", surface: "content-health", action: "scan_book", entityId: bookId, metadata: { score: result?.score ?? 0 } });
  };

  const metrics = report ? [
    { label: "Khả năng đọc", value: report.readability },
    { label: "Tiếp cận", value: report.accessibility },
    { label: "Nhận diện", value: report.brandConsistency },
    { label: "Chất lượng ảnh", value: report.imageQuality },
  ] : [];

  return <CreativePageFrame active="content-health" eyebrow="CONTENT QUALITY CONTROL" title="Kiểm tra chất lượng sách" description="Preflight dùng chung cho Editor, Review và Publish Center." actions={<><select className={styles.selectWide} value={bookId} onChange={(event) => setBookId(event.target.value)}>{store.books.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button className={styles.primaryButton} onClick={scan}><RefreshCw/>Quét lại</button></>} metrics={metrics}>
    <div className={styles.healthLayout}>
      <SurfaceCard title="Điểm tổng" description={book?.title ?? "Chọn sách"} icon={<Gauge/>}>
        <div className={styles.scoreRing} style={{ "--score": `${report?.score ?? 0}%` } as CSSProperties}><strong>{report?.score ?? "—"}</strong><span>/100</span></div>
        <h3>{report ? report.score >= 90 ? "Sẵn sàng xuất bản" : report.score >= 75 ? "Chất lượng tốt, còn điểm cần tối ưu" : "Cần xử lý trước khi phát hành" : "Chưa có báo cáo"}</h3>
        {report ? <StatusPill tone={report.score >= 90 ? "success" : "warning"}>Quét {new Date(report.lastScannedAt).toLocaleDateString("vi-VN")}</StatusPill> : null}
        {book ? <Link className={styles.secondaryButton} href={`/editor/${book.id}`}><FileCheck2/>Mở trong Studio</Link> : null}
      </SurfaceCard>
      <div className={styles.stack}>
        <SurfaceCard title="Điểm thành phần" description="Các tiêu chí phải đạt trước khi publish." icon={<ShieldCheck/>}>
          {report ? <div className={styles.scoreBars}>{[
            ["Khả năng đọc", report.readability],
            ["Tiếp cận", report.accessibility],
            ["Nhất quán thương hiệu", report.brandConsistency],
            ["Chất lượng hình ảnh", report.imageQuality],
          ].map(([label, value]) => <div key={String(label)}><span>{label}</span><div><i style={{ width: `${value}%` }}/></div><strong>{value}</strong></div>)}</div> : <p>Chạy quét để tạo báo cáo mới.</p>}
        </SurfaceCard>
        <SurfaceCard title="Cảnh báo cần xử lý" description={`${report?.warnings.length ?? 0} phát hiện trong lần quét gần nhất.`} icon={<AlertTriangle/>}>
          {report?.warnings.length ? <ol className={styles.warningList}>{report.warnings.map((warning, index) => <li key={warning}><span>{index + 1}</span><p>{warning}</p></li>)}</ol> : <div className={styles.successPanel}><CheckCircle2/><strong>Không có cảnh báo chặn xuất bản.</strong></div>}
        </SurfaceCard>
      </div>
    </div>
  </CreativePageFrame>;
}
